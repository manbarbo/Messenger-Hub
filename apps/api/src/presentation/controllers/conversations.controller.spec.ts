import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import request from 'supertest';
import { ConversationsController } from './conversations.controller';
import { ListConversationsQuery } from '@application/queries/list-conversations/list-conversations.query';
import { GetConversationDetailQuery } from '@application/queries/get-conversation-detail/get-conversation-detail.query';
import { ConversationNotFoundError } from '@domain/errors';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import { LOGGER } from '@domain/services';

const listResult = {
  items: [
    {
      id: 'conv-1',
      clinicId: 'clinic-1',
      clinicName: 'Clínica Norte',
      patientPhone: '+573001112233',
      status: ConversationStatus.RESOLVED_BY_AI,
      createdAt: new Date('2026-10-06T03:40:00Z'),
      updatedAt: new Date('2026-10-06T03:45:00Z'),
      lastMessageAt: new Date('2026-10-06T03:45:00Z'),
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const detailResult = {
  id: 'conv-1',
  clinicId: 'clinic-1',
  clinicName: 'Clínica Norte',
  patientPhone: '+573001112233',
  status: ConversationStatus.APPOINTMENT_BOOKED,
  createdAt: new Date('2026-10-06T03:40:00Z'),
  updatedAt: new Date('2026-10-06T03:45:00Z'),
  lastMessageAt: new Date('2026-10-06T03:45:00Z'),
  messages: [],
  aiTraces: [],
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('ConversationsController', () => {
  let queryBus: { execute: ReturnType<typeof vi.fn> };
  let app: INestApplication;

  async function createApp(): Promise<INestApplication> {
    queryBus = { execute: vi.fn() };
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        { provide: QueryBus, useValue: queryBus },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists conversations with DESIGN.md envelope and default pagination', async () => {
    await createApp();
    queryBus.execute.mockResolvedValue(listResult);

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .expect(HttpStatus.OK);

    expect(response.body).toEqual({
      data: [
        {
          ...listResult.items[0],
          createdAt: listResult.items[0].createdAt.toISOString(),
          updatedAt: listResult.items[0].updatedAt.toISOString(),
          lastMessageAt: listResult.items[0].lastMessageAt.toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const query = queryBus.execute.mock.calls[0][0] as ListConversationsQuery;
    expect(query).toBeInstanceOf(ListConversationsQuery);
    expect(query.filters).toEqual({});
    expect(query.pagination).toEqual({ page: 1, pageSize: 20 });
  });

  it('passes status, clinicId, page, and limit filters to the query bus', async () => {
    await createApp();
    queryBus.execute.mockResolvedValue(listResult);

    await request(app.getHttpServer())
      .get('/api/conversations')
      .query({
        status: 'escalated',
        clinicId: 'clinic-9',
        page: '2',
        limit: '50',
      })
      .expect(HttpStatus.OK);

    const query = queryBus.execute.mock.calls[0][0] as ListConversationsQuery;
    expect(query.filters).toEqual({
      status: ConversationStatus.ESCALATED,
      clinicId: 'clinic-9',
    });
    expect(query.pagination).toEqual({ page: 2, pageSize: 50 });
  });

  it('returns 400 for an invalid status filter', async () => {
    await createApp();

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .query({ status: 'not_a_status' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('status');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('returns 400 for an out-of-range limit', async () => {
    await createApp();

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .query({ limit: '101' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('limit');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-integer page', async () => {
    await createApp();

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .query({ page: '0' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('page');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('returns conversation detail with messages and AI traces', async () => {
    await createApp();
    queryBus.execute.mockResolvedValue(detailResult);

    const response = await request(app.getHttpServer())
      .get('/api/conversations/conv-1')
      .expect(HttpStatus.OK);

    expect(response.body.id).toBe('conv-1');
    expect(response.body.status).toBe('appointment_booked');
    expect(response.body.messages).toEqual([]);
    expect(response.body.aiTraces).toEqual([]);

    const query = queryBus.execute.mock.calls[0][0] as GetConversationDetailQuery;
    expect(query).toBeInstanceOf(GetConversationDetailQuery);
    expect(query.conversationId).toBe('conv-1');
  });

  it('returns 404 when the conversation does not exist', async () => {
    await createApp();
    queryBus.execute.mockRejectedValue(new ConversationNotFoundError('missing-1'));

    const response = await request(app.getHttpServer())
      .get('/api/conversations/missing-1')
      .expect(HttpStatus.NOT_FOUND);

    expect(response.body.error).toBe('ConversationNotFoundError');
    expect(response.body.message).toContain('missing-1');
  });

  it('rethrows non-NotFound query errors without mapping them', async () => {
    await createApp();
    const unexpected = new Error('database exploded');
    queryBus.execute.mockRejectedValue(unexpected);

    await request(app.getHttpServer())
      .get('/api/conversations/conv-1')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

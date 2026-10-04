import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import request from 'supertest';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { CreateKnowledgeDocumentCommand } from '@application/commands/knowledge-documents/create-knowledge-document/create-knowledge-document.command';
import { DeleteKnowledgeDocumentCommand } from '@application/commands/knowledge-documents/delete-knowledge-document/delete-knowledge-document.command';
import { UpdateKnowledgeDocumentCommand } from '@application/commands/knowledge-documents/update-knowledge-document/update-knowledge-document.command';
import type { KnowledgeDocumentDetail } from '@application/dto/knowledge-document-view';
import { GetKnowledgeDocumentQuery } from '@application/queries/knowledge-documents/get-knowledge-document/get-knowledge-document.query';
import { ListKnowledgeDocumentsQuery } from '@application/queries/knowledge-documents/list-knowledge-documents/list-knowledge-documents.query';
import { KnowledgeDocumentNotFoundError } from '@domain/errors';
import { DomainExceptionFilter } from '../filters/domain-exception.filter';
import { LOGGER } from '@domain/services';

const summary = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horarios',
  category: 'horarios',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

const detail: KnowledgeDocumentDetail = {
  ...summary,
  content: 'Lunes a viernes 8am a 6pm',
};

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('KnowledgeDocumentsController', () => {
  let commandBus: { execute: ReturnType<typeof vi.fn> };
  let queryBus: { execute: ReturnType<typeof vi.fn> };
  let app: INestApplication;

  async function createApp(): Promise<INestApplication> {
    commandBus = { execute: vi.fn() };
    queryBus = { execute: vi.fn() };
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [KnowledgeDocumentsController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: LOGGER, useValue: mockLogger },
        { provide: DomainExceptionFilter, useValue: new DomainExceptionFilter(mockLogger) },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter(mockLogger));
    await app.init();
    return app;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/knowledge', () => {
    it('lists knowledge documents with pagination', async () => {
      await createApp();
      queryBus.execute.mockResolvedValue({
        items: [summary],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const response = await request(app.getHttpServer())
        .get('/api/knowledge')
        .query({ clinicId: 'clinic-1', category: 'horarios' })
        .expect(HttpStatus.OK);

      expect(response.body.data).toEqual([
        expect.objectContaining({ id: 'doc-1', title: 'Horarios', category: 'horarios' }),
      ]);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });

      const query = queryBus.execute.mock.calls[0][0] as ListKnowledgeDocumentsQuery;
      expect(query).toBeInstanceOf(ListKnowledgeDocumentsQuery);
      expect(query.filters).toEqual({ clinicId: 'clinic-1', category: 'horarios' });
      expect(query.pagination).toEqual({ page: 1, pageSize: 20 });
    });

    it('returns 400 when clinicId is missing', async () => {
      await createApp();

      const response = await request(app.getHttpServer())
        .get('/api/knowledge')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.error).toBe('ValidationError');
      expect(response.body.message).toContain('clinicId');
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when limit is out of range', async () => {
      await createApp();

      await request(app.getHttpServer())
        .get('/api/knowledge')
        .query({ clinicId: 'clinic-1', limit: '0' })
        .expect(HttpStatus.BAD_REQUEST);
      expect(queryBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/knowledge/:id', () => {
    it('returns document detail', async () => {
      await createApp();
      queryBus.execute.mockResolvedValue(detail);

      const response = await request(app.getHttpServer())
        .get('/api/knowledge/doc-1')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual(
        expect.objectContaining({ id: 'doc-1', content: 'Lunes a viernes 8am a 6pm' }),
      );
      expect(response.body).not.toHaveProperty('embedding');

      const query = queryBus.execute.mock.calls[0][0] as GetKnowledgeDocumentQuery;
      expect(query).toBeInstanceOf(GetKnowledgeDocumentQuery);
      expect(query.id).toBe('doc-1');
    });

    it('returns 404 when document does not exist', async () => {
      await createApp();
      queryBus.execute.mockRejectedValue(new KnowledgeDocumentNotFoundError('missing'));

      const response = await request(app.getHttpServer())
        .get('/api/knowledge/missing')
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.error).toBe('KnowledgeDocumentNotFoundError');
    });
  });

  describe('POST /api/knowledge', () => {
    it('creates a document and returns 201', async () => {
      await createApp();
      commandBus.execute.mockResolvedValue(detail);

      const body = {
        clinicId: 'clinic-1',
        title: 'Horarios',
        content: 'Lunes a viernes 8am a 6pm',
        category: 'horarios',
      };

      const response = await request(app.getHttpServer())
        .post('/api/knowledge')
        .send(body)
        .expect(HttpStatus.CREATED);

      expect(response.body.id).toBe('doc-1');

      const command = commandBus.execute.mock.calls[0][0] as CreateKnowledgeDocumentCommand;
      expect(command).toBeInstanceOf(CreateKnowledgeDocumentCommand);
      expect(command).toEqual(
        new CreateKnowledgeDocumentCommand(
          body.clinicId,
          body.title,
          body.content,
          body.category,
        ),
      );
    });

    it('returns 400 for invalid body', async () => {
      await createApp();

      const response = await request(app.getHttpServer())
        .post('/api/knowledge')
        .send({ clinicId: 'clinic-1', title: 'Horarios' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.error).toBe('ValidationError');
      expect(response.body.message).toContain('content');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/knowledge/:id', () => {
    it('updates a document partially', async () => {
      await createApp();
      commandBus.execute.mockResolvedValue({ ...detail, title: 'Horarios actualizados' });

      const response = await request(app.getHttpServer())
        .patch('/api/knowledge/doc-1')
        .send({ title: 'Horarios actualizados' })
        .expect(HttpStatus.OK);

      expect(response.body.title).toBe('Horarios actualizados');

      const command = commandBus.execute.mock.calls[0][0] as UpdateKnowledgeDocumentCommand;
      expect(command).toBeInstanceOf(UpdateKnowledgeDocumentCommand);
      expect(command.id).toBe('doc-1');
      expect(command.title).toBe('Horarios actualizados');
      expect(command.content).toBeUndefined();
      expect(command.category).toBeUndefined();
    });

    it('returns 400 when body has no updatable fields', async () => {
      await createApp();

      await request(app.getHttpServer())
        .patch('/api/knowledge/doc-1')
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/knowledge/:id', () => {
    it('deletes a document and returns confirmation', async () => {
      await createApp();
      commandBus.execute.mockResolvedValue({ deleted: true, documentId: 'doc-1' });

      const response = await request(app.getHttpServer())
        .delete('/api/knowledge/doc-1')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ deleted: true, documentId: 'doc-1' });

      const command = commandBus.execute.mock.calls[0][0] as DeleteKnowledgeDocumentCommand;
      expect(command).toBeInstanceOf(DeleteKnowledgeDocumentCommand);
      expect(command.id).toBe('doc-1');
    });

    it('returns 404 when deleting a missing document', async () => {
      await createApp();
      commandBus.execute.mockRejectedValue(new KnowledgeDocumentNotFoundError('missing'));

      await request(app.getHttpServer())
        .delete('/api/knowledge/missing')
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});

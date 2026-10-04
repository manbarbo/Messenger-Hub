import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import request from 'supertest';
import { ClinicsController } from './clinics.controller';
import { ListClinicsQuery } from '@application/queries/list-clinics/list-clinics.query';

const clinics = [
  { id: 'clinic-1', name: 'Clínica Norte' },
  { id: 'clinic-2', name: 'Clínica Sur' },
];

describe('ClinicsController', () => {
  let queryBus: { execute: ReturnType<typeof vi.fn> };
  let app: INestApplication;

  async function createApp(): Promise<INestApplication> {
    queryBus = { execute: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [ClinicsController],
      providers: [{ provide: QueryBus, useValue: queryBus }],
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

  it('lists clinics with id and name', async () => {
    await createApp();
    queryBus.execute.mockResolvedValue(clinics);

    const response = await request(app.getHttpServer())
      .get('/api/clinics')
      .expect(HttpStatus.OK);

    expect(response.body).toEqual(clinics);

    const query = queryBus.execute.mock.calls[0][0] as ListClinicsQuery;
    expect(query).toBeInstanceOf(ListClinicsQuery);
  });

  it('returns empty array when no clinics exist', async () => {
    await createApp();
    queryBus.execute.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/api/clinics')
      .expect(HttpStatus.OK);

    expect(response.body).toEqual([]);
  });
});

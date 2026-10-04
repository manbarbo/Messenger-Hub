import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import type { ConversationSummary } from './models/conversation.model';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  const summary: ConversationSummary = {
    id: 'conv-1',
    clinicId: 'clinic-1',
    clinicName: 'Clínica Norte',
    patientPhone: '+573001112233',
    status: 'active',
    createdAt: '2026-10-06T03:40:00.000Z',
    updatedAt: '2026-10-06T03:45:00.000Z',
    lastMessageAt: '2026-10-06T03:45:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listClinics', () => {
    it('requests the clinics endpoint and returns id/name list', () => {
      const clinics = [
        { id: 'clinic-1', name: 'Clínica Norte' },
        { id: 'clinic-2', name: 'Clínica Sur' },
      ];
      let response: unknown;
      service.listClinics().subscribe((body) => (response = body));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/clinics`);
      expect(request.request.method).toBe('GET');

      request.flush(clinics);
      expect(response).toEqual(clinics);
    });
  });

  describe('listConversations', () => {
    it('requests the conversations endpoint without params by default', () => {
      let response: unknown;
      service.listConversations().subscribe((body) => (response = body));

      const request = httpMock.expectOne(
        `${environment.apiUrl}/api/conversations`,
      );
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys().length).toBe(0);

      request.flush({ data: [summary], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
      expect(response).toEqual({
        data: [summary],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('passes filter and pagination query params', () => {
      service
        .listConversations({
          status: 'escalated',
          clinicId: 'clinic-1',
          page: 2,
          limit: 10,
        })
        .subscribe();

      const request = httpMock.expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/api/conversations` &&
          req.params.get('status') === 'escalated' &&
          req.params.get('clinicId') === 'clinic-1' &&
          req.params.get('page') === '2' &&
          req.params.get('limit') === '10',
      );
      expect(request.request.method).toBe('GET');
      request.flush({ data: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } });
    });
  });

  describe('getConversation', () => {
    it('requests conversation detail by id', () => {
      let response: unknown;
      service.getConversation('conv-1').subscribe((body) => (response = body));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/conversations/conv-1`);
      expect(request.request.method).toBe('GET');

      request.flush({
        ...summary,
        messages: [],
        aiTraces: [],
      });
      expect(response).toEqual({
        ...summary,
        messages: [],
        aiTraces: [],
      });
    });
  });

  describe('listKnowledgeDocuments', () => {
    it('requests the knowledge endpoint with clinicId and optional filters', () => {
      const summaries = [
        {
          id: 'doc-1',
          clinicId: 'clinic-1',
          title: 'Horarios',
          category: 'horarios',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-02T10:00:00.000Z',
        },
      ];
      let response: unknown;
      service
        .listKnowledgeDocuments({ clinicId: 'clinic-1', category: 'horarios', page: 1, limit: 20 })
        .subscribe((body) => (response = body));

      const request = httpMock.expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/api/knowledge` &&
          req.params.get('clinicId') === 'clinic-1' &&
          req.params.get('category') === 'horarios' &&
          req.params.get('page') === '1' &&
          req.params.get('limit') === '20',
      );
      expect(request.request.method).toBe('GET');

      request.flush({ data: summaries, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
      expect(response).toEqual({
        data: summaries,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });
  });

  describe('getKnowledgeDocument', () => {
    it('requests knowledge document detail by id', () => {
      const detail = {
        id: 'doc-1',
        clinicId: 'clinic-1',
        title: 'Horarios',
        content: 'Lunes a viernes',
        category: 'horarios',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-02T10:00:00.000Z',
      };
      let response: unknown;
      service.getKnowledgeDocument('doc-1').subscribe((body) => (response = body));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/knowledge/doc-1`);
      expect(request.request.method).toBe('GET');

      request.flush(detail);
      expect(response).toEqual(detail);
    });
  });

  describe('createKnowledgeDocument', () => {
    it('posts a new knowledge document', () => {
      const body = {
        clinicId: 'clinic-1',
        title: 'Horarios',
        content: 'Lunes a viernes',
        category: 'horarios',
      };
      const detail = {
        id: 'doc-1',
        ...body,
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };
      let response: unknown;
      service.createKnowledgeDocument(body).subscribe((result) => (response = result));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/knowledge`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(body);

      request.flush(detail);
      expect(response).toEqual(detail);
    });
  });

  describe('updateKnowledgeDocument', () => {
    it('patches a knowledge document', () => {
      const body = { title: 'Horarios actualizados' };
      const detail = {
        id: 'doc-1',
        clinicId: 'clinic-1',
        title: 'Horarios actualizados',
        content: 'Lunes a viernes',
        category: 'horarios',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-02T10:00:00.000Z',
      };
      let response: unknown;
      service.updateKnowledgeDocument('doc-1', body).subscribe((result) => (response = result));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/knowledge/doc-1`);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual(body);

      request.flush(detail);
      expect(response).toEqual(detail);
    });
  });

  describe('deleteKnowledgeDocument', () => {
    it('deletes a knowledge document and returns confirmation', () => {
      let response: unknown;
      service.deleteKnowledgeDocument('doc-1').subscribe((result) => (response = result));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/knowledge/doc-1`);
      expect(request.request.method).toBe('DELETE');

      request.flush({ deleted: true, documentId: 'doc-1' });
      expect(response).toEqual({ deleted: true, documentId: 'doc-1' });
    });
  });

  describe('sendSimulatorMessage', () => {
    it('posts simulator message and returns accepted payload', () => {
      const body = { from: '+573009998877', text: 'Hola' };
      let response: unknown;
      service.sendSimulatorMessage(body).subscribe((result) => (response = result));

      const request = httpMock.expectOne(`${environment.apiUrl}/api/simulator`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(body);

      request.flush({
        status: 'accepted',
        messageId: 'wamid.sim.1',
        conversationId: 'conv-1',
      });
      expect(response).toEqual({
        status: 'accepted',
        messageId: 'wamid.sim.1',
        conversationId: 'conv-1',
      });
    });
  });
});

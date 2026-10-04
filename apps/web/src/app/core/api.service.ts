import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import type { ConversationDetail, ConversationSummary } from './models/conversation.model';
import type { Clinic } from './models/clinic.model';
import type {
  ListConversationsParams,
  ListConversationsResponse,
  SimulatorRequest,
  SimulatorResponse,
} from './models/api.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly baseUrl = environment.apiUrl;

  listClinics(): Observable<readonly Clinic[]> {
    this.logger.debug('Listing clinics', 'ApiService');
    return this.http.get<readonly Clinic[]>(`${this.baseUrl}/api/clinics`);
  }

  listConversations(
    params: ListConversationsParams = {},
  ): Observable<ListConversationsResponse<ConversationSummary>> {
    this.logger.debug('Listing conversations', 'ApiService', {
      status: params.status,
      clinicId: params.clinicId,
      page: params.page,
      limit: params.limit,
    });

    let httpParams = new HttpParams();

    if (params.status !== undefined) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.clinicId !== undefined) {
      httpParams = httpParams.set('clinicId', params.clinicId);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<ListConversationsResponse<ConversationSummary>>(
      `${this.baseUrl}/api/conversations`,
      { params: httpParams },
    );
  }

  getConversation(id: string): Observable<ConversationDetail> {
    this.logger.debug('Fetching conversation detail', 'ApiService', { id });
    return this.http.get<ConversationDetail>(`${this.baseUrl}/api/conversations/${id}`);
  }

  sendSimulatorMessage(body: SimulatorRequest): Observable<SimulatorResponse> {
    this.logger.info('Sending simulator message', 'ApiService', {
      from: body.from,
      clinicId: body.clinicId,
    });
    return this.http.post<SimulatorResponse>(`${this.baseUrl}/api/simulator`, body);
  }
}

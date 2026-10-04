import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/api.service';
import { isAppApiError } from '../../core/app-api.error';
import { LoggerService } from '../../core/logger.service';
import type { PaginationMeta } from '../../core/models/api.model';
import type { Clinic } from '../../core/models/clinic.model';
import type {
  KnowledgeDocumentDetail,
  KnowledgeDocumentSummary,
} from '../../core/models/knowledge-document.model';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-knowledge-list',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    ErrorMessageComponent,
    PaginationComponent,
  ],
  templateUrl: './knowledge-list.component.html',
  styleUrl: './knowledge-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeListComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(LoggerService);

  readonly pageSize = PAGE_SIZE;
  readonly clinicFilter = signal('');
  readonly categoryFilter = signal('');
  readonly clinics = signal<readonly Clinic[]>([]);
  readonly clinicsLoading = signal(false);
  readonly clinicsError = signal<string | null>(null);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly documents = signal<readonly KnowledgeDocumentSummary[]>([]);
  readonly pagination = signal<PaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly selectedDocument = signal<KnowledgeDocumentDetail | null>(null);

  readonly categoryOptions = computed(() => {
    const categories = new Set<string>();
    for (const doc of this.documents()) {
      categories.add(doc.category);
    }
    return Array.from(categories).sort();
  });

  readonly clinicNameById = computed(() => {
    const map = new Map<string, string>();
    for (const clinic of this.clinics()) {
      map.set(clinic.id, clinic.name);
    }
    return map;
  });

  readonly skeletonRows = [0, 1, 2, 3, 4];

  constructor() {
    this.loadClinics();
  }

  onClinicFilterChange(clinicId: string): void {
    this.logger.info('Clinic filter changed', 'KnowledgeList', {
      hasClinicId: clinicId.length > 0,
    });
    this.clinicFilter.set(clinicId);
    this.categoryFilter.set('');
    this.page.set(1);
    this.selectedDocument.set(null);
    this.loadDocuments();
  }

  onCategoryFilterChange(category: string): void {
    this.logger.info('Category filter changed', 'KnowledgeList', {
      hasCategory: category.length > 0,
    });
    this.categoryFilter.set(category);
    this.page.set(1);
    this.loadDocuments();
  }

  onPageChange(page: number): void {
    this.logger.debug('Page changed', 'KnowledgeList', { page });
    this.page.set(page);
    this.loadDocuments();
  }

  openDetail(document: KnowledgeDocumentSummary): void {
    this.logger.debug('Opening knowledge document detail', 'KnowledgeList', {
      documentId: document.id,
    });
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedDocument.set(null);

    this.api
      .getKnowledgeDocument(document.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selectedDocument.set(detail);
          this.detailLoading.set(false);
          this.logger.debug('Knowledge document detail loaded', 'KnowledgeList', {
            documentId: detail.id,
          });
        },
        error: (err: unknown) => {
          this.detailLoading.set(false);
          this.detailError.set(
            isAppApiError(err) ? err.message : 'Failed to load knowledge document',
          );
          this.logger.error('Failed to load knowledge document', 'KnowledgeList', {
            documentId: document.id,
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }

  closeDetail(): void {
    this.logger.debug('Closing knowledge document detail', 'KnowledgeList');
    this.selectedDocument.set(null);
    this.detailError.set(null);
  }

  clinicName(clinicId: string): string {
    return this.clinicNameById().get(clinicId) ?? clinicId;
  }

  loadClinics(): void {
    this.clinicsLoading.set(true);
    this.clinicsError.set(null);

    this.api
      .listClinics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clinics) => {
          this.clinics.set(clinics);
          this.clinicsLoading.set(false);
          this.logger.debug('Clinics loaded', 'KnowledgeList', { count: clinics.length });

          if (clinics.length > 0 && this.clinicFilter().length === 0) {
            this.clinicFilter.set(clinics[0].id);
            this.loadDocuments();
          }
        },
        error: (err: unknown) => {
          this.clinics.set([]);
          this.clinicsLoading.set(false);
          this.clinicsError.set(
            isAppApiError(err) ? err.message : 'Failed to load clinics',
          );
          this.logger.error('Failed to load clinics', 'KnowledgeList', {
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }

  loadDocuments(): void {
    const clinicId = this.clinicFilter();
    if (clinicId.length === 0) {
      this.documents.set([]);
      this.pagination.set({ page: 1, limit: this.pageSize, total: 0, totalPages: 0 });
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const category = this.categoryFilter();

    this.api
      .listKnowledgeDocuments({
        clinicId,
        ...(category ? { category } : {}),
        page: this.page(),
        limit: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.documents.set(response.data);
          this.pagination.set(response.pagination);
          this.loading.set(false);
          this.logger.debug('Knowledge documents loaded', 'KnowledgeList', {
            clinicId,
            count: response.data.length,
            page: response.pagination.page,
            total: response.pagination.total,
          });
        },
        error: (err: unknown) => {
          this.error.set(isAppApiError(err) ? err.message : 'Failed to load knowledge documents');
          this.loading.set(false);
          this.logger.error('Failed to load knowledge documents', 'KnowledgeList', {
            clinicId,
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }
}

import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Clinic } from '../../core/models/clinic.model';
import type { KnowledgeDocumentDetail } from '../../core/models/knowledge-document.model';

export type KnowledgeFormMode = 'create' | 'edit';

export interface KnowledgeFormErrors {
  readonly clinicId: string | null;
  readonly title: string | null;
  readonly category: string | null;
  readonly content: string | null;
}

export interface KnowledgeFormSubmitCreate {
  readonly mode: 'create';
  readonly clinicId: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
}

export interface KnowledgeFormSubmitEdit {
  readonly mode: 'edit';
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
}

export type KnowledgeFormSubmit = KnowledgeFormSubmitCreate | KnowledgeFormSubmitEdit;

const EMPTY_ERRORS: KnowledgeFormErrors = {
  clinicId: null,
  title: null,
  category: null,
  content: null,
};

@Component({
  selector: 'app-knowledge-form',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './knowledge-form.component.html',
  styleUrl: './knowledge-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeFormComponent {
  readonly mode = input<KnowledgeFormMode>('create');
  readonly clinics = input<readonly Clinic[]>([]);
  readonly initial = input<KnowledgeDocumentDetail | null>(null);
  readonly defaultClinicId = input('');
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);

  readonly cancelled = output<void>();
  readonly submitted = output<KnowledgeFormSubmit>();

  readonly clinicId = signal('');
  readonly title = signal('');
  readonly category = signal('');
  readonly content = signal('');
  readonly errors = signal<KnowledgeFormErrors>(EMPTY_ERRORS);
  readonly isEdit = signal(false);

  constructor() {
    effect(() => {
      const mode = this.mode();
      const initial = this.initial();
      this.isEdit.set(mode === 'edit');

      if (mode === 'edit' && initial) {
        this.clinicId.set(initial.clinicId);
        this.title.set(initial.title);
        this.category.set(initial.category);
        this.content.set(initial.content);
      } else {
        this.clinicId.set(this.defaultClinicId());
        this.title.set('');
        this.category.set('');
        this.content.set('');
      }

      this.errors.set(EMPTY_ERRORS);
    });
  }

  onClinicChange(clinicId: string): void {
    this.clinicId.set(clinicId);
  }

  onTitleInput(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onCategoryInput(event: Event): void {
    this.category.set((event.target as HTMLInputElement).value);
  }

  onContentInput(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onSubmit(): void {
    const clinicId = this.clinicId().trim();
    const title = this.title().trim();
    const category = this.category().trim();
    const content = this.content().trim();

    const errors: KnowledgeFormErrors = {
      clinicId: clinicId.length === 0 ? 'Clinic is required' : null,
      title: title.length === 0 ? 'Title is required' : null,
      category: category.length === 0 ? 'Category is required' : null,
      content: content.length === 0 ? 'Content is required' : null,
    };

    this.errors.set(errors);

    if (errors.clinicId || errors.title || errors.category || errors.content) {
      return;
    }

    if (this.isEdit()) {
      const initial = this.initial();
      if (!initial) {
        return;
      }
      this.submitted.emit({ mode: 'edit', id: initial.id, title, content, category });
      return;
    }

    this.submitted.emit({ mode: 'create', clinicId, title, content, category });
  }
}

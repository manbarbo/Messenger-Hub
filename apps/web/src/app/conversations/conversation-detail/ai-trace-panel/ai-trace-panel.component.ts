import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { AITrace, AITraceToolCall } from '../../../core/models/ai-trace.model';

@Component({
  selector: 'app-ai-trace-panel',
  imports: [DatePipe, JsonPipe, MatButtonModule],
  templateUrl: './ai-trace-panel.component.html',
  styleUrl: './ai-trace-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AITracePanelComponent {
  readonly traces = input.required<readonly AITrace[]>();

  private readonly expandedTraceIds = signal<ReadonlySet<string>>(new Set());
  private readonly expandedToolKeys = signal<ReadonlySet<string>>(new Set());

  readonly hasTraces = computed(() => this.traces().length > 0);

  isTraceExpanded(traceId: string): boolean {
    return this.expandedTraceIds().has(traceId);
  }

  toggleTrace(traceId: string): void {
    this.expandedTraceIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(traceId)) {
        next.delete(traceId);
      } else {
        next.add(traceId);
      }
      return next;
    });
  }

  toolKey(trace: AITrace, tool: AITraceToolCall, index: number): string {
    return `${trace.id}:${index}:${tool.name}`;
  }

  isToolExpanded(trace: AITrace, tool: AITraceToolCall, index: number): boolean {
    return this.expandedToolKeys().has(this.toolKey(trace, tool, index));
  }

  toggleTool(trace: AITrace, tool: AITraceToolCall, index: number): void {
    const key = this.toolKey(trace, tool, index);
    this.expandedToolKeys.update((keys) => {
      const next = new Set(keys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  formatCost(costUsd: number): string {
    return `$${costUsd.toFixed(4)}`;
  }
}

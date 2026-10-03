import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isDev = !environment.production;

  debug(message: string, context?: string, data?: unknown): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: unknown): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.log('warn', message, context, data);
  }

  error(message: string, context?: string, data?: unknown): void {
    this.log('error', message, context, data);
  }

  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };

    if (this.isDev) {
      this.consoleOutput(entry);
    } else {
      this.structuredOutput(entry);
      if (level === 'error') {
        this.persistError(entry);
      }
    }
  }

  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    const method = entry.level === 'debug' ? 'log' : entry.level;
    console[method](`${prefix}${contextStr} ${entry.message}`, entry.data ?? '');
  }

  private structuredOutput(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  private persistError(entry: LogEntry): void {
    try {
      const errors: LogEntry[] = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push(entry);
      localStorage.setItem('app_errors', JSON.stringify(errors.slice(-50)));
    } catch {
      // ignore storage errors
    }
  }
}
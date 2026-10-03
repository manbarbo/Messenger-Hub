import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { LoggerService } from './app/core/logger.service';

bootstrapApplication(App, appConfig)
  .then((appRef) => {
    const logger = appRef.injector.get(LoggerService);

    window.onerror = (message, source, lineno, colno, error) => {
      logger.error('Unhandled runtime error', 'GlobalErrorHandler', {
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
      });
    };

    window.addEventListener('unhandledrejection', (event) => {
      logger.error('Unhandled promise rejection', 'PromiseRejection', {
        reason: event.reason instanceof Error ? event.reason.message : event.reason,
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
    });
  })
  .catch((err) => console.error(err));

import type { LoggerOptions } from 'winston';
import { format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apikey', 'key', 'authorization'];

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export { redactSensitive };

const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.colorize(),
  format.printf(({ timestamp, level, message, context, ...meta }) => {
    const ctx = context ? ` [${context}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}${ctx} ${message}${metaStr}`;
  }),
);

const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  format.errors({ stack: true }),
  format.json(),
);

export function createWinstonConfig(isProduction: boolean): LoggerOptions {
  const fileTransport = new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: jsonFormat,
  });

  const combinedTransport = new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: jsonFormat,
  });

  if (isProduction) {
    return {
      level: 'info',
      format: jsonFormat,
      transports: [fileTransport, combinedTransport],
    };
  }

  return {
    level: 'debug',
    format: consoleFormat,
    transports: [new transports.Console()],
  };
}
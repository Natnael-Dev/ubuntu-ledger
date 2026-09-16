// Structured Logger with Mandatory Redaction Middleware (T-24 / S-15)
// Authoritative sources:
// - docs/specs/07-trust-and-security.md §5
// - docs/specs/10-skills.md S-15
// - docs/specs/11-tasks.md T-24

import { redactPii } from './redact';
import { systemClock } from '@/infra/clock';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

export class StructuredLogger {
  constructor(
    private readonly sink: (record: StructuredLogRecord) => void = (rec) => {
      const line = JSON.stringify(rec);
      if (rec.level === 'error') {
        console.error(line);
      } else if (rec.level === 'warn') {
        console.warn(line);
      } else {
        console.log(line);
      }
    }
  ) {}

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const rawRecord: StructuredLogRecord = {
      level,
      message,
      timestamp: systemClock.now().toISOString(),
      context,
    };

    // Mandatory redaction pass before outputting to sink
    const safeRecord = redactPii(rawRecord);
    this.sink(safeRecord);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.emit('error', message, context);
  }
}

export const logger = new StructuredLogger();

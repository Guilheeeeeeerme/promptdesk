import type { LoggerService } from '@nestjs/common';

const SERVICE =
  process.env.SERVICE_NAME?.trim() || 'promptdesk-chatworker';

/**
 * JSON stdout logger for the shared Loki hub (infra observability plane).
 * Never log message bodies, guidelines, tokens, or secrets — ids/status only.
 */
export class JsonLogger implements LoggerService {
  constructor(private readonly serviceName = SERVICE) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('INFO', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('ERROR', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('WARN', message, optionalParams);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('DEBUG', message, optionalParams);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('VERBOSE', message, optionalParams);
  }

  private write(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    let context: string | undefined;
    let stack: string | undefined;
    const rest = [...optionalParams];
    if (rest.length > 0 && typeof rest[rest.length - 1] === 'string') {
      context = rest.pop() as string;
    }
    if (level === 'ERROR' && rest.length > 0 && typeof rest[0] === 'string') {
      stack = rest.shift() as string;
    }
    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message: formatMessage(message),
    };
    if (context) payload.context = context;
    if (stack) payload.stack = stack;
    if (rest.length > 0) payload.meta = rest.map(formatMessage);
    const line = `${JSON.stringify(payload)}\n`;
    if (level === 'ERROR') process.stderr.write(line);
    else process.stdout.write(line);
  }
}

function formatMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

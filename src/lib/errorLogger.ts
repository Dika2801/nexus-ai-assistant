import { ErrorLogEntry } from '../types';

/**
 * Sensitive field patterns to scrub from non-sensitive error logs
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credit_card',
  'card',
  'cvv',
];

/**
 * Sanitizes metadata to ensure no sensitive personal info or API credentials leak into telemetry
 */
function sanitizeValue(key: string, val: any): any {
  if (typeof val === 'string') {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      return '[REDACTED]';
    }
    // Truncate overly long strings
    if (val.length > 500) {
      return val.slice(0, 500) + '... (truncated)';
    }
    return val;
  }

  if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return val.slice(0, 10).map((item, idx) => sanitizeValue(String(idx), item));
    }
    const cleanObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lower.includes(sk))) {
        cleanObj[k] = '[REDACTED]';
      } else {
        cleanObj[k] = sanitizeValue(k, v);
      }
    }
    return cleanObj;
  }

  return val;
}

class ErrorLoggerService {
  private localLogs: ErrorLogEntry[] = [];
  private maxLocalLogs = 50;
  private pendingQueue: Omit<ErrorLogEntry, 'id'>[] = [];
  private flushTimer: any = null;

  constructor() {
    // Optional global unhandled rejection handler for unhandled edge-cases
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        this.warn('window.unhandledrejection', reason?.message || String(reason), {
          stack: reason?.stack?.slice(0, 300),
        });
      });
    }
  }

  /**
   * Log a warning with context and sanitized metadata
   */
  warn(context: string, error: unknown, metadata?: Record<string, any>, userId?: string) {
    this.recordLog('warn', context, error, metadata, userId);
  }

  /**
   * Log an error with context and sanitized metadata
   */
  error(context: string, error: unknown, metadata?: Record<string, any>, userId?: string) {
    this.recordLog('error', context, error, metadata, userId);
  }

  /**
   * Log an informational diagnostic event
   */
  info(context: string, message: string, metadata?: Record<string, any>, userId?: string) {
    this.recordLog('info', context, message, metadata, userId);
  }

  private recordLog(
    level: 'warn' | 'error' | 'info',
    context: string,
    error: unknown,
    metadata?: Record<string, any>,
    userId?: string
  ) {
    const message = this.extractMessage(error);
    const sanitizedMeta = metadata ? sanitizeValue('root', metadata) : undefined;

    const entry: ErrorLogEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level,
      context,
      message,
      userId: userId ? userId.slice(0, 32) : undefined,
      metadata: sanitizedMeta,
    };

    // Keep in local in-memory ring buffer
    this.localLogs.unshift(entry);
    if (this.localLogs.length > this.maxLocalLogs) {
      this.localLogs.pop();
    }

    // Queue for telemetry delivery to admin backend
    this.pendingQueue.push({
      timestamp: entry.timestamp,
      level: entry.level,
      context: entry.context,
      message: entry.message,
      userId: entry.userId,
      metadata: entry.metadata,
    });

    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushLogs();
    }, 1500);
  }

  private async flushLogs() {
    if (this.pendingQueue.length === 0) return;
    const batch = [...this.pendingQueue];
    this.pendingQueue = [];

    try {
      await fetch('/api/admin/logs/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: batch }),
      });
    } catch {
      // Avoid recursive logging if network is completely down
    }
  }

  private extractMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      try {
        return (error as any).message || (error as any).error || JSON.stringify(error).slice(0, 300);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  /**
   * Retrieve in-memory client log buffer
   */
  getRecentLogs(): ErrorLogEntry[] {
    return [...this.localLogs];
  }
}

export const errorLogger = new ErrorLoggerService();

const LEVEL_ORDER = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

type LogLevel = keyof typeof LEVEL_ORDER;

const DEFAULT_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const rawLevel =
  process.env.NEXT_PUBLIC_LOG_LEVEL?.toLowerCase() ??
  process.env.LOG_LEVEL?.toLowerCase() ??
  DEFAULT_LEVEL;

const currentLevel: LogLevel =
  rawLevel in LEVEL_ORDER ? (rawLevel as LogLevel) : DEFAULT_LEVEL;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function emit(level: LogLevel, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const method = console[level] ? level : 'info';
  const prefix = '[probonolaw-ui]';
  (console[method as keyof Console] as (...params: unknown[]) => void)(
    prefix,
    ...args,
  );
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', ...args),
  info: (...args: unknown[]) => emit('info', ...args),
  warn: (...args: unknown[]) => emit('warn', ...args),
  error: (...args: unknown[]) => emit('error', ...args),
};

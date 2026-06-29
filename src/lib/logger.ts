import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(level: string, pretty: boolean): Logger {
  return pino(pretty ? { level, transport: { target: 'pino-pretty' } } : { level });
}

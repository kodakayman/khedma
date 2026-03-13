import pino, { Logger } from "pino";

export function createLogger(level: string): Logger {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined
  });
}

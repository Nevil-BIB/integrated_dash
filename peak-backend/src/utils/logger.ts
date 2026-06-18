type LogMeta = Record<string, unknown> | undefined;

function formatMeta(meta: LogMeta): string {
  return meta ? ` ${JSON.stringify(meta)}` : "";
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    console.log(`[INFO] ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(`[WARN] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: LogMeta): void {
    console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  },
};

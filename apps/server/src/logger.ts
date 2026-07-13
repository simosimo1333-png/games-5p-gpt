export interface LogContext {
  correlationId?: string;
  event: string;
  playerId?: string | undefined;
  roomCode?: string | undefined;
  [key: string]: boolean | number | string | undefined;
}

export interface Logger {
  error(context: LogContext): void;
  info(context: LogContext): void;
  warn(context: LogContext): void;
}

const write = (level: "error" | "info" | "warn", context: LogContext): void => {
  const safe = Object.fromEntries(
    Object.entries(context).filter(([key]) => !/token|name/i.test(key)),
  );
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

export const logger: Logger = {
  error: (context) => write("error", context),
  info: (context) => write("info", context),
  warn: (context) => write("warn", context),
};

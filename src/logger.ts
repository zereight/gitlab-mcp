import { pino } from "pino";

export const createLogger = (name?: string) => {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: true,
        ignore: "pid,hostname",
      },
    },
  });
};

export const logger = createLogger("gitlab-mcp");

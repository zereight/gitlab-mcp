import { pino, type LoggerOptions } from "pino";

const isTestEnv = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

export const createLogger = (name?: string) => {
  const options: LoggerOptions = {
    name,
    level: process.env.LOG_LEVEL ?? "info",
  };

  // Skip pino-pretty transport in test environment to avoid worker thread leak
  // that prevents Jest from exiting
  if (!isTestEnv) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: true,
        ignore: "pid,hostname",
      },
    };
  }

  return pino(options);
};

export const logger = createLogger("gitlab-mcp");

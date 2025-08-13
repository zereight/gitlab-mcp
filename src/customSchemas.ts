import { z } from "zod";
import { pino } from 'pino';
const DEFAULT_NULL = process.env.DEFAULT_NULL === "true";


export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      destination: 2,
    },
  },
});

export const flexibleBoolean = z.preprocess(val => {
  if (typeof val === "boolean") {
    return val;
  }
  let result = "false";
  try {
    result = String(val).toLowerCase();
  } catch {
    return false;
  }
  return ["true", "t", "1"].includes(result);
}, z.boolean());

export const flexibleBooleanNullable = DEFAULT_NULL ? flexibleBoolean.nullable().default(null) : flexibleBoolean.nullable();

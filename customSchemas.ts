import { z } from "zod";
import { pino } from 'pino';

const logger = pino({
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

export const flexibleBoolean = z.preprocess((val) => {
    if (typeof val === 'string') {
        return val.toLowerCase()  === 'true';
    }
    return val;
}, z.boolean());
  

export const numericStringSchemaNullable = z.coerce.string().or(z.number()).transform((val, ctx) => {
  const strValue = String(val); 
  const trimmedStrValue = strValue.trim();

  if (trimmedStrValue === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a numeric string or number, but received an empty string or string with only whitespace.`,
    });
    return z.NEVER;
  }
  if (trimmedStrValue.toLowerCase() === 'null') {
      return null;
  }
  if (isNaN(Number(trimmedStrValue))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a numeric string or number, but received ${trimmedStrValue}`,
    });
    return z.NEVER;
  }
  return String(trimmedStrValue);
}).nullable();
  
  
export const numericStringSchema = z.coerce.string().transform((val, ctx) => {
  const strValue = String(val); 
  const trimmedStrValue = strValue.trim();

  if (trimmedStrValue === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a numeric string or number, but received an empty string or string with only whitespace.`,
    });
    return z.NEVER;
  }
  if (trimmedStrValue.toLowerCase() === 'null') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a numeric string or number, but received an null as string`,
    });
    return z.NEVER;
  }
  if (isNaN(Number(trimmedStrValue))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected a numeric string or number, but received ${trimmedStrValue}`,
    });
    return z.NEVER;
  }
  return String(trimmedStrValue);
});

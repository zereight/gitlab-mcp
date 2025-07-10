import { z } from "zod";

export const flexibleBoolean = z.preprocess((val) => {
    if (typeof val === 'string') {
        return val.toLowerCase()  === 'true';
    }
    return val;
}, z.boolean());
  
export const numericStringSchema = z.string().or(z.number()).transform((val, ctx) => {
    let strValue: string;
    if (typeof val === 'number') {
      strValue = String(val);
    } else {
      strValue = val;
    }
    if (strValue.trim() === '' || isNaN(Number(strValue))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected a numeric string or number, but received "${val}"`,
      });
      return z.NEVER;
    }
    return strValue;
});
  
  
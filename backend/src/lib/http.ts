import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    message: z.string(),
    issues: z.array(z.string()).optional(),
  })
  .openapi("ErrorResponse");

export const notFoundResponseSchema = z
  .object({
    found: z.literal(false),
    message: z.string(),
  })
  .openapi("NotFoundResponse");

export const successEnvelope = <T extends z.ZodTypeAny>(
  schema: T,
  name: string,
) =>
  z
    .object({
      success: z.literal(true),
      data: schema,
    })
    .openapi(name);

export const must = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
};

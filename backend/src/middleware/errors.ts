import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export const errorHandler = async (context: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      return context.json(
        {
          success: false,
          message: error.message,
        },
        error.status,
      );
    }

    if (error instanceof ZodError) {
      return context.json(
        {
          success: false,
          message: "Validation failed.",
          issues: error.issues.map((issue) => issue.message),
        },
        400,
      );
    }

    if (error instanceof Error) {
      return context.json(
        {
          success: false,
          message: error.message,
        },
        400,
      );
    }

    return context.json(
      {
        success: false,
        message: "Unexpected server error.",
      },
      500,
    );
  }
};

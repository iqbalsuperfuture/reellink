import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { isJoseJwtError, verifyAccessToken } from "../lib/auth";
import type { AppBindings } from "../lib/types";

export const authMiddleware = createMiddleware<AppBindings>(
  async (context, next) => {
    const authorization = context.req.header("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : undefined;

    if (!token) {
      throw new HTTPException(401, { message: "Missing bearer token." });
    }

    try {
      const payload = await verifyAccessToken(token);

      if (payload.tokenType !== "access" || !payload.sub || !payload.creatorId) {
        throw new HTTPException(401, { message: "Invalid access token." });
      }

      context.set("auth", payload);
      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      if (isJoseJwtError(error)) {
        throw new HTTPException(401, { message: "Invalid access token." });
      }

      throw error;
    }
  },
);

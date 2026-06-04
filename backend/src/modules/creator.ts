import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { creatorProfiles } from "../db/schema";
import { successEnvelope, errorResponseSchema } from "../lib/http";
import type { AppBindings } from "../lib/types";
import { authMiddleware } from "../middleware/auth";
import { creatorProfileSchema } from "./shared";

const updateCreatorProfileBodySchema = z
  .object({
    username: z.string().min(3).max(40).regex(/^[a-z0-9_]+$/).optional(),
    displayName: z.string().min(1).max(120).optional(),
    instagramUsername: z.string().max(40).nullable().optional(),
    avatarUrl: z.url().nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
  })
  .openapi("UpdateCreatorProfileBody");

const creatorProfileResponseSchema = successEnvelope(
  creatorProfileSchema,
  "CreatorProfileResponse",
);

const mapProfile = (profile: typeof creatorProfiles.$inferSelect) => ({
  ...profile,
  instagramUsername: profile.instagramUsername ?? null,
  avatarUrl: profile.avatarUrl ?? null,
  bio: profile.bio ?? null,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export const creatorRouter = new OpenAPIHono<AppBindings>();

creatorRouter.use("/creator/*", authMiddleware);

creatorRouter.openapi(
  createRoute({
    method: "get",
    path: "/creator/profile",
    tags: ["Creator"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Current creator profile.",
        content: {
          "application/json": {
            schema: creatorProfileResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.id, auth.creatorId),
    });

    if (!profile) {
      throw new HTTPException(404, { message: "Creator profile not found." });
    }

    return context.json({
      success: true as const,
      data: mapProfile(profile),
    });
  },
);

creatorRouter.openapi(
  createRoute({
    method: "patch",
    path: "/creator/profile",
    tags: ["Creator"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: updateCreatorProfileBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Creator profile updated.",
        content: {
          "application/json": {
            schema: creatorProfileResponseSchema,
          },
        },
      },
      409: {
        description: "Username already taken.",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const body = context.req.valid("json");

    if (body.username) {
      const sameUsername = await db.query.creatorProfiles.findFirst({
        columns: { id: true },
        where: and(
          eq(creatorProfiles.username, body.username),
          ne(creatorProfiles.id, auth.creatorId),
        ),
      });

      if (sameUsername) {
        throw new HTTPException(409, { message: "Username already in use." });
      }
    }

    const [profile] = await db
      .update(creatorProfiles)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(creatorProfiles.id, auth.creatorId))
      .returning();

    if (!profile) {
      throw new HTTPException(404, { message: "Creator profile not found." });
    }

    return context.json({
      success: true as const,
      data: mapProfile(profile),
    });
  },
);

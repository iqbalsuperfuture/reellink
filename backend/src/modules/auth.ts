import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, gt, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { creatorProfiles, refreshTokens, users } from "../db/schema";
import { buildAuthTokens, revokeRefreshToken, verifyAndLoadRefreshSession } from "../services/auth-service";
import { DEFAULT_CREATOR_PLAN } from "../lib/constants";
import { successEnvelope, errorResponseSchema } from "../lib/http";
import { createId } from "../lib/ids";
import { hashPassword, verifyPassword } from "../lib/security";
import type { AppBindings } from "../lib/types";
import { authMiddleware } from "../middleware/auth";
import {
  authTokensSchema,
  authUserSchema,
} from "./shared";

const registerBodySchema = z
  .object({
    email: z.email(),
    password: z.string().min(8).max(128),
    username: z.string().min(3).max(40).regex(/^[a-z0-9_]+$/),
    displayName: z.string().min(1).max(120),
    instagramUsername: z.string().min(1).max(40).optional(),
    avatarUrl: z.url().optional(),
    bio: z.string().max(500).optional(),
  })
  .openapi("RegisterBody");

const loginBodySchema = z
  .object({
    email: z.email(),
    password: z.string().min(8).max(128),
  })
  .openapi("LoginBody");

const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(20),
  })
  .openapi("RefreshTokenBody");

const authResponseSchema = successEnvelope(
  z.object({
    user: authUserSchema,
    tokens: authTokensSchema,
  }),
  "AuthResponse",
);

const meResponseSchema = successEnvelope(authUserSchema, "MeResponse");

const mapAuthUser = (row: {
  user: typeof users.$inferSelect;
  profile: typeof creatorProfiles.$inferSelect;
}) => ({
  id: row.user.id,
  email: row.user.email,
  role: row.user.role,
  creatorProfile: {
    ...row.profile,
    instagramUsername: row.profile.instagramUsername ?? null,
    avatarUrl: row.profile.avatarUrl ?? null,
    bio: row.profile.bio ?? null,
    createdAt: row.profile.createdAt.toISOString(),
    updatedAt: row.profile.updatedAt.toISOString(),
  },
});

const getUserWithProfile = async (userId: string) => {
  const result = await db
    .select({
      user: users,
      profile: creatorProfiles,
    })
    .from(users)
    .innerJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
};

export const authRouter = new OpenAPIHono<AppBindings>();

authRouter.openapi(
  createRoute({
    method: "post",
    path: "/auth/register",
    tags: ["Auth"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: registerBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Creator registered.",
        content: {
          "application/json": {
            schema: authResponseSchema,
          },
        },
      },
      409: {
        description: "Email or username already exists.",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const body = context.req.valid("json");

    const [existingUser, existingProfile] = await Promise.all([
      db.query.users.findFirst({
        columns: { id: true },
        where: eq(users.email, body.email),
      }),
      db.query.creatorProfiles.findFirst({
        columns: { id: true },
        where: eq(creatorProfiles.username, body.username),
      }),
    ]);

    if (existingUser) {
      throw new HTTPException(409, { message: "Email already in use." });
    }

    if (existingProfile) {
      throw new HTTPException(409, { message: "Username already in use." });
    }

    const userId = createId("usr");
    const creatorId = createId("cr");
    const passwordHash = await hashPassword(body.password);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: body.email,
        passwordHash,
        role: "CREATOR",
      });

      await tx.insert(creatorProfiles).values({
        id: creatorId,
        userId,
        username: body.username,
        displayName: body.displayName,
        instagramUsername: body.instagramUsername,
        avatarUrl: body.avatarUrl,
        bio: body.bio,
        plan: DEFAULT_CREATOR_PLAN,
      });
    });

    const row = await getUserWithProfile(userId);

    if (!row) {
      throw new HTTPException(500, { message: "Failed to create user." });
    }

    const tokens = await buildAuthTokens({
      userId,
      creatorId,
      role: "CREATOR",
    });

    return context.json(
      {
        success: true as const,
        data: {
          user: mapAuthUser(row),
          tokens,
        },
      },
      201,
    );
  },
);

authRouter.openapi(
  createRoute({
    method: "post",
    path: "/auth/login",
    tags: ["Auth"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: loginBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Creator logged in.",
        content: {
          "application/json": {
            schema: authResponseSchema,
          },
        },
      },
      401: {
        description: "Invalid credentials.",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const body = context.req.valid("json");

    const result = await db
      .select({
        user: users,
        profile: creatorProfiles,
      })
      .from(users)
      .innerJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
      .where(eq(users.email, body.email))
      .limit(1);

    const row = result[0];

    if (!row || !(await verifyPassword(row.user.passwordHash, body.password))) {
      throw new HTTPException(401, { message: "Invalid email or password." });
    }

    const tokens = await buildAuthTokens({
      userId: row.user.id,
      creatorId: row.profile.id,
      role: row.user.role,
    });

    return context.json({
      success: true as const,
      data: {
        user: mapAuthUser(row),
        tokens,
      },
    });
  },
);

authRouter.openapi(
  createRoute({
    method: "post",
    path: "/auth/refresh",
    tags: ["Auth"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: refreshBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Tokens rotated.",
        content: {
          "application/json": {
            schema: authResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const body = context.req.valid("json");
    const session = await verifyAndLoadRefreshSession(body.refreshToken);

    await revokeRefreshToken(session.refreshToken.id);

    const row = await getUserWithProfile(session.user.id);

    if (!row) {
      throw new HTTPException(401, { message: "Refresh token user not found." });
    }

    const tokens = await buildAuthTokens({
      userId: row.user.id,
      creatorId: row.profile.id,
      role: row.user.role,
    });

    return context.json({
      success: true as const,
      data: {
        user: mapAuthUser(row),
        tokens,
      },
    });
  },
);

authRouter.openapi(
  createRoute({
    method: "post",
    path: "/auth/logout",
    tags: ["Auth"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: refreshBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Refresh token revoked.",
        content: {
          "application/json": {
            schema: successEnvelope(
              z.object({ message: z.string() }),
              "LogoutResponse",
            ),
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const body = context.req.valid("json");
    const session = await verifyAndLoadRefreshSession(body.refreshToken);

    await revokeRefreshToken(session.refreshToken.id);

    return context.json({
      success: true as const,
      data: {
        message: "Logged out successfully.",
      },
    });
  },
);

authRouter.openapi(
  createRoute({
    method: "get",
    path: "/auth/me",
    tags: ["Auth"],
    security: [{ bearerAuth: [] }],
    middleware: authMiddleware,
    responses: {
      200: {
        description: "Current authenticated creator.",
        content: {
          "application/json": {
            schema: meResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const row = await getUserWithProfile(auth.sub);

    if (!row) {
      throw new HTTPException(404, { message: "User not found." });
    }

    return context.json({
      success: true as const,
      data: mapAuthUser(row),
    });
  },
);

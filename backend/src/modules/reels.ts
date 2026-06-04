import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { creatorProfiles, reels } from "../db/schema";
import { FREE_PLAN_REEL_LIMIT } from "../lib/constants";
import { must, successEnvelope } from "../lib/http";
import { normalizeInstagramReelUrl } from "../lib/instagram";
import { createId } from "../lib/ids";
import { generateUniqueReelSlug } from "../lib/slug";
import type { AppBindings } from "../lib/types";
import { authMiddleware } from "../middleware/auth";
import { reelSchema, reelVisibilitySchema } from "./shared";

const reelWriteSchema = z.object({
  instagramUrl: z.string().min(1),
  title: z.string().min(1).max(180),
  caption: z.string().max(2000).nullable().optional(),
  thumbnailUrl: z.url().nullable().optional(),
  visibility: reelVisibilitySchema.optional(),
});

const createReelBodySchema = reelWriteSchema.openapi("CreateReelBody");
const updateReelBodySchema = reelWriteSchema.partial().openapi("UpdateReelBody");

const reelResponseSchema = successEnvelope(reelSchema, "ReelResponse");
const reelsListResponseSchema = successEnvelope(
  z.array(reelSchema),
  "ReelListResponse",
);

const mapReel = (reel: typeof reels.$inferSelect) => ({
  ...reel,
  caption: reel.caption ?? null,
  thumbnailUrl: reel.thumbnailUrl ?? null,
  createdAt: reel.createdAt.toISOString(),
  updatedAt: reel.updatedAt.toISOString(),
});

const assertOwnedReel = async (reelId: string, creatorId: string) => {
  const reel = await db.query.reels.findFirst({
    where: and(eq(reels.id, reelId), eq(reels.creatorId, creatorId)),
  });

  if (!reel) {
    throw new HTTPException(404, { message: "Reel not found." });
  }

  return reel;
};

export const reelsRouter = new OpenAPIHono<AppBindings>();

reelsRouter.use("/reels/*", authMiddleware);

reelsRouter.openapi(
  createRoute({
    method: "post",
    path: "/reels",
    tags: ["Reels"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createReelBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Reel created.",
        content: {
          "application/json": {
            schema: reelResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const body = context.req.valid("json");

    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.id, auth.creatorId),
    });

    if (!profile) {
      throw new HTTPException(404, { message: "Creator profile not found." });
    }

    if (profile.plan === "FREE") {
      const [countRow] = await db
        .select({ value: count() })
        .from(reels)
        .where(eq(reels.creatorId, auth.creatorId));

      if (Number(must(countRow, "Reel count query failed.").value) >= FREE_PLAN_REEL_LIMIT) {
        throw new HTTPException(403, {
          message: `Free plan creators can map up to ${FREE_PLAN_REEL_LIMIT} reels.`,
        });
      }
    }

    const { normalizedUrl, shortcode } = normalizeInstagramReelUrl(body.instagramUrl);
    const slug = await generateUniqueReelSlug(body.title);

    const [reel] = await db
      .insert(reels)
      .values({
        id: createId("reel"),
        creatorId: auth.creatorId,
        instagramUrl: normalizedUrl,
        instagramShortcode: shortcode,
        title: body.title,
        caption: body.caption ?? null,
        thumbnailUrl: body.thumbnailUrl ?? null,
        slug,
        visibility: body.visibility ?? "PUBLIC",
      })
      .returning();

    return context.json(
      {
        success: true as const,
        data: mapReel(must(reel, "Created reel was not returned.")),
      },
      201,
    );
  },
);

reelsRouter.openapi(
  createRoute({
    method: "get",
    path: "/reels",
    tags: ["Reels"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "List creator reels.",
        content: {
          "application/json": {
            schema: reelsListResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const rows = await db.query.reels.findMany({
      where: eq(reels.creatorId, auth.creatorId),
      orderBy: [asc(reels.createdAt)],
    });

    return context.json({
      success: true as const,
      data: rows.map(mapReel),
    });
  },
);

reelsRouter.openapi(
  createRoute({
    method: "get",
    path: "/reels/{id}",
    tags: ["Reels"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: "Get a creator reel.",
        content: {
          "application/json": {
            schema: reelResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { id } = context.req.valid("param");
    const reel = await assertOwnedReel(id, auth.creatorId);

    return context.json({
      success: true as const,
      data: mapReel(reel),
    });
  },
);

reelsRouter.openapi(
  createRoute({
    method: "patch",
    path: "/reels/{id}",
    tags: ["Reels"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: updateReelBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Reel updated.",
        content: {
          "application/json": {
            schema: reelResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { id } = context.req.valid("param");
    const body = context.req.valid("json");
    const current = await assertOwnedReel(id, auth.creatorId);

    const normalized = body.instagramUrl
      ? normalizeInstagramReelUrl(body.instagramUrl)
      : null;
    const slug = body.title
      ? await generateUniqueReelSlug(body.title, current.id)
      : current.slug;

    const [reel] = await db
      .update(reels)
      .set({
        instagramUrl: normalized?.normalizedUrl ?? current.instagramUrl,
        instagramShortcode: normalized?.shortcode ?? current.instagramShortcode,
        title: body.title ?? current.title,
        caption:
          body.caption === undefined ? current.caption : (body.caption ?? null),
        thumbnailUrl:
          body.thumbnailUrl === undefined
            ? current.thumbnailUrl
            : (body.thumbnailUrl ?? null),
        visibility: body.visibility ?? current.visibility,
        slug,
        updatedAt: new Date(),
      })
      .where(eq(reels.id, current.id))
      .returning();

    return context.json({
      success: true as const,
      data: mapReel(must(reel, "Updated reel was not returned.")),
    });
  },
);

reelsRouter.openapi(
  createRoute({
    method: "delete",
    path: "/reels/{id}",
    tags: ["Reels"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: "Reel deleted.",
        content: {
          "application/json": {
            schema: successEnvelope(
              z.object({ message: z.string() }),
              "DeleteReelResponse",
            ),
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { id } = context.req.valid("param");
    await assertOwnedReel(id, auth.creatorId);

    await db.delete(reels).where(eq(reels.id, id));

    return context.json({
      success: true as const,
      data: {
        message: "Reel deleted successfully.",
      },
    });
  },
);

const publishRoute = (path: "/reels/{id}/publish" | "/reels/{id}/unpublish") =>
  createRoute({
    method: "post",
    path,
    tags: ["Reels"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: "Reel state updated.",
        content: {
          "application/json": {
            schema: reelResponseSchema,
          },
        },
      },
    },
  });

reelsRouter.openapi(publishRoute("/reels/{id}/publish"), async (context): Promise<any> => {
  const auth = context.get("auth");
  const { id } = context.req.valid("param");
  await assertOwnedReel(id, auth.creatorId);

  const [reel] = await db
    .update(reels)
    .set({ status: "PUBLISHED", updatedAt: new Date() })
    .where(eq(reels.id, id))
    .returning();

  return context.json({
    success: true as const,
    data: mapReel(must(reel, "Published reel was not returned.")),
  });
});

reelsRouter.openapi(publishRoute("/reels/{id}/unpublish"), async (context): Promise<any> => {
  const auth = context.get("auth");
  const { id } = context.req.valid("param");
  await assertOwnedReel(id, auth.creatorId);

  const [reel] = await db
    .update(reels)
    .set({ status: "DRAFT", updatedAt: new Date() })
    .where(eq(reels.id, id))
    .returning();

  return context.json({
    success: true as const,
    data: mapReel(must(reel, "Unpublished reel was not returned.")),
  });
});

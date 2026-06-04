import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { analyticsEvents, reels, resources } from "../db/schema";
import { detectDeviceType } from "../lib/device";
import { must, successEnvelope } from "../lib/http";
import { createId } from "../lib/ids";
import { sha256 } from "../lib/security";
import type { AppBindings } from "../lib/types";
import { authMiddleware } from "../middleware/auth";
import { analyticsEventTypeSchema } from "./shared";

const analyticsEventBodySchema = z
  .object({
    eventType: analyticsEventTypeSchema,
    reelId: z.string().optional(),
    resourceId: z.string().optional(),
    referrer: z.url().optional(),
    country: z.string().length(2).optional(),
    deviceType: z.enum(["MOBILE", "TABLET", "DESKTOP", "UNKNOWN"]).optional(),
  })
  .openapi("AnalyticsEventBody");

const analyticsEventResponseSchema = successEnvelope(
  z.object({ id: z.string() }),
  "AnalyticsEventResponse",
);

const analyticsOverviewSchema = z
  .object({
    totalReels: z.number().int(),
    publishedReels: z.number().int(),
    totalViews: z.number().int(),
    totalClicks: z.number().int(),
    ctr: z.number(),
    topReels: z.array(
      z.object({
        reelId: z.string(),
        title: z.string(),
        slug: z.string(),
        views: z.number().int(),
        clicks: z.number().int(),
      }),
    ),
  })
  .openapi("AnalyticsOverview");

const reelAnalyticsSchema = z
  .object({
    reelId: z.string(),
    title: z.string(),
    slug: z.string(),
    views: z.number().int(),
    clicks: z.number().int(),
    ctr: z.number(),
  })
  .openapi("ReelAnalytics");

const analyticsOverviewResponseSchema = successEnvelope(
  analyticsOverviewSchema,
  "AnalyticsOverviewResponse",
);
const analyticsReelsResponseSchema = successEnvelope(
  z.array(reelAnalyticsSchema),
  "AnalyticsReelsResponse",
);
const analyticsReelDetailResponseSchema = successEnvelope(
  reelAnalyticsSchema,
  "AnalyticsReelDetailResponse",
);

const toNumber = (value: unknown) => Number(value ?? 0);

const resolveCreatorContext = async (input: {
  reelId?: string;
  resourceId?: string;
}) => {
  if (input.resourceId) {
    const row = await db
      .select({
        resourceId: resources.id,
        reelId: reels.id,
        creatorId: reels.creatorId,
      })
      .from(resources)
      .innerJoin(reels, eq(resources.reelId, reels.id))
      .where(eq(resources.id, input.resourceId))
      .limit(1);

    return row[0] ?? null;
  }

  if (input.reelId) {
    const row = await db
      .select({
        reelId: reels.id,
        creatorId: reels.creatorId,
      })
      .from(reels)
      .where(eq(reels.id, input.reelId))
      .limit(1);

    return row[0] ?? null;
  }

  return null;
};

const buildReelAnalytics = async (creatorId: string) => {
  const rows = await db
    .select({
      reelId: reels.id,
      title: reels.title,
      slug: reels.slug,
      views: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'REEL_VIEW')`,
      clicks: sql<number>`count(*) filter (where ${analyticsEvents.eventType} in ('RESOURCE_CLICK', 'DOWNLOAD_CLICK'))`,
    })
    .from(reels)
    .leftJoin(analyticsEvents, eq(analyticsEvents.reelId, reels.id))
    .where(eq(reels.creatorId, creatorId))
    .groupBy(reels.id)
    .orderBy(
      desc(
        sql`count(*) filter (where ${analyticsEvents.eventType} = 'REEL_VIEW')`,
      ),
    );

  return rows.map((row) => {
    const views = toNumber(row.views);
    const clicks = toNumber(row.clicks);
    return {
      reelId: row.reelId,
      title: row.title,
      slug: row.slug,
      views,
      clicks,
      ctr: views === 0 ? 0 : Number(((clicks / views) * 100).toFixed(2)),
    };
  });
};

export const analyticsRouter = new OpenAPIHono<AppBindings>();

analyticsRouter.openapi(
  createRoute({
    method: "post",
    path: "/analytics/event",
    tags: ["Analytics"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: analyticsEventBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Analytics event stored.",
        content: {
          "application/json": {
            schema: analyticsEventResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const body = context.req.valid("json");
    const creatorContext = await resolveCreatorContext(body);

    if (!creatorContext?.creatorId) {
      throw new HTTPException(400, {
        message: "A valid reelId or resourceId is required for analytics events.",
      });
    }

    const ipAddress =
      context.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      context.req.header("x-real-ip") ??
      "0.0.0.0";
    const userAgent = context.req.header("user-agent");

    const [event] = await db
      .insert(analyticsEvents)
      .values({
        id: createId("evt"),
        creatorId: creatorContext.creatorId,
        reelId: body.reelId ?? creatorContext.reelId ?? null,
        resourceId: body.resourceId ?? null,
        eventType: body.eventType,
        ipHash: sha256(ipAddress),
        userAgent: userAgent ?? null,
        referrer: body.referrer ?? context.req.header("referer") ?? null,
        country:
          (body.country ?? context.req.header("cf-ipcountry"))?.toUpperCase() ??
          null,
        deviceType: body.deviceType ?? detectDeviceType(userAgent),
      })
      .returning({ id: analyticsEvents.id });

    return context.json(
      {
        success: true as const,
        data: must(event, "Created analytics event was not returned."),
      },
      201,
    );
  },
);

analyticsRouter.use("/creator/analytics/*", authMiddleware);

analyticsRouter.openapi(
  createRoute({
    method: "get",
    path: "/creator/analytics/overview",
    tags: ["Analytics"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Creator analytics overview.",
        content: {
          "application/json": {
            schema: analyticsOverviewResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const reelStats = await buildReelAnalytics(auth.creatorId);
    const totalViews = reelStats.reduce((sum, row) => sum + row.views, 0);
    const totalClicks = reelStats.reduce((sum, row) => sum + row.clicks, 0);

    const [[totalReels], [publishedReels]] = await Promise.all([
      db.select({ value: count() }).from(reels).where(eq(reels.creatorId, auth.creatorId)),
      db
        .select({ value: count() })
        .from(reels)
        .where(and(eq(reels.creatorId, auth.creatorId), eq(reels.status, "PUBLISHED"))),
    ]);

    return context.json({
      success: true as const,
      data: {
        totalReels: toNumber(totalReels?.value),
        publishedReels: toNumber(publishedReels?.value),
        totalViews,
        totalClicks,
        ctr: totalViews === 0 ? 0 : Number(((totalClicks / totalViews) * 100).toFixed(2)),
        topReels: reelStats.slice(0, 5),
      },
    });
  },
);

analyticsRouter.openapi(
  createRoute({
    method: "get",
    path: "/creator/analytics/reels",
    tags: ["Analytics"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Per-reel analytics for the current creator.",
        content: {
          "application/json": {
            schema: analyticsReelsResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const analytics = await buildReelAnalytics(auth.creatorId);

    return context.json({
      success: true as const,
      data: analytics,
    });
  },
);

analyticsRouter.openapi(
  createRoute({
    method: "get",
    path: "/creator/analytics/reels/{id}",
    tags: ["Analytics"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: "Analytics for a single creator reel.",
        content: {
          "application/json": {
            schema: analyticsReelDetailResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { id } = context.req.valid("param");
    const analytics = await buildReelAnalytics(auth.creatorId);
    const reel = analytics.find((item) => item.reelId === id);

    if (!reel) {
      throw new HTTPException(404, { message: "Analytics reel not found." });
    }

    return context.json({
      success: true as const,
      data: reel,
    });
  },
);

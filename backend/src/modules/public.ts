import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { creatorProfiles, reels, resources } from "../db/schema";
import { must, notFoundResponseSchema, successEnvelope } from "../lib/http";
import { extractInstagramShortcode } from "../lib/instagram";
import type { AppBindings } from "../lib/types";
import { creatorSummarySchema } from "./shared";

const resolveBodySchema = z
  .object({
    instagramUrl: z.string().min(1),
  })
  .openapi("ResolveReelBody");

const publicResourceSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    url: z.string(),
    price: z.string().nullable(),
    currency: z.string().nullable(),
    position: z.number().int(),
  })
  .openapi("PublicResource");

const publicReelPayloadSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    thumbnailUrl: z.string().nullable(),
    creator: creatorSummarySchema,
    resources: z.array(publicResourceSchema),
  })
  .openapi("PublicReelPayload");

const resolveFoundSchema = z
  .object({
    found: z.literal(true),
    reel: publicReelPayloadSchema,
  })
  .openapi("ResolveFoundResponse");

const publicReelResponseSchema = successEnvelope(
  publicReelPayloadSchema,
  "PublicReelResponse",
);

const mapPublicPayload = async (slugOrShortcode: {
  slug?: string;
  shortcode?: string;
}) => {
  const matchCondition = slugOrShortcode.slug
    ? eq(reels.slug, slugOrShortcode.slug)
    : eq(reels.instagramShortcode, slugOrShortcode.shortcode!);

  const result = await db
    .select({
      reel: reels,
      creator: creatorProfiles,
      resource: resources,
    })
    .from(reels)
    .innerJoin(creatorProfiles, eq(reels.creatorId, creatorProfiles.id))
    .leftJoin(
      resources,
      and(eq(resources.reelId, reels.id), eq(resources.isActive, true)),
    )
    .where(
      and(
        matchCondition,
        eq(reels.status, "PUBLISHED"),
        eq(reels.visibility, "PUBLIC"),
      ),
    )
    .orderBy(asc(resources.position), asc(resources.createdAt));

  if (!result.length) {
    return null;
  }

  const first = must(result[0], "Public reel query did not return a row.");

  return {
    id: first.reel.id,
    title: first.reel.title,
    slug: first.reel.slug,
    thumbnailUrl: first.reel.thumbnailUrl ?? null,
    creator: {
      username: first.creator.username,
      displayName: first.creator.displayName,
      avatarUrl: first.creator.avatarUrl ?? null,
    },
    resources: result
      .filter((row) => row.resource)
      .map((row) => ({
        id: row.resource!.id,
        type: row.resource!.type,
        title: row.resource!.title,
        url: row.resource!.url,
        price: row.resource!.price ?? null,
        currency: row.resource!.currency ?? null,
        position: row.resource!.position,
      })),
  };
};

export const publicRouter = new OpenAPIHono<AppBindings>();

publicRouter.openapi(
  createRoute({
    method: "post",
    path: "/public/resolve-reel",
    tags: ["Public"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: resolveBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Mapped public reel found.",
        content: {
          "application/json": {
            schema: resolveFoundSchema,
            example: {
              found: true,
              reel: {
                id: "reel_123",
                title: "Summer Outfit Ideas",
                slug: "summer-outfit-ideas",
                thumbnailUrl: "https://example.com/thumbnail.jpg",
                creator: {
                  username: "style_by_ana",
                  displayName: "Ana",
                  avatarUrl: "https://example.com/avatar.jpg",
                },
                resources: [
                  {
                    id: "res_123",
                    type: "PRODUCT",
                    title: "Linen Green Dress",
                    url: "https://example.com",
                    price: "49.99",
                    currency: "USD",
                    position: 1,
                  },
                ],
              },
            },
          },
        },
      },
      404: {
        description: "Mapped reel not found.",
        content: {
          "application/json": {
            schema: notFoundResponseSchema,
            example: {
              found: false,
              message: "No ReelLink page found for this Reel yet.",
            },
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const { instagramUrl } = context.req.valid("json");
    const shortcode = extractInstagramShortcode(instagramUrl);
    const reel = await mapPublicPayload({ shortcode });

    if (!reel) {
      return context.json(
        {
          found: false as const,
          message: "No ReelLink page found for this Reel yet.",
        },
        404,
      );
    }

    return context.json({
      found: true as const,
      reel,
    });
  },
);

publicRouter.openapi(
  createRoute({
    method: "get",
    path: "/public/reels/{slug}",
    tags: ["Public"],
    request: {
      params: z.object({ slug: z.string() }),
    },
    responses: {
      200: {
        description: "Public reel landing page payload.",
        content: {
          "application/json": {
            schema: publicReelResponseSchema,
          },
        },
      },
      404: {
        description: "Public reel not found.",
        content: {
          "application/json": {
            schema: notFoundResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const { slug } = context.req.valid("param");
    const reel = await mapPublicPayload({ slug });

    if (!reel) {
      throw new HTTPException(404, {
        message: "No ReelLink page found for this Reel yet.",
      });
    }

    return context.json({
      success: true as const,
      data: reel,
    });
  },
);

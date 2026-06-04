import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { reels, resources } from "../db/schema";
import { must, successEnvelope } from "../lib/http";
import { createId } from "../lib/ids";
import type { AppBindings } from "../lib/types";
import { assertSafeUrl } from "../lib/url";
import { authMiddleware } from "../middleware/auth";
import { resourceSchema, resourceTypeSchema } from "./shared";

const resourceWriteSchema = z.object({
  type: resourceTypeSchema,
  title: z.string().min(1).max(180),
  description: z.string().max(1000).nullable().optional(),
  url: z.url(),
  imageUrl: z.url().nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  currency: z.string().length(3).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  position: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const createResourceBodySchema = resourceWriteSchema.openapi("CreateResourceBody");
const updateResourceBodySchema = resourceWriteSchema
  .partial()
  .openapi("UpdateResourceBody");
const reorderBodySchema = z
  .object({
    resourceIds: z.array(z.string()).min(1),
  })
  .openapi("ReorderResourcesBody");

const resourceResponseSchema = successEnvelope(resourceSchema, "ResourceResponse");
const resourcesListResponseSchema = successEnvelope(
  z.array(resourceSchema),
  "ResourceListResponse",
);

const mapResource = (resource: typeof resources.$inferSelect) => ({
  ...resource,
  description: resource.description ?? null,
  imageUrl: resource.imageUrl ?? null,
  price: resource.price ?? null,
  currency: resource.currency ?? null,
  brand: resource.brand ?? null,
  category: resource.category ?? null,
  createdAt: resource.createdAt.toISOString(),
  updatedAt: resource.updatedAt.toISOString(),
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

const assertOwnedResource = async (resourceId: string, creatorId: string) => {
  const result = await db
    .select({
      resource: resources,
      reel: reels,
    })
    .from(resources)
    .innerJoin(reels, eq(resources.reelId, reels.id))
    .where(and(eq(resources.id, resourceId), eq(reels.creatorId, creatorId)))
    .limit(1);

  const row = result[0];

  if (!row) {
    throw new HTTPException(404, { message: "Resource not found." });
  }

  return row;
};

export const resourcesRouter = new OpenAPIHono<AppBindings>();

resourcesRouter.use("/reels/*", authMiddleware);
resourcesRouter.use("/resources/*", authMiddleware);

resourcesRouter.openapi(
  createRoute({
    method: "post",
    path: "/reels/{reelId}/resources",
    tags: ["Resources"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ reelId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: createResourceBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Resource created.",
        content: {
          "application/json": {
            schema: resourceResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { reelId } = context.req.valid("param");
    const body = context.req.valid("json");

    await assertOwnedReel(reelId, auth.creatorId);

    const [resource] = await db
      .insert(resources)
      .values({
        id: createId("res"),
        reelId,
        type: body.type,
        title: body.title,
        description: body.description ?? null,
        url: assertSafeUrl(body.url),
        imageUrl: body.imageUrl ?? null,
        price: body.price ?? null,
        currency: body.currency ?? null,
        brand: body.brand ?? null,
        category: body.category ?? null,
        position: body.position ?? 1,
        isActive: body.isActive ?? true,
      })
      .returning();

    return context.json(
      {
        success: true as const,
        data: mapResource(must(resource, "Created resource was not returned.")),
      },
      201,
    );
  },
);

resourcesRouter.openapi(
  createRoute({
    method: "get",
    path: "/reels/{reelId}/resources",
    tags: ["Resources"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ reelId: z.string() }),
    },
    responses: {
      200: {
        description: "List reel resources.",
        content: {
          "application/json": {
            schema: resourcesListResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { reelId } = context.req.valid("param");

    await assertOwnedReel(reelId, auth.creatorId);

    const rows = await db.query.resources.findMany({
      where: eq(resources.reelId, reelId),
      orderBy: [asc(resources.position), asc(resources.createdAt)],
    });

    return context.json({
      success: true as const,
      data: rows.map(mapResource),
    });
  },
);

resourcesRouter.openapi(
  createRoute({
    method: "patch",
    path: "/resources/{id}",
    tags: ["Resources"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: updateResourceBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Resource updated.",
        content: {
          "application/json": {
            schema: resourceResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { id } = context.req.valid("param");
    const body = context.req.valid("json");
    const { resource } = await assertOwnedResource(id, auth.creatorId);

    const [updated] = await db
      .update(resources)
      .set({
        type: body.type ?? resource.type,
        title: body.title ?? resource.title,
        description:
          body.description === undefined
            ? resource.description
            : (body.description ?? null),
        url: body.url ? assertSafeUrl(body.url) : resource.url,
        imageUrl:
          body.imageUrl === undefined ? resource.imageUrl : (body.imageUrl ?? null),
        price: body.price === undefined ? resource.price : (body.price ?? null),
        currency:
          body.currency === undefined ? resource.currency : (body.currency ?? null),
        brand: body.brand === undefined ? resource.brand : (body.brand ?? null),
        category:
          body.category === undefined
            ? resource.category
            : (body.category ?? null),
        position: body.position ?? resource.position,
        isActive: body.isActive ?? resource.isActive,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, resource.id))
      .returning();

    return context.json({
      success: true as const,
      data: mapResource(must(updated, "Updated resource was not returned.")),
    });
  },
);

resourcesRouter.openapi(
  createRoute({
    method: "delete",
    path: "/resources/{id}",
    tags: ["Resources"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: "Resource deleted.",
        content: {
          "application/json": {
            schema: successEnvelope(
              z.object({ message: z.string() }),
              "DeleteResourceResponse",
            ),
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { id } = context.req.valid("param");
    const { resource } = await assertOwnedResource(id, auth.creatorId);

    await db.delete(resources).where(eq(resources.id, resource.id));

    return context.json({
      success: true as const,
      data: {
        message: "Resource deleted successfully.",
      },
    });
  },
);

resourcesRouter.openapi(
  createRoute({
    method: "patch",
    path: "/reels/{reelId}/resources/reorder",
    tags: ["Resources"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ reelId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: reorderBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Resources reordered.",
        content: {
          "application/json": {
            schema: resourcesListResponseSchema,
          },
        },
      },
    },
  }),
  async (context): Promise<any> => {
    const auth = context.get("auth");
    const { reelId } = context.req.valid("param");
    const { resourceIds } = context.req.valid("json");

    await assertOwnedReel(reelId, auth.creatorId);

    const ownedResources = await db.query.resources.findMany({
      where: and(eq(resources.reelId, reelId), inArray(resources.id, resourceIds)),
    });

    if (ownedResources.length !== resourceIds.length) {
      throw new HTTPException(400, {
        message: "Every resource ID must belong to the reel.",
      });
    }

    await db.transaction(async (tx) => {
      await Promise.all(
        resourceIds.map((resourceId, index) =>
          tx
            .update(resources)
            .set({ position: index + 1, updatedAt: new Date() })
            .where(eq(resources.id, resourceId)),
        ),
      );
    });

    const rows = await db.query.resources.findMany({
      where: eq(resources.reelId, reelId),
      orderBy: [asc(resources.position), asc(resources.createdAt)],
    });

    return context.json({
      success: true as const,
      data: rows.map(mapResource),
    });
  },
);

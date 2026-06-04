import { z } from "@hono/zod-openapi";

export const userRoleSchema = z.enum(["CREATOR", "ADMIN"]).openapi("UserRole");
export const creatorPlanSchema = z
  .enum(["FREE", "PRO"])
  .openapi("CreatorPlan");
export const reelStatusSchema = z
  .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
  .openapi("ReelStatus");
export const reelVisibilitySchema = z
  .enum(["PUBLIC", "PRIVATE"])
  .openapi("ReelVisibility");
export const resourceTypeSchema = z
  .enum([
    "PRODUCT",
    "AFFILIATE",
    "DOWNLOAD",
    "BLOG",
    "RECIPE",
    "YOUTUBE",
    "MAP",
    "COUPON",
    "CUSTOM",
  ])
  .openapi("ResourceType");
export const analyticsEventTypeSchema = z
  .enum([
    "REEL_VIEW",
    "RESOURCE_CLICK",
    "DOWNLOAD_CLICK",
    "PROFILE_VIEW",
    "SAVE_REEL",
  ])
  .openapi("AnalyticsEventType");

export const creatorSummarySchema = z
  .object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .openapi("CreatorSummary");

export const creatorProfileSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    username: z.string(),
    displayName: z.string(),
    instagramUsername: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    plan: creatorPlanSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("CreatorProfile");

export const resourceSchema = z
  .object({
    id: z.string(),
    reelId: z.string(),
    type: resourceTypeSchema,
    title: z.string(),
    description: z.string().nullable(),
    url: z.string(),
    imageUrl: z.string().nullable(),
    price: z.string().nullable(),
    currency: z.string().nullable(),
    brand: z.string().nullable(),
    category: z.string().nullable(),
    position: z.number().int(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Resource");

export const reelSchema = z
  .object({
    id: z.string(),
    creatorId: z.string(),
    instagramUrl: z.string(),
    instagramShortcode: z.string(),
    title: z.string(),
    caption: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    slug: z.string(),
    status: reelStatusSchema,
    visibility: reelVisibilitySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Reel");

export const authUserSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    role: userRoleSchema,
    creatorProfile: creatorProfileSchema,
  })
  .openapi("AuthUser");

export const authTokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi("AuthTokens");

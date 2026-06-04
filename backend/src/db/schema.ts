import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["CREATOR", "ADMIN"]);
export const creatorPlanEnum = pgEnum("creator_plan", ["FREE", "PRO"]);
export const reelStatusEnum = pgEnum("reel_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export const reelVisibilityEnum = pgEnum("reel_visibility", [
  "PUBLIC",
  "PRIVATE",
]);
export const resourceTypeEnum = pgEnum("resource_type", [
  "PRODUCT",
  "AFFILIATE",
  "DOWNLOAD",
  "BLOG",
  "RECIPE",
  "YOUTUBE",
  "MAP",
  "COUPON",
  "CUSTOM",
]);
export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "REEL_VIEW",
  "RESOURCE_CLICK",
  "DOWNLOAD_CLICK",
  "PROFILE_VIEW",
  "SAVE_REEL",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").default("CREATOR").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const creatorProfiles = pgTable(
  "creator_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 40 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    instagramUsername: varchar("instagram_username", { length: 40 }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    plan: creatorPlanEnum("plan").default("FREE").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("creator_profiles_user_id_idx").on(table.userId),
    uniqueIndex("creator_profiles_username_idx").on(table.username),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.userId)],
);

export const reels = pgTable(
  "reels",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    instagramUrl: text("instagram_url").notNull(),
    instagramShortcode: varchar("instagram_shortcode", { length: 100 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    caption: text("caption"),
    thumbnailUrl: text("thumbnail_url"),
    slug: varchar("slug", { length: 220 }).notNull(),
    status: reelStatusEnum("status").default("DRAFT").notNull(),
    visibility: reelVisibilityEnum("visibility").default("PUBLIC").notNull(),
    ...timestamps,
  },
  (table) => [
    index("reels_creator_id_idx").on(table.creatorId),
    uniqueIndex("reels_shortcode_idx").on(table.instagramShortcode),
    uniqueIndex("reels_slug_idx").on(table.slug),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    reelId: text("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    type: resourceTypeEnum("type").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    price: numeric("price", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }),
    brand: varchar("brand", { length: 120 }),
    category: varchar("category", { length: 120 }),
    position: integer("position").default(1).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("resources_reel_id_idx").on(table.reelId)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    reelId: text("reel_id").references(() => reels.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").references(() => resources.id, {
      onDelete: "cascade",
    }),
    eventType: analyticsEventTypeEnum("event_type").notNull(),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    country: varchar("country", { length: 2 }),
    deviceType: varchar("device_type", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_creator_id_idx").on(table.creatorId),
    index("analytics_reel_id_idx").on(table.reelId),
    index("analytics_created_at_idx").on(table.createdAt),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  creatorProfile: one(creatorProfiles, {
    fields: [users.id],
    references: [creatorProfiles.userId],
  }),
  refreshTokens: many(refreshTokens),
}));

export const creatorProfilesRelations = relations(
  creatorProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [creatorProfiles.userId],
      references: [users.id],
    }),
    reels: many(reels),
  }),
);

export const reelsRelations = relations(reels, ({ one, many }) => ({
  creator: one(creatorProfiles, {
    fields: [reels.creatorId],
    references: [creatorProfiles.id],
  }),
  resources: many(resources),
  analyticsEvents: many(analyticsEvents),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  reel: one(reels, {
    fields: [resources.reelId],
    references: [reels.id],
  }),
  analyticsEvents: many(analyticsEvents),
}));

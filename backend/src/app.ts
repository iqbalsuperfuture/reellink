import { apiReference } from "@scalar/hono-api-reference";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { errorHandler } from "./middleware/errors";
import { analyticsRouter } from "./modules/analytics";
import { authRouter } from "./modules/auth";
import { creatorRouter } from "./modules/creator";
import { publicRouter } from "./modules/public";
import { reelsRouter } from "./modules/reels";
import { resourcesRouter } from "./modules/resources";
import type { AppBindings } from "./lib/types";

export const createApp = () => {
  const app = new OpenAPIHono<AppBindings>();

  app.use("*", errorHandler);

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "ReelLink API",
      version: "1.0.0",
      description:
        "Backend API for mapping Instagram Reels to landing pages with creator resources and analytics.",
    },
    servers: [{ url: "http://localhost:3000" }],
  });

  app.get(
    "/docs",
    apiReference({
      theme: "moon",
      spec: {
        url: "/openapi.json",
      },
    }),
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/health",
      tags: ["Health"],
      responses: {
        200: {
          description: "Health check.",
          content: {
            "application/json": {
              schema: z.object({
                success: z.literal(true),
                data: z.object({
                  status: z.literal("ok"),
                }),
              }),
            },
          },
        },
      },
    }),
    (context): any =>
      context.json({
        success: true as const,
        data: { status: "ok" as const },
      }),
  );

  app.route("/", authRouter);
  app.route("/", creatorRouter);
  app.route("/", reelsRouter);
  app.route("/", resourcesRouter);
  app.route("/", publicRouter);
  app.route("/", analyticsRouter);

  app.notFound((context) =>
    context.json(
      {
        success: false,
        message: "Route not found.",
      },
      404,
    ),
  );

  return app;
};

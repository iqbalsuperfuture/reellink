import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

export default {
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: env.PORT,
};

console.log(`ReelLink API listening on http://localhost:${env.PORT}`);

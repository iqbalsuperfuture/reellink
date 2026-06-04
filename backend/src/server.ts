import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

export default {
  fetch: app.fetch,
  port: env.PORT,
};

console.log(`ReelLink API listening on http://localhost:${env.PORT}`);

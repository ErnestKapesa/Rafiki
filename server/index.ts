import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app, mock, warmUp } from "./app.js";
import { models } from "./nebius.js";

// Local / container entrypoint. On Vercel, api/[[...route]].ts serves the same app.
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT || 8787);
await warmUp();
serve({ fetch: app.fetch, port }, () => {
  console.log(`🪐 Rafiki agent on http://localhost:${port} ${mock ? "(MOCK MODE — add keys to .env)" : ""}`);
  console.log(`   fast=${models.fast}\n   smart=${models.smart}\n   deep=${models.deep}`);
});

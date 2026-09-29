import { handle } from "hono/vercel";
import { app } from "../server/app.js";

// Vercel Function (Node.js runtime, Web Request/Response → SSE streams through).
// Max duration is set in vercel.json.

export const GET = handle(app);
export const POST = handle(app);

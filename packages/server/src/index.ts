import path from "node:path";
import { config } from "dotenv";

// Load .env from monorepo root (src/ → server/ → packages/ → root)
config({ path: path.resolve(__dirname, "../../../.env") });

import bodyParser from "koa-bodyparser";
import Router from "@koa/router";
import { bgioServer } from "./bgio/server";
import { createSessionMiddleware } from "./api/middleware/session";
import { passportInit, passportSession } from "./api/middleware/passport";
import authRouter from "./api/routes/auth";
import healthRouter from "./api/routes/health";
import mapsRouter from "./api/routes/maps";

const { app, router: bgioRouter } = bgioServer;

// Attach app-level middleware to the boardgame.io Koa app
app.keys = [process.env["SESSION_SECRET"] ?? "dev-secret-change-me"];
app.use(createSessionMiddleware(app));
app.use(passportInit);
app.use(passportSession);

// Mount custom routes under /api, with body parsing scoped only to /api
// to avoid consuming the request body before boardgame.io's own body parser.
const apiRouter = new Router({ prefix: "/api" });
apiRouter.use(bodyParser());
apiRouter.use(authRouter.routes());
apiRouter.use(healthRouter.routes());
apiRouter.use(mapsRouter.routes());

app.use(apiRouter.routes());
app.use(bgioRouter.routes());

const PORT = Number(process.env["PORT"] ?? 8000);
bgioServer.run(PORT, () => {
  console.log(`Server listening on :${PORT}`);
  console.log(`  boardgame.io: http://localhost:${PORT}/games`);
  console.log(`  Health:       http://localhost:${PORT}/api/health`);
});

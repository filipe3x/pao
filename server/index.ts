import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, initSchema } from "./db.js";
import { recipesRouter } from "./routes/recipes.js";
import { adminRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// Inicialização do DB acontece no boot — fail-fast se o ficheiro não for escrevível.
initSchema(getDb());

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/admin", adminRouter);
app.use("/api/recipes", recipesRouter);

// SPA fallback em produção (servir client/dist).
if (isProd) {
  const clientDist = path.resolve(__dirname, "../client/dist");
  // Assets com hash no nome → cache imutável.
  app.use(
    "/assets",
    express.static(path.join(clientDist, "assets"), { maxAge: "1y", immutable: true })
  );
  // Resto (incluindo sw.js, manifest, index.html) → sem cache agressivo.
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html") || filePath.endsWith("sw.js") || filePath.endsWith(".webmanifest")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      }
    })
  );
  app.get(/^\/(?!api|healthz).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server]", err);
  res.status(500).json({ error: err.message ?? "internal_error" });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (${isProd ? "production" : "development"})`);
});

import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import app from "./app.js";

const server = express();
const distPath = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT || 3001);
const dataMode = process.env.APP_DATA_MODE === "demo" ? "demo" : "database";

server.use(app);

if (existsSync(distPath)) {
  server.use(express.static(distPath));
  server.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    return res.sendFile(resolve(distPath, "index.html"));
  });
}

const listener = server.listen(port, () => {
  console.log(`Chakula Control server running on http://localhost:${port} (${dataMode} mode)`);
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down Chakula Control...`);
  listener.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import app from "./app.js";

const server = express();
const distPath = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT || 3001);

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

server.listen(port, () => {
  console.log(`Chakula Control API running on http://localhost:${port}`);
});

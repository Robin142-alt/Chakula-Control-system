import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../server/db.js";

const targetFile = process.argv[2];

if (!targetFile) {
  console.error("Usage: node scripts/run-sql.js <path-to-sql-file>");
  process.exit(1);
}

const absolutePath = resolve(process.cwd(), targetFile);
const sql = await readFile(absolutePath, "utf8");

await pool.query(sql);
await pool.end();

console.log(`Applied SQL from ${absolutePath}`);


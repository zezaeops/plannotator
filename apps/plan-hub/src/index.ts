import { join } from "path";
import { homedir } from "os";
import { initDatabase } from "./db";
import { handleRequest } from "./router";

const port = parseInt(process.env.HUB_PORT || "19434", 10);
const dbPath =
  process.env.HUB_DB_PATH || join(homedir(), ".plannotator", "hub.sqlite");
const token = process.env.PLANNOTATOR_HUB_TOKEN || undefined;

const db = initDatabase(dbPath);

Bun.serve({
  port,
  async fetch(req) {
    return handleRequest(req, db, token);
  },
});

console.log(`Plan Hub running on http://localhost:${port}`);
console.log(`Database: ${dbPath}`);
if (token) {
  console.log("Auth: Bearer token required for /api/sync");
} else {
  console.log("Auth: No token configured (open access)");
}

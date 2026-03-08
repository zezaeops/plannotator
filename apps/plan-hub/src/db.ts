import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  author TEXT,
  synced_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project, slug, version)
);

CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project);
CREATE INDEX IF NOT EXISTS idx_plans_project_slug ON plans(project, slug);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  slug TEXT NOT NULL,
  version INTEGER,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_plan ON comments(project, slug);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('fork_version', '0.11.2-hub.1');
`;

export function initDatabase(dbPath: string): Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec(SCHEMA);
  return db;
}

function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// --- Query functions ---

export function syncPlan(
  db: Database,
  params: {
    project: string;
    slug: string;
    version: number;
    content: string;
    author?: string;
    syncedAt: string;
  }
): { inserted: boolean } {
  const title = extractTitle(params.content);
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO plans (project, slug, version, content, title, author, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    params.project,
    params.slug,
    params.version,
    params.content,
    title,
    params.author ?? null,
    params.syncedAt
  );
  return { inserted: result.changes > 0 };
}

export function listProjects(db: Database): Array<{
  project: string;
  planCount: number;
  lastActivity: string;
}> {
  return db
    .prepare(
      `SELECT project,
              COUNT(DISTINCT slug) as planCount,
              MAX(synced_at) as lastActivity
       FROM plans
       GROUP BY project
       ORDER BY lastActivity DESC`
    )
    .all() as Array<{ project: string; planCount: number; lastActivity: string }>;
}

export function listProjectPlans(
  db: Database,
  project: string
): Array<{
  slug: string;
  title: string | null;
  author: string | null;
  versions: number;
  lastSyncedAt: string;
}> {
  return db
    .prepare(
      `SELECT slug,
              (SELECT title FROM plans p2 WHERE p2.project = plans.project AND p2.slug = plans.slug ORDER BY version DESC LIMIT 1) as title,
              (SELECT author FROM plans p3 WHERE p3.project = plans.project AND p3.slug = plans.slug ORDER BY version DESC LIMIT 1) as author,
              COUNT(*) as versions,
              MAX(synced_at) as lastSyncedAt
       FROM plans
       WHERE project = ?
       GROUP BY slug
       ORDER BY lastSyncedAt DESC`
    )
    .all(project) as Array<{
    slug: string;
    title: string | null;
    author: string | null;
    versions: number;
    lastSyncedAt: string;
  }>;
}

export function getPlan(
  db: Database,
  project: string,
  slug: string
): {
  plan: { content: string; title: string | null; author: string | null; version: number; syncedAt: string } | null;
  versions: Array<{ version: number; author: string | null; syncedAt: string }>;
} {
  const latest = db
    .prepare(
      `SELECT content, title, author, version, synced_at as syncedAt
       FROM plans
       WHERE project = ? AND slug = ?
       ORDER BY version DESC
       LIMIT 1`
    )
    .get(project, slug) as { content: string; title: string | null; author: string | null; version: number; syncedAt: string } | null;

  const versions = db
    .prepare(
      `SELECT version, author, synced_at as syncedAt
       FROM plans
       WHERE project = ? AND slug = ?
       ORDER BY version ASC`
    )
    .all(project, slug) as Array<{ version: number; author: string | null; syncedAt: string }>;

  return { plan: latest, versions };
}

export function getPlanVersion(
  db: Database,
  project: string,
  slug: string,
  version: number
): { content: string; title: string | null; author: string | null; syncedAt: string } | null {
  return db
    .prepare(
      `SELECT content, title, author, synced_at as syncedAt
       FROM plans
       WHERE project = ? AND slug = ? AND version = ?`
    )
    .get(project, slug, version) as { content: string; title: string | null; author: string | null; syncedAt: string } | null;
}

export function addComment(
  db: Database,
  params: {
    project: string;
    slug: string;
    version?: number;
    author: string;
    body: string;
  }
): { id: number } {
  const stmt = db.prepare(
    `INSERT INTO comments (project, slug, version, author, body) VALUES (?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    params.project,
    params.slug,
    params.version ?? null,
    params.author,
    params.body
  );
  return { id: Number(result.lastInsertRowid) };
}

export function listComments(
  db: Database,
  project: string,
  slug: string
): Array<{
  id: number;
  version: number | null;
  author: string;
  body: string;
  createdAt: string;
}> {
  return db
    .prepare(
      `SELECT id, version, author, body, created_at as createdAt
       FROM comments
       WHERE project = ? AND slug = ?
       ORDER BY created_at ASC`
    )
    .all(project, slug) as Array<{
    id: number;
    version: number | null;
    author: string;
    body: string;
    createdAt: string;
  }>;
}

export function getVersionSetting(db: Database): string {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'fork_version'`).get() as
    | { value: string }
    | null;
  return row?.value ?? "0.0.0";
}

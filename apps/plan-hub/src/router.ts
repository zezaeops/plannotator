import type { Database } from "bun:sqlite";
import { join, dirname } from "path";
import { validateAuth } from "./auth";

const DASHBOARD_DIR = join(dirname(import.meta.dir), "dist", "dashboard");
import {
  syncPlan,
  listProjects,
  listProjectPlans,
  getPlan,
  getPlanVersion,
  addComment,
  listComments,
  getVersionSetting,
} from "./db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

/**
 * Parse URL path segments after a base prefix.
 * e.g. "/api/plans/my-project/my-slug" with prefix "/api/plans/" → ["my-project", "my-slug"]
 */
function pathAfter(pathname: string, prefix: string): string[] {
  if (!pathname.startsWith(prefix)) return [];
  return pathname
    .slice(prefix.length)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
}

export async function handleRequest(
  req: Request,
  db: Database,
  token: string | undefined
): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // POST /api/sync — receive plan from local plannotator
  if (req.method === "POST" && pathname === "/api/sync") {
    const authError = validateAuth(req, token);
    if (authError) return authError;

    try {
      const body = (await req.json()) as {
        project: string;
        slug: string;
        version: number;
        content: string;
        author?: string;
        syncedAt: string;
      };

      if (!body.project || !body.slug || !body.version || !body.content) {
        return json({ error: "Missing required fields: project, slug, version, content" }, 400);
      }

      const result = syncPlan(db, body);
      return json({ ok: true, inserted: result.inserted }, 201);
    } catch (e) {
      return json({ error: "Invalid request body" }, 400);
    }
  }

  // GET /api/projects — list all projects
  if (req.method === "GET" && pathname === "/api/projects") {
    return json(listProjects(db));
  }

  // GET /api/projects/:project/plans — list plans in a project
  if (req.method === "GET" && pathname.startsWith("/api/projects/") && pathname.endsWith("/plans")) {
    const segments = pathAfter(pathname, "/api/projects/");
    if (segments.length === 2 && segments[1] === "plans") {
      return json(listProjectPlans(db, segments[0]));
    }
  }

  // Routes under /api/plans/:project/:slug/...
  if (pathname.startsWith("/api/plans/")) {
    const segments = pathAfter(pathname, "/api/plans/");

    // GET /api/plans/:project/:slug — get latest plan + version list
    if (req.method === "GET" && segments.length === 2) {
      const [project, slug] = segments;
      const result = getPlan(db, project, slug);
      if (!result.plan) {
        return json({ error: "Plan not found" }, 404);
      }
      return json(result);
    }

    // GET /api/plans/:project/:slug/versions/:v — get specific version
    if (req.method === "GET" && segments.length === 4 && segments[2] === "versions") {
      const [project, slug, , vStr] = segments;
      const v = parseInt(vStr, 10);
      if (isNaN(v)) return json({ error: "Invalid version number" }, 400);
      const result = getPlanVersion(db, project, slug, v);
      if (!result) return json({ error: "Version not found" }, 404);
      return json(result);
    }

    // POST /api/plans/:project/:slug/comments — add comment
    if (req.method === "POST" && segments.length === 3 && segments[2] === "comments") {
      const [project, slug] = segments;
      try {
        const body = (await req.json()) as {
          author: string;
          body: string;
          version?: number;
        };
        if (!body.author || !body.body) {
          return json({ error: "Missing required fields: author, body" }, 400);
        }
        const result = addComment(db, { project, slug, ...body });
        return json(result, 201);
      } catch {
        return json({ error: "Invalid request body" }, 400);
      }
    }

    // GET /api/plans/:project/:slug/comments — list comments
    if (req.method === "GET" && segments.length === 3 && segments[2] === "comments") {
      const [project, slug] = segments;
      return json(listComments(db, project, slug));
    }
  }

  // GET /api/version — update check (GitHub API format)
  if (req.method === "GET" && pathname === "/api/version") {
    const forkVersion = getVersionSetting(db);
    return json({
      tag_name: `v${forkVersion}`,
      html_url: `https://github.com/zezaeops/plannotator/releases/tag/v${forkVersion}`,
      body: `Plan Hub version ${forkVersion}`,
    });
  }

  // Static file serving for dashboard SPA
  if (req.method === "GET") {
    const filePath = join(DASHBOARD_DIR, pathname === "/" ? "index.html" : pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    // SPA fallback
    const indexFile = Bun.file(join(DASHBOARD_DIR, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { "Content-Type": "text/html" },
      });
    }
  }

  return json({ error: "Not found" }, 404);
}

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { initDatabase, syncPlan, listProjects, listProjectPlans, getPlan, getPlanVersion, addComment, listComments, getVersionSetting } from "./db";
import { handleRequest } from "./router";

// In-memory SQLite for tests
let db: Database;

beforeAll(() => {
  db = initDatabase(":memory:");
});

afterAll(() => {
  db.close();
});

// --- DB unit tests ---

describe("db", () => {
  test("syncPlan inserts a new plan", () => {
    const result = syncPlan(db, {
      project: "test-project",
      slug: "auth-refactor-2025-03-08",
      version: 1,
      content: "# Auth Refactor Plan\n\nRefactor auth module to use JWT.",
      author: "jaegeon",
      syncedAt: "2025-03-08T10:00:00Z",
    });
    expect(result.inserted).toBe(true);
  });

  test("syncPlan is idempotent (same version ignored)", () => {
    const result = syncPlan(db, {
      project: "test-project",
      slug: "auth-refactor-2025-03-08",
      version: 1,
      content: "# Auth Refactor Plan\n\nRefactor auth module to use JWT.",
      author: "jaegeon",
      syncedAt: "2025-03-08T10:00:00Z",
    });
    expect(result.inserted).toBe(false);
  });

  test("syncPlan extracts title from content", () => {
    syncPlan(db, {
      project: "test-project",
      slug: "auth-refactor-2025-03-08",
      version: 2,
      content: "# Auth Refactor v2\n\nWith refresh tokens.",
      author: "jaegeon",
      syncedAt: "2025-03-08T11:00:00Z",
    });
    const plan = getPlanVersion(db, "test-project", "auth-refactor-2025-03-08", 2);
    expect(plan?.title).toBe("Auth Refactor v2");
  });

  test("listProjects returns projects with counts", () => {
    const projects = listProjects(db);
    expect(projects.length).toBe(1);
    expect(projects[0].project).toBe("test-project");
    expect(projects[0].planCount).toBe(1);
  });

  test("listProjectPlans returns plans with version counts", () => {
    const plans = listProjectPlans(db, "test-project");
    expect(plans.length).toBe(1);
    expect(plans[0].slug).toBe("auth-refactor-2025-03-08");
    expect(plans[0].versions).toBe(2);
    expect(plans[0].title).toBe("Auth Refactor v2");
  });

  test("getPlan returns latest version and version list", () => {
    const result = getPlan(db, "test-project", "auth-refactor-2025-03-08");
    expect(result.plan).not.toBeNull();
    expect(result.plan!.version).toBe(2);
    expect(result.plan!.title).toBe("Auth Refactor v2");
    expect(result.versions.length).toBe(2);
    expect(result.versions[0].version).toBe(1);
    expect(result.versions[1].version).toBe(2);
  });

  test("getPlanVersion returns specific version", () => {
    const v1 = getPlanVersion(db, "test-project", "auth-refactor-2025-03-08", 1);
    expect(v1?.content).toContain("Refactor auth module to use JWT.");
    const v2 = getPlanVersion(db, "test-project", "auth-refactor-2025-03-08", 2);
    expect(v2?.content).toContain("refresh tokens");
  });

  test("getPlanVersion returns null for nonexistent version", () => {
    const result = getPlanVersion(db, "test-project", "auth-refactor-2025-03-08", 99);
    expect(result).toBeNull();
  });

  test("addComment and listComments", () => {
    const { id } = addComment(db, {
      project: "test-project",
      slug: "auth-refactor-2025-03-08",
      author: "youngjae",
      body: "LGTM!",
      version: 2,
    });
    expect(id).toBeGreaterThan(0);

    addComment(db, {
      project: "test-project",
      slug: "auth-refactor-2025-03-08",
      author: "jaegeon",
      body: "Thanks for the review",
    });

    const comments = listComments(db, "test-project", "auth-refactor-2025-03-08");
    expect(comments.length).toBe(2);
    expect(comments[0].author).toBe("youngjae");
    expect(comments[0].version).toBe(2);
    expect(comments[1].version).toBeNull();
  });

  test("getVersionSetting returns fork version", () => {
    const version = getVersionSetting(db);
    expect(version).toBe("0.11.2-hub.1");
  });
});

// --- Router integration tests ---

describe("router", () => {
  const token = "test-secret";

  function req(method: string, path: string, body?: unknown, headers?: Record<string, string>): Request {
    return new Request(`http://localhost${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  test("POST /api/sync requires auth when token configured", async () => {
    const res = await handleRequest(req("POST", "/api/sync", { project: "p", slug: "s", version: 1, content: "# X", syncedAt: "2025-01-01T00:00:00Z" }), db, token);
    expect(res.status).toBe(401);
  });

  test("POST /api/sync succeeds with valid token", async () => {
    const res = await handleRequest(
      req("POST", "/api/sync",
        { project: "router-test", slug: "test-plan", version: 1, content: "# Router Test\n\nHello", syncedAt: "2025-03-08T12:00:00Z" },
        { Authorization: `Bearer ${token}` }
      ), db, token
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.inserted).toBe(true);
  });

  test("POST /api/sync validates required fields", async () => {
    const res = await handleRequest(
      req("POST", "/api/sync", { project: "p" }, { Authorization: `Bearer ${token}` }),
      db, token
    );
    expect(res.status).toBe(400);
  });

  test("POST /api/sync without token config allows open access", async () => {
    const res = await handleRequest(
      req("POST", "/api/sync", { project: "open-test", slug: "s", version: 1, content: "# Open", syncedAt: "2025-01-01T00:00:00Z" }),
      db, undefined
    );
    expect(res.status).toBe(201);
  });

  test("GET /api/projects returns project list", async () => {
    const res = await handleRequest(req("GET", "/api/projects"), db, token);
    expect(res.status).toBe(200);
    const data = await res.json() as Array<{ project: string }>;
    const projects = data.map((p) => p.project);
    expect(projects).toContain("router-test");
  });

  test("GET /api/projects/:project/plans returns plan list", async () => {
    const res = await handleRequest(req("GET", "/api/projects/router-test/plans"), db, token);
    expect(res.status).toBe(200);
    const data = await res.json() as Array<{ slug: string }>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].slug).toBe("test-plan");
  });

  test("GET /api/plans/:project/:slug returns plan detail", async () => {
    const res = await handleRequest(req("GET", "/api/plans/router-test/test-plan"), db, token);
    expect(res.status).toBe(200);
    const data = await res.json() as { plan: { content: string; version: number }; versions: Array<{ version: number }> };
    expect(data.plan.content).toContain("Router Test");
    expect(data.versions.length).toBe(1);
  });

  test("GET /api/plans/:project/:slug returns 404 for unknown plan", async () => {
    const res = await handleRequest(req("GET", "/api/plans/nope/nope"), db, token);
    expect(res.status).toBe(404);
  });

  test("GET /api/plans/:project/:slug/versions/:v returns specific version", async () => {
    const res = await handleRequest(req("GET", "/api/plans/router-test/test-plan/versions/1"), db, token);
    expect(res.status).toBe(200);
    const data = await res.json() as { content: string };
    expect(data.content).toContain("Router Test");
  });

  test("POST/GET comments via router", async () => {
    const postRes = await handleRequest(
      req("POST", "/api/plans/router-test/test-plan/comments", { author: "tester", body: "Nice plan!" }),
      db, token
    );
    expect(postRes.status).toBe(201);

    const getRes = await handleRequest(req("GET", "/api/plans/router-test/test-plan/comments"), db, token);
    const comments = await getRes.json() as Array<{ author: string; body: string }>;
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0].author).toBe("tester");
  });

  test("GET /api/version returns GitHub API format", async () => {
    const res = await handleRequest(req("GET", "/api/version"), db, token);
    expect(res.status).toBe(200);
    const data = await res.json() as { tag_name: string; html_url: string };
    expect(data.tag_name).toMatch(/^v\d+\.\d+\.\d+/);
    expect(data.html_url).toContain("github.com");
  });

  test("OPTIONS returns CORS headers", async () => {
    const res = await handleRequest(req("OPTIONS", "/api/sync"), db, token);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("unknown API route returns 404", async () => {
    const res = await handleRequest(req("POST", "/api/unknown"), db, token);
    expect(res.status).toBe(404);
  });

  test("unknown GET route serves dashboard SPA or 404", async () => {
    const res = await handleRequest(req("GET", "/some-page"), db, token);
    // Returns 200 (SPA fallback) if dashboard is built, or 404 if not
    expect([200, 404]).toContain(res.status);
  });
});

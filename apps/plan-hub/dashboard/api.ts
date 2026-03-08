export interface Project {
  project: string;
  planCount: number;
  lastActivity: string;
}

export interface PlanSummary {
  slug: string;
  title: string | null;
  author: string | null;
  versions: number;
  lastSyncedAt: string;
}

export interface PlanVersion {
  version: number;
  author: string | null;
  syncedAt: string;
}

export interface PlanDetail {
  plan: {
    content: string;
    title: string | null;
    author: string | null;
    version: number;
    syncedAt: string;
  } | null;
  versions: PlanVersion[];
}

export interface PlanVersionContent {
  content: string;
  title: string | null;
  author: string | null;
  syncedAt: string;
}

export interface Comment {
  id: number;
  version: number | null;
  author: string;
  body: string;
  createdAt: string;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  return res.json();
}

export async function fetchPlans(project: string): Promise<PlanSummary[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(project)}/plans`);
  return res.json();
}

export async function fetchPlan(project: string, slug: string): Promise<PlanDetail> {
  const res = await fetch(`/api/plans/${encodeURIComponent(project)}/${encodeURIComponent(slug)}`);
  return res.json();
}

export async function fetchPlanVersion(project: string, slug: string, v: number): Promise<PlanVersionContent> {
  const res = await fetch(`/api/plans/${encodeURIComponent(project)}/${encodeURIComponent(slug)}/versions/${v}`);
  return res.json();
}

export async function fetchComments(project: string, slug: string): Promise<Comment[]> {
  const res = await fetch(`/api/plans/${encodeURIComponent(project)}/${encodeURIComponent(slug)}/comments`);
  return res.json();
}

export async function postComment(
  project: string,
  slug: string,
  body: { author: string; body: string; version?: number }
): Promise<{ id: number }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(project)}/${encodeURIComponent(slug)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

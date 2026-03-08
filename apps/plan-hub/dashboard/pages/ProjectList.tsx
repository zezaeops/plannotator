import React, { useState, useEffect } from 'react';
import { fetchProjects, type Project } from '../api';

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground py-12 text-center">Loading projects...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-foreground mb-2">No plans yet</h2>
        <p className="text-muted-foreground">
          Set <code className="px-1.5 py-0.5 bg-muted rounded text-sm">PLANNOTATOR_HUB_URL</code> in your environment to start syncing plans.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <a
          key={p.project}
          href={`#/${encodeURIComponent(p.project)}`}
          className="block p-5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
        >
          <h3 className="font-semibold text-foreground truncate">{p.project}</h3>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{p.planCount} plan{p.planCount !== 1 ? 's' : ''}</span>
            <span>&middot;</span>
            <span>{timeAgo(p.lastActivity)}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

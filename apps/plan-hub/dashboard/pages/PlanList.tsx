import React, { useState, useEffect } from 'react';
import { fetchPlans, type PlanSummary } from '../api';

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

export function PlanList({ project }: { project: string }) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPlans(project)
      .then(setPlans)
      .finally(() => setLoading(false));
  }, [project]);

  if (loading) {
    return <div className="text-muted-foreground py-12 text-center">Loading plans...</div>;
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-foreground mb-2">No plans in {project}</h2>
        <p className="text-muted-foreground">Plans will appear here once synced from local plannotator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {plans.map((p) => (
        <a
          key={p.slug}
          href={`#/${encodeURIComponent(project)}/${encodeURIComponent(p.slug)}`}
          className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
        >
          <div className="min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {p.title || p.slug}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {p.author && <span>@{p.author}</span>}
              <span>&middot;</span>
              <span>v{p.versions}</span>
              <span>&middot;</span>
              <span>{timeAgo(p.lastSyncedAt)}</span>
            </div>
          </div>
          <div className="flex-shrink-0 ml-4 text-xs text-muted-foreground">
            {p.versions} version{p.versions !== 1 ? 's' : ''}
          </div>
        </a>
      ))}
    </div>
  );
}

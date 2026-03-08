import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parseMarkdownToBlocks } from '@plannotator/ui/utils/parser';
import { computePlanDiff } from '@plannotator/ui/utils/planDiffEngine';
import type { PlanDiffBlock, PlanDiffStats } from '@plannotator/ui/utils/planDiffEngine';
import {
  fetchPlan,
  fetchPlanVersion,
  fetchComments,
  postComment,
  type PlanDetail as PlanDetailData,
  type PlanVersion,
  type Comment,
} from '../api';

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

// --- Simple Markdown Renderer ---

function MarkdownRenderer({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownToBlocks(content), [content]);

  return (
    <div className="prose prose-invert max-w-none">
      {blocks.map((block) => {
        switch (block.type) {
          case 'heading': {
            const Tag = `h${block.level || 1}` as keyof JSX.IntrinsicElements;
            return <Tag key={block.id} className="text-foreground">{block.content}</Tag>;
          }
          case 'code':
            return (
              <pre key={block.id} className="bg-muted rounded-lg p-4 overflow-x-auto">
                <code className={block.language ? `language-${block.language}` : ''}>
                  {block.content}
                </code>
              </pre>
            );
          case 'list-item':
            return <li key={block.id} className="text-foreground/90">{block.content}</li>;
          case 'blockquote':
            return (
              <blockquote key={block.id} className="border-l-4 border-primary/50 pl-4 text-muted-foreground italic">
                {block.content}
              </blockquote>
            );
          case 'hr':
            return <hr key={block.id} className="border-border my-6" />;
          default:
            return <p key={block.id} className="text-foreground/90 leading-relaxed">{block.content}</p>;
        }
      })}
    </div>
  );
}

// --- Diff Viewer ---

function DiffViewer({ blocks, stats }: { blocks: PlanDiffBlock[]; stats: PlanDiffStats }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 text-sm">
        <span className="text-green-400">+{stats.additions}</span>
        <span className="text-red-400">-{stats.deletions}</span>
        {stats.modifications > 0 && <span className="text-yellow-400">~{stats.modifications}</span>}
      </div>
      <div className="font-mono text-sm space-y-0">
        {blocks.map((block, i) => {
          if (block.type === 'unchanged') {
            return (
              <div key={i} className="px-4 py-1 text-foreground/70">
                {block.content.split('\n').map((line, j) => (
                  <div key={j}>{line || '\u00a0'}</div>
                ))}
              </div>
            );
          }
          if (block.type === 'added') {
            return (
              <div key={i} className="px-4 py-1 bg-green-500/10 border-l-3 border-green-500">
                {block.content.split('\n').map((line, j) => (
                  <div key={j} className="text-green-400">+ {line || '\u00a0'}</div>
                ))}
              </div>
            );
          }
          if (block.type === 'removed') {
            return (
              <div key={i} className="px-4 py-1 bg-red-500/10 border-l-3 border-red-500">
                {(block.oldContent || block.content).split('\n').map((line, j) => (
                  <div key={j} className="text-red-400">- {line || '\u00a0'}</div>
                ))}
              </div>
            );
          }
          // modified
          return (
            <div key={i}>
              <div className="px-4 py-1 bg-red-500/10 border-l-3 border-yellow-500">
                {(block.oldContent || '').split('\n').map((line, j) => (
                  <div key={j} className="text-red-400">- {line || '\u00a0'}</div>
                ))}
              </div>
              <div className="px-4 py-1 bg-green-500/10 border-l-3 border-yellow-500">
                {block.content.split('\n').map((line, j) => (
                  <div key={j} className="text-green-400">+ {line || '\u00a0'}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Version Timeline ---

function VersionTimeline({
  versions,
  currentVersion,
  diffBaseVersion,
  onSelectVersion,
  onSelectDiffBase,
}: {
  versions: PlanVersion[];
  currentVersion: number;
  diffBaseVersion: number | null;
  onSelectVersion: (v: number) => void;
  onSelectDiffBase: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Versions</h3>
      {[...versions].reverse().map((v) => {
        const isActive = v.version === currentVersion;
        const isDiffBase = v.version === diffBaseVersion;
        return (
          <div
            key={v.version}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
              isActive ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-foreground/80'
            }`}
          >
            <button
              onClick={() => onSelectVersion(v.version)}
              className="flex-1 text-left"
            >
              <span className="font-medium">v{v.version}</span>
              {v.author && <span className="ml-2 text-muted-foreground">@{v.author}</span>}
              <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(v.syncedAt)}</div>
            </button>
            {v.version !== currentVersion && (
              <button
                onClick={() => onSelectDiffBase(isDiffBase ? null : v.version)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  isDiffBase
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
                title={isDiffBase ? 'Clear diff' : `Diff v${v.version} → v${currentVersion}`}
              >
                diff
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Comment Section ---

function CommentSection({
  project,
  slug,
}: {
  project: string;
  slug: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState(() => localStorage.getItem('hub-author') || '');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(() => {
    fetchComments(project, slug).then(setComments);
  }, [project, slug]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    setSubmitting(true);
    localStorage.setItem('hub-author', author.trim());
    await postComment(project, slug, { author: author.trim(), body: body.trim() });
    setBody('');
    setSubmitting(false);
    loadComments();
  };

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Comments ({comments.length})
      </h3>
      {comments.length > 0 && (
        <div className="space-y-3 mb-6">
          {comments.map((c) => (
            <div key={c.id} className="p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-medium text-foreground">@{c.author}</span>
                {c.version && <span>on v{c.version}</span>}
                <span>&middot;</span>
                <span>{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm text-foreground/90">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Name"
          className="w-28 px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting || !author.trim() || !body.trim()}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// --- Main PlanDetail ---

export function PlanDetail({ project, slug }: { project: string; slug: string }) {
  const [data, setData] = useState<PlanDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [diffBaseVersion, setDiffBaseVersion] = useState<number | null>(null);
  const [diffBaseContent, setDiffBaseContent] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPlan(project, slug)
      .then((d) => {
        setData(d);
        if (d.plan) {
          setCurrentVersion(d.plan.version);
          setCurrentContent(d.plan.content);
        }
      })
      .finally(() => setLoading(false));
  }, [project, slug]);

  const handleSelectVersion = async (v: number) => {
    const versionData = await fetchPlanVersion(project, slug, v);
    setCurrentVersion(v);
    setCurrentContent(versionData.content);
    setDiffBaseVersion(null);
    setDiffBaseContent(null);
  };

  const handleSelectDiffBase = async (v: number | null) => {
    if (v === null) {
      setDiffBaseVersion(null);
      setDiffBaseContent(null);
      return;
    }
    const versionData = await fetchPlanVersion(project, slug, v);
    setDiffBaseVersion(v);
    setDiffBaseContent(versionData.content);
  };

  const diff = useMemo(() => {
    if (!diffBaseContent || !currentContent) return null;
    return computePlanDiff(diffBaseContent, currentContent);
  }, [diffBaseContent, currentContent]);

  if (loading) {
    return <div className="text-muted-foreground py-12 text-center">Loading plan...</div>;
  }

  if (!data?.plan) {
    return <div className="text-center py-20 text-muted-foreground">Plan not found</div>;
  }

  return (
    <div className="flex gap-6">
      {/* Version sidebar */}
      {data.versions.length > 1 && (
        <aside className="w-52 flex-shrink-0">
          <div className="sticky top-20">
            <VersionTimeline
              versions={data.versions}
              currentVersion={currentVersion}
              diffBaseVersion={diffBaseVersion}
              onSelectVersion={handleSelectVersion}
              onSelectDiffBase={handleSelectDiffBase}
            />
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {data.plan.title || slug}
          </h1>
          <span className="text-sm text-muted-foreground">v{currentVersion}</span>
          {diff && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              <span className="text-green-400">+{diff.stats.additions}</span>
              {' / '}
              <span className="text-red-400">-{diff.stats.deletions}</span>
            </span>
          )}
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          {diff ? (
            <DiffViewer blocks={diff.blocks} stats={diff.stats} />
          ) : (
            <MarkdownRenderer content={currentContent} />
          )}
        </div>

        <CommentSection project={project} slug={slug} />
      </div>
    </div>
  );
}

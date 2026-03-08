import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@plannotator/ui/components/ThemeProvider';
import { ModeToggle } from '@plannotator/ui/components/ModeToggle';
import { ProjectList } from './pages/ProjectList';
import { PlanList } from './pages/PlanList';
import { PlanDetail } from './pages/PlanDetail';

type Route =
  | { page: 'projects' }
  | { page: 'plans'; project: string }
  | { page: 'detail'; project: string; slug: string };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { page: 'projects' };
  const parts = hash.split('/').map(decodeURIComponent);
  if (parts.length === 1) return { page: 'plans', project: parts[0] };
  if (parts.length >= 2) return { page: 'detail', project: parts[0], slug: parts[1] };
  return { page: 'projects' };
}

function Breadcrumb({ route }: { route: Route }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <a href="#/" className="hover:text-foreground transition-colors">Projects</a>
      {route.page !== 'projects' && (
        <>
          <span>/</span>
          <a
            href={`#/${encodeURIComponent(route.project)}`}
            className="hover:text-foreground transition-colors"
          >
            {route.project}
          </a>
        </>
      )}
      {route.page === 'detail' && (
        <>
          <span>/</span>
          <span className="text-foreground">{route.slug}</span>
        </>
      )}
    </nav>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="#/" className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
                Plan Hub
              </a>
              <Breadcrumb route={route} />
            </div>
            <ModeToggle />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-6">
          {route.page === 'projects' && <ProjectList />}
          {route.page === 'plans' && <PlanList project={route.project} />}
          {route.page === 'detail' && <PlanDetail project={route.project} slug={route.slug} />}
        </main>
      </div>
    </ThemeProvider>
  );
}

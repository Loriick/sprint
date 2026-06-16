import type { RouteHandler, RouteParams } from './types';

// Drives bookmarkable/back-button-able pages (home, settings, history).
// Camera/result stay outside the router: they're transient session states
// driven by user actions, not destinations you'd navigate to directly.
interface Route {
  regex: RegExp;
  paramNames: string[];
  enter: RouteHandler;
  leave: (() => void) | null;
}

function createRouter() {
  const routes: Route[] = [];
  let leaveCurrent: (() => void) | null = null;

  function on(path: string, enter: RouteHandler, leave?: () => void): void {
    const paramNames: string[] = [];
    const pattern = path.replace(/:[^/]+/g, (m) => {
      paramNames.push(m.slice(1));
      return '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    routes.push({ regex, paramNames, enter, leave: leave || null });
  }

  function resolve(): void {
    const path = location.hash.slice(1) || '/';
    for (const r of routes) {
      const match = path.match(r.regex);
      if (match) {
        if (leaveCurrent) leaveCurrent();
        const params: RouteParams = {};
        r.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        leaveCurrent = r.leave;
        r.enter(params);
        return;
      }
    }
    navigate('/');
  }

  function navigate(path: string): void {
    if (location.hash.slice(1) === path) resolve();
    else location.hash = path;
  }

  function start(): void {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  return { on, navigate, start };
}

export const router = createRouter();

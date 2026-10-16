import { useProjects } from '../store/projects';

// Where the reader stopped inside each A4 sheet, remembered per project.
//
// A sheet's scroll region is torn down and rebuilt by every tier change (the
// plaque subtree replaces the page subtree), by every collapse, and by every pan
// that carries the node off-screen (React Flow's onlyRenderVisibleElements).
// Without a memory, a long answer jumps back to the top each time and you hunt
// for your place again by hand.
//
// localStorage, not IndexedDB: the offsets are a handful of numbers, and reading
// them SYNCHRONOUSLY is the entire point. A sheet mounts the instant it scrolls
// into view; an async load would render the page at the top first and yank it
// down afterwards. CanvasChat keeps its per-project state the same way.
const KEY = (projectId: string) => `thoughtdag.scroll.${projectId}`;
// A scroll event fires every frame; writing each one would hammer storage. The
// trailing position is what matters, and 350 ms is short enough that closing the
// tab mid-read loses at most a few lines.
const WRITE_DELAY_MS = 350;

let cache: Record<string, number> | null = null;
let cacheProject: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const read = (projectId: string): Record<string, number> => {
  if (cache && cacheProject === projectId) return cache;
  let parsed: Record<string, number> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(projectId)) ?? '{}');
    if (raw && typeof raw === 'object') parsed = raw;
  } catch {
    // A corrupt entry just means this project has no memory yet.
  }
  cache = parsed;
  cacheProject = projectId;
  return cache;
};

const flush = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!cache || !cacheProject) return;
  try {
    localStorage.setItem(KEY(cacheProject), JSON.stringify(cache));
  } catch {
    // Private mode / quota: the memory just lives for this page.
  }
};

/** Where this node's sheet was last left, in its own scroll region. 0 = top. */
export function getScrollOffset(nodeId: string): number {
  const projectId = useProjects.getState().activeId;
  return projectId ? read(projectId)[nodeId] ?? 0 : 0;
}

/** Remember it. Debounced, so dragging a scrollbar costs one write, not one a frame. */
export function setScrollOffset(nodeId: string, top: number): void {
  const projectId = useProjects.getState().activeId;
  if (!projectId) return;
  const map = read(projectId);
  if (map[nodeId] === top) return;
  map[nodeId] = top;
  if (timer) return;
  timer = setTimeout(flush, WRITE_DELAY_MS);
}

// A tab closed mid-read should not lose the last page.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

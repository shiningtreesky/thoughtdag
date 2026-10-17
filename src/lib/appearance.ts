import { create } from 'zustand';

// Appearance: three axes.
//   lighting     — light / dark / system  → swaps the whole token set (data-theme)
//   paper        — plain / grid           → canvas texture + component dialect (data-paper)
//   canvasTone   — light / dim / black     → the canvas ground colour alone (data-canvas-tone)
// The tone is a LIGHT-theme option: a dark canvas is already dark, so the dim
// override is scoped to light and the control is disabled otherwise. It touches
// the canvas ground and the minimap only — the sheets stay --color-card white.
// Tokens live in index.css; this module only flips the root attributes and
// remembers the choice. The share viewer follows the VIEWER's settings.

export type Lighting = 'light' | 'dark' | 'system';
export type Paper = 'plain' | 'grid';
export type CanvasTone = 'light' | 'dim' | 'black';

const LS_LIGHTING = 'thoughtdag.lighting';
const LS_PAPER = 'thoughtdag.paper';
const LS_CANVAS_TONE = 'thoughtdag.canvasTone';

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolve(lighting: Lighting): 'light' | 'dark' {
  return lighting === 'system' ? (media?.matches ? 'dark' : 'light') : lighting;
}

function apply(lighting: Lighting, paper: Paper, canvasTone: CanvasTone): 'light' | 'dark' {
  const resolved = resolve(lighting);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.paper = paper;
  document.documentElement.dataset.canvasTone = canvasTone;
  return resolved;
}

interface AppearanceState {
  lighting: Lighting;
  paper: Paper;
  canvasTone: CanvasTone;
  /** the theme actually on screen — 'system' collapsed to light/dark.
      Subscribe to this to re-derive anything computed from token values
      (edge palettes resolve through it). */
  resolved: 'light' | 'dark';
  setLighting: (l: Lighting) => void;
  setPaper: (p: Paper) => void;
  setCanvasTone: (c: CanvasTone) => void;
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  lighting: (localStorage.getItem(LS_LIGHTING) as Lighting) || 'light',
  paper: (localStorage.getItem(LS_PAPER) as Paper) || 'plain',
  canvasTone: (localStorage.getItem(LS_CANVAS_TONE) as CanvasTone) || 'light',
  resolved: 'light',
  setLighting: (lighting) => {
    localStorage.setItem(LS_LIGHTING, lighting);
    const { paper, canvasTone } = get();
    set({ lighting, resolved: apply(lighting, paper, canvasTone) });
  },
  setPaper: (paper) => {
    localStorage.setItem(LS_PAPER, paper);
    const { lighting, canvasTone } = get();
    apply(lighting, paper, canvasTone);
    set({ paper });
  },
  setCanvasTone: (canvasTone) => {
    localStorage.setItem(LS_CANVAS_TONE, canvasTone);
    const { lighting, paper } = get();
    apply(lighting, paper, canvasTone);
    set({ canvasTone });
  },
}));

/** Called once before first render — no flash of the wrong theme. */
export function initAppearance(): void {
  const s = useAppearance.getState();
  useAppearance.setState({ resolved: apply(s.lighting, s.paper, s.canvasTone) });
  media?.addEventListener('change', () => {
    const st = useAppearance.getState();
    if (st.lighting === 'system') {
      useAppearance.setState({ resolved: apply(st.lighting, st.paper, st.canvasTone) });
    }
  });
}

/** The four semantic edge colors as CURRENTLY rendered (theme-resolved).
    Edge styles are persisted with light-theme hex values; the render layer
    maps them through this palette so old graphs theme correctly without a
    data migration. */
export function edgePalette(): { accent: string; warm: string; trace: string; watch: string } {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: read('--color-accent', '#6B5CE7'),
    warm: read('--color-warm', '#E08A3C'),
    trace: read('--color-trace', '#F59E0B'),
    watch: read('--color-watch', '#DC2626'),
  };
}

/** Stored stroke hex → semantic slot, for the render-time mapping. */
export const LEGACY_EDGE_HEX: Record<string, keyof ReturnType<typeof edgePalette>> = {
  '#6B5CE7': 'accent',
  '#E08A3C': 'warm',
  '#F59E0B': 'trace',
  '#DC2626': 'watch',
};

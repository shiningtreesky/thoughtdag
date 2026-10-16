import { useRef } from 'react';
import { useStore as useRfStore } from '@xyflow/react';

/**
 * Semantic zoom, three tiers with hysteresis at both boundaries:
 *
 *   work  (zoom >= 0.6)   — full A4 sheets: read the content. A sheet stays a
 *                           sheet down to half its true size; the map only takes
 *                           over below 50%, not at 80%.
 *   map   (~0.25 – 0.5)   — takeaway plaques: read what each step yielded
 *   glyph (zoom < ~0.25)  — one seal per node: read how the thinking moved
 *
 * Dual thresholds per boundary prevent flapping. The work boundary sits at the
 * same 10-point hysteresis it always had (out at 0.5, back in at 0.6); the
 * glyph boundary moved down with it so the plaque tier keeps a band wide enough
 * for its three summary levels to appear.
 */
export type ZoomTier = 'work' | 'map' | 'glyph';

export function useZoomTier(): ZoomTier {
  const ref = useRef<ZoomTier>('work');
  return useRfStore((s) => {
    const z = s.transform[2];
    const cur = ref.current;
    if (cur === 'work') {
      if (z <= 0.5) ref.current = z <= 0.25 ? 'glyph' : 'map';
    } else if (cur === 'map') {
      if (z >= 0.6) ref.current = 'work';
      else if (z <= 0.25) ref.current = 'glyph';
    } else {
      if (z >= 0.6) ref.current = 'work';
      else if (z >= 0.32) ref.current = 'map';
    }
    return ref.current;
  });
}

/** Legacy boolean view: true whenever cards are folded (map OR glyph). */
export function useMapMode(): boolean {
  return useZoomTier() !== 'work';
}

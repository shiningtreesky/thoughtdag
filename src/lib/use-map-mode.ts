import { useRef } from 'react';
import { useStore as useRfStore } from '@xyflow/react';

/**
 * Semantic zoom, three tiers:
 *
 *   work  (zoom >= 0.4)   — full A4 sheets: read the content. A sheet stays a
 *                           sheet down to 40%; the map takes over BELOW 40%,
 *                           and 40% itself is still a sheet.
 *   map   (~0.2 – 0.4)    — takeaway plaques: read what each step yielded
 *   glyph (zoom < ~0.2)   — one seal per node: read how the thinking moved
 *
 * The work boundary has NO hysteresis on purpose: out at 0.4, back at 0.4, one
 * number, so the tier is exactly what the readout says it is. The cost is that
 * parking the wheel right on 40% will flip the two forms — accepted.
 * The glyph boundary keeps its hysteresis (0.2 out, 0.25 back) because a seal
 * and a plaque are different enough that flapping there is worse than a wide
 * band, and the plaque tier needs room for its three summary levels.
 */
export type ZoomTier = 'work' | 'map' | 'glyph';

export function useZoomTier(): ZoomTier {
  const ref = useRef<ZoomTier>('work');
  return useRfStore((s) => {
    const z = s.transform[2];
    const cur = ref.current;
    if (cur === 'work') {
      if (z < 0.4) ref.current = z <= 0.2 ? 'glyph' : 'map';
    } else if (cur === 'map') {
      if (z >= 0.4) ref.current = 'work';
      else if (z <= 0.2) ref.current = 'glyph';
    } else {
      if (z >= 0.4) ref.current = 'work';
      else if (z >= 0.25) ref.current = 'map';
    }
    return ref.current;
  });
}

/** Legacy boolean view: true whenever cards are folded (map OR glyph). */
export function useMapMode(): boolean {
  return useZoomTier() !== 'work';
}

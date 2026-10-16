import type { Viewport } from '@xyflow/react';

// The view a navigation left behind, so Z can hand it back.
//
// ONE slot, in memory: the last departure is what you can step out of, and
// taking it clears it, so a second Z does not bounce you back onto the sheet
// you just finished reading. It is not persisted - where you stopped READING is
// already remembered per node (lib/scroll-memory); this is only the camera, and
// a camera position from a previous session would be a surprise, not a memory.
//
// A module rather than a ref because the writers are spread across components:
// centerNode (F, search jumps, timeline clicks, map plaques, arrow navigation),
// the 1:1 control and the 0.5 control all need the same single slot.
let saved: Viewport | null = null;

export function saveReturnView(view: Viewport): void {
  saved = { x: view.x, y: view.y, zoom: view.zoom };
}

/** The saved view, or null if there is nothing to step back to. Clears the slot. */
export function takeReturnView(): Viewport | null {
  const view = saved;
  saved = null;
  return view;
}

/**
 * Shared, render-free state bridge between the scrolling landing page and the
 * WebGL network scene. Mutating a module-level object keeps the 3D loop at
 * 60fps without triggering React re-renders on every scroll frame.
 */
export const scrollState = {
  /** Overall page progress, 0 → 1. */
  progress: 0,
  /** Normalised pointer position, -1 → 1 on both axes. */
  pointerX: 0,
  pointerY: 0,
  /** Set when the scene should render (canvas on screen). */
  visible: true,
  /** Reduced complexity for small screens / reduced-motion users. */
  lite: false,
};

export type Chapter =
  | "noise"
  | "signal"
  | "trace"
  | "network"
  | "intelligence"
  | "evidence"
  | "converge";

/** Narrative phase derived from page progress. */
export function chapterFor(p: number): Chapter {
  if (p < 0.12) return "noise";
  if (p < 0.26) return "signal";
  if (p < 0.4) return "trace";
  if (p < 0.54) return "network";
  if (p < 0.68) return "intelligence";
  if (p < 0.86) return "evidence";
  return "converge";
}

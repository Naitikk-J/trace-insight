/**
 * Render-free bridge between the scroll container and the WebGL loop.
 *
 * Mutating a module object keeps the world at 60fps: scroll frames never cause
 * React re-renders, and the frame loop always reads the latest value.
 */
export const story = {
  /** Raw scroll progress, 0 → 1. */
  raw: 0,
  /** Smoothed progress the world actually renders (Lenis-like inertia). */
  progress: 0,
  /** Normalised pointer, -1 → 1 on both axes. */
  pointerX: 0,
  pointerY: 0,
  /** Canvas on screen. */
  visible: true,
  /** Reduced complexity: small screens, weak GPUs, reduced-motion users. */
  lite: false,
  /** prefers-reduced-motion. */
  reduced: false,
};

export function detectLite() {
  if (typeof window === "undefined") return { lite: false, reduced: false };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 900;
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
  return { lite: reduced || small || weak, reduced };
}

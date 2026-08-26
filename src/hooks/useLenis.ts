import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Buttery-smooth momentum scrolling for the cinematic landing journey.
 *
 * Lenis drives the real window scroll position, so the story progress reader
 * (plain `scroll` events) keeps working untouched. Disabled automatically when
 * the visitor prefers reduced motion.
 */
export function useLenis() {
  const ref = useRef<Lenis | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.35,
      easing: (t) => 1 - Math.pow(1 - t, 3.2),
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.4,
      wheelMultiplier: 0.9,
    });
    ref.current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      ref.current = null;
    };
  }, []);

  return ref;
}

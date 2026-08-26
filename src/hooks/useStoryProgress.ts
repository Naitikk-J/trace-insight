import { useEffect, useState } from "react";

import { story, detectLite } from "@/three/utils/storyState";
import { chapterAt, type Chapter } from "@/three/utils/storyConfig";

/**
 * Drives the whole experience.
 *
 * Scroll position → story.raw (written on every scroll event, no React state),
 * then smoothed towards story.progress on a rAF loop so the world glides and
 * reverses smoothly. React only re-renders when the *chapter* changes, which is
 * all the overlays and navigation need.
 */
export function useStoryProgress(scrollRef: React.RefObject<HTMLElement | null>) {
  const [chapter, setChapter] = useState<Chapter>(() => chapterAt(0));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const caps = detectLite();
    story.lite = caps.lite;
    story.reduced = caps.reduced;

    const read = () => {
      const el = scrollRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? (window.scrollY - el.offsetTop) / total : 0;
      story.raw = p < 0 ? 0 : p > 1 ? 1 : p;
    };

    const onPointer = (e: PointerEvent) => {
      story.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      story.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    read();
    story.progress = story.raw;

    let frame = 0;
    let last = performance.now();
    let lastChapterId = chapterAt(story.progress).id;
    let lastReported = -1;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Inertial smoothing: stops exactly where the user stops, reverses cleanly.
      const lambda = story.reduced ? 18 : 5.5;
      story.progress += (story.raw - story.progress) * (1 - Math.exp(-lambda * dt));

      const next = chapterAt(story.progress);
      if (next.id !== lastChapterId) {
        lastChapterId = next.id;
        setChapter(next);
      }
      // Coarse progress for overlays only — 1% steps keep React quiet.
      const coarse = Math.round(story.progress * 200) / 200;
      if (coarse !== lastReported) {
        lastReported = coarse;
        setProgress(coarse);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [scrollRef]);

  return { chapter, progress };
}

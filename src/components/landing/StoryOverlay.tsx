/**
 * The 2D layer. Deliberately minimal: the world carries the story, the overlay
 * only states it. Copy is anchored per chapter, never centred by default, and
 * never boxed in a card.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CHAPTERS, chapterNumber, type Chapter } from "@/three/utils/storyConfig";
import { story } from "@/three/utils/storyState";
import { cn } from "@/lib/utils";

const ALIGN = {
  left: "items-start text-left md:left-[7vw] md:right-auto",
  center: "items-center text-center md:left-1/2 md:right-auto md:top-[14vh] md:-translate-x-1/2",
  right: "items-end text-right md:left-auto md:right-[10vw]",
} as const;

export function ChapterCopy({ chapter }: { chapter: Chapter }) {
  const o = chapter.overlay;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [chapter.id]);

  if (!o) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-5 bottom-24 top-24 z-20 flex max-w-[calc(100vw-2.5rem)] flex-col justify-center gap-3 md:inset-y-[18vh] md:w-[min(42vw,42rem)] md:max-w-none md:gap-5",
        ALIGN[o.align],
      )}
    >
      <span
        className={cn(
          "font-mono text-[10px] tracking-[0.42em] text-primary/70 transition-all duration-700",
          shown ? "opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        {chapterNumber(chapter)} / {chapter.label}
      </span>

      <h2 className="max-w-full">
        {o.lines.map((line, i) => (
          <span
            key={line}
            className={cn(
              "block text-[clamp(1.75rem,4.2vw,4rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground transition-all duration-[900ms] ease-out",
              shown ? "opacity-100 blur-0" : "translate-y-6 opacity-0 blur-sm",
            )}
            style={{ transitionDelay: `${120 + i * 110}ms` }}
          >
            {line}
          </span>
        ))}
      </h2>

      {o.lines2 ? (
        <h3 className="max-w-full">
          {o.lines2.map((line, i) => (
            <span
              key={line}
              className={cn(
                "block text-[clamp(1.2rem,2.5vw,2.25rem)] font-light leading-[1.1] tracking-[-0.02em] text-muted-foreground transition-all duration-[900ms] ease-out",
                shown ? "opacity-100 blur-0" : "translate-y-6 opacity-0 blur-sm",
              )}
              style={{ transitionDelay: `${420 + i * 110}ms` }}
            >
              {line}
            </span>
          ))}
        </h3>
      ) : null}

      {o.note ? (
        <p
          className={cn(
            "max-w-sm text-xs leading-relaxed text-muted-foreground/80 transition-all duration-700 md:text-sm",
            shown ? "opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: "700ms" }}
        >
          {o.note}
        </p>
      ) : null}

      {o.meta ? (
        <dl
          className={cn(
            "flex max-w-full flex-wrap gap-x-6 gap-y-2 font-mono text-[9px] tracking-[0.16em] transition-all duration-700 md:text-[10px]",
            o.align === "right" ? "justify-end" : "",
            shown ? "opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: "820ms" }}
        >
          {o.meta.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <dt className="text-muted-foreground/50">{k}</dt>
              <dd className="text-foreground/80">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Persistent chapter navigation: also a map of the world's depth. */
export function ChapterRail({
  chapter,
  onJump,
}: {
  chapter: Chapter;
  onJump: (at: number) => void;
}) {
  return (
    <nav className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex">
      {CHAPTERS.map((c) => {
        const active = c.id === chapter.id;
        return (
          <button
            key={c.id}
            onClick={() => onJump(c.at)}
            className="group flex items-center gap-3 text-right"
            aria-label={`Go to chapter ${c.label}`}
          >
            <span
              className={cn(
                "font-mono text-[9px] tracking-[0.24em] transition-all duration-500",
                active
                  ? "text-foreground opacity-100"
                  : "text-muted-foreground opacity-0 group-hover:opacity-70",
              )}
            >
              {c.label}
            </span>
            <span
              className={cn(
                "h-px transition-all duration-500",
                active
                  ? "w-8 bg-primary"
                  : "w-3 bg-muted-foreground/40 group-hover:w-5",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}

/** Depth read-out: reinforces that scrolling is spatial travel. */
export function DepthHud({ progress }: { progress: number }) {
  const [depth, setDepth] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const tick = () => {
      setDepth(Math.round(story.progress * 680));
      raf.current = window.setTimeout(tick, 80);
    };
    tick();
    return () => window.clearTimeout(raf.current);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-30 flex items-end gap-6 font-mono text-[10px] tracking-[0.24em] text-muted-foreground/70">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground/40">DEPTH</span>
        <span className="text-foreground/80">−{depth} Z</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground/40">PROGRESS</span>
        <span className="text-foreground/80">
          {String(Math.round(progress * 100)).padStart(3, "0")}%
        </span>
      </div>
      <div className="hidden h-8 w-px bg-border sm:block" />
      <span className="hidden sm:block">SCROLL TO TRAVEL</span>
    </div>
  );
}

/** Only entry point out of the experience, revealed at the convergence. */
export function FinalCta({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[14vh] z-30 flex flex-col items-center gap-6 transition-all duration-1000",
        visible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none translate-y-6 opacity-0",
      )}
    >
      <p className="max-w-sm px-6 text-center text-sm leading-relaxed text-muted-foreground">
        Bounded tracing, entity attribution and defensible evidence — in one
        investigation workspace.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/auth"
          className="rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_40px_-8px_var(--primary)] transition-transform hover:scale-[1.03]"
        >
          Enter the platform
        </Link>
        <Link
          to="/auth"
          className="rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent/40"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

/** Top-left brand mark, present the whole flight. */
export function BrandMark() {
  return (
    <div className="fixed left-6 top-6 z-30 flex items-center gap-3">
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-[10px] border border-primary/40" />
        <span className="absolute inset-1.5 rounded-[6px] bg-primary/70" />
      </span>
      <span className="font-mono text-xs tracking-[0.34em] text-foreground/90">
        TRACIFY
      </span>
    </div>
  );
}

/** Persistent sign-in entry point in the top-right corner. */
export function TopRightAuth() {
  return (
    <Link
      to="/auth"
      className="fixed right-6 top-6 z-30 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-xs font-medium text-foreground/90 shadow-lg backdrop-blur-md transition-all hover:border-primary/40 hover:bg-background/80 hover:text-primary"
    >
      Sign in
    </Link>
  );
}

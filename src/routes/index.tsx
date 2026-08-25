import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { scrollState } from "@/components/landing/scrollState";
import {
  ChapterLabel,
  FadeIn,
  MagneticButton,
  MetaRow,
  Reveal,
} from "@/components/landing/primitives";
import { CountTo } from "@/components/landing/Numbers";

const NetworkScene = lazy(() => import("@/components/landing/NetworkScene"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TRACIFY — Blockchain Intelligence for Connected Investigations" },
      {
        name: "description",
        content:
          "TRACIFY turns fragmented blockchain activity into connected investigative intelligence: trace virtual asset flows, reveal relationships, prioritise critical paths and build evidence-backed cases.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "TRACIFY — See the network behind the transaction",
      },
      {
        property: "og:description",
        content:
          "Trace the flow. Reveal the network. Build the evidence. A blockchain intelligence platform for virtual asset investigations.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/* ------------------------------------------------------------------ */
/* Persistent scene layer                                              */
/* ------------------------------------------------------------------ */

function SceneLayer() {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 900;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    const isLite = reduced || small || weak;
    setLite(isLite);
    scrollState.lite = isLite;
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
      data-scene
    >
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <NetworkScene lite={lite} />
        </Suspense>
      </ClientOnly>
      {/* Vignette keeps typography legible over the network. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 40%, rgba(6,7,10,0.28) 25%, rgba(6,7,10,0.78) 72%, #06070A 100%)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Investigation", href: "#investigation" },
  { label: "Technology", href: "#technology" },
];

function Nav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "flex w-full max-w-[1240px] items-center gap-6 px-4 py-3 transition-all duration-500 sm:px-5",
          solid
            ? "border border-lp-line bg-[rgb(9_11_16/0.72)] backdrop-blur-xl"
            : "border border-transparent bg-transparent",
        )}
      >
        <a href="#top" className="flex items-center gap-2.5">
          <TraceMark />
          <span className="text-[13px] font-semibold tracking-[0.22em] text-lp-text">
            TRACIFY
          </span>
        </a>

        <div className="ml-6 hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="lp-meta transition-colors hover:text-lp-text"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link
            to="/auth"
            className="lp-meta hidden transition-colors hover:text-lp-text sm:block"
          >
            Sign In
          </Link>
          <Link
            to="/dashboard"
            className="group flex h-9 items-center gap-2 border border-lp-line-strong px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-lp-text transition-colors hover:bg-lp-text hover:text-lp-bg"
          >
            Enter Platform
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function TraceMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5 text-lp-accent", className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.55"
      />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <path d="M12 12 5.2 8 M12 12l6.8 4 M12 12v6" stroke="currentColor" strokeWidth="1" />
      <circle cx="5.2" cy="8" r="1.1" fill="currentColor" opacity="0.7" />
      <circle cx="18.8" cy="16" r="1.1" fill="currentColor" opacity="0.7" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const MORPH_WORDS = ["NETWORK", "PATH", "SIGNAL", "CONNECTION", "TRUTH"];

function MorphWord() {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((v) => (v + 1) % MORPH_WORDS.length), 2600);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <span className="relative inline-block align-top">
      <span className="invisible">CONNECTION</span>
      {MORPH_WORDS.map((w, idx) => (
        <motion.span
          key={w}
          aria-hidden={idx !== i}
          className="absolute inset-0 whitespace-nowrap text-lp-accent"
          initial={false}
          animate={
            idx === i
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : { opacity: 0, y: -14, filter: "blur(6px)" }
          }
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);

  return (
    <section
      ref={ref}
      id="top"
      className="relative flex min-h-[100svh] items-center px-5 pt-28 sm:px-8"
    >
      <motion.div
        style={{ opacity, y }}
        className="mx-auto w-full max-w-[1240px]"
      >
        <FadeIn className="mb-8 flex items-center gap-3">
          <span className="size-1.5 animate-pulse rounded-full bg-lp-signal" />
          <span className="lp-meta">Blockchain Intelligence Platform</span>
        </FadeIn>

        <h1 className="lp-display max-w-[15ch] text-[clamp(2.9rem,8.4vw,7rem)] text-lp-text">
          <Reveal>See the</Reveal>
          <Reveal delay={0.08}>
            <MorphWord />
          </Reveal>
          <Reveal delay={0.16}>Behind the</Reveal>
          <Reveal delay={0.24}>Transaction.</Reveal>
        </h1>

        <FadeIn delay={0.4} className="mt-9 max-w-xl">
          <p className="text-[15px] leading-relaxed text-lp-text-2">
            TRACIFY transforms fragmented blockchain activity into connected
            investigative intelligence — helping investigators trace virtual
            asset flows, uncover relationships, identify critical paths, and
            build evidence-backed cases.
          </p>
        </FadeIn>

        <FadeIn delay={0.52} className="mt-10 flex flex-wrap items-center gap-3">
          <Link to="/dashboard">
            <MagneticButton>
              Start Exploring
              <ArrowRight className="size-4" />
            </MagneticButton>
          </Link>
          <a href="#signal">
            <MagneticButton variant="ghost">
              <Play className="size-3.5" />
              Watch Investigation
            </MagneticButton>
          </a>
        </FadeIn>

        <FadeIn
          delay={0.7}
          className="mt-16 flex items-center gap-4 sm:mt-24"
        >
          <span className="lp-meta">Scroll to trace</span>
          <span className="relative h-px w-24 overflow-hidden bg-lp-line-strong">
            <motion.span
              className="absolute inset-y-0 left-0 w-10 bg-lp-signal"
              animate={{ x: ["-100%", "240%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </span>
        </FadeIn>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Narrative sections                                                  */
/* ------------------------------------------------------------------ */

function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative mx-auto w-full max-w-[1240px] px-5 py-28 sm:px-8 sm:py-36",
        className,
      )}
    >
      {children}
    </section>
  );
}

const FRAGMENTS = [
  "0xA7…4C2",
  "USDT → 12,450",
  "BLOCK #21948372",
  "HOP 03",
  "POLYGON",
  "0x9F…E21",
  "0.482 ETH",
  "NONCE 41",
  "TRON",
  "0x3C…B90",
  "SWAP → 8,900 USDC",
  "BLOCK #21948394",
  "HOP 07",
  "ETHEREUM",
  "0xE1…77A",
  "BRIDGE OUT",
  "0x55…12D",
  "FEE 0.0021",
  "ARBITRUM",
  "0xBB…9F4",
];

/** Chapter 01 — overwhelming, unstructured activity that suddenly freezes. */
function ChapterProblem() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const chaos = useTransform(scrollYProgress, [0, 0.5, 0.72], [0, 1, 1]);
  const blur = useTransform(scrollYProgress, [0.4, 0.72], [3, 0]);

  return (
    <Section id="platform">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <ChapterLabel index="01" label="The Problem" />
          <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
            <Reveal>Data is not</Reveal>
            <Reveal delay={0.08}>Intelligence.</Reveal>
          </h2>
          <FadeIn delay={0.15} className="mt-8 max-w-md space-y-5">
            <p className="text-[15px] leading-relaxed text-lp-text-2">
              Blockchain networks expose enormous amounts of information. But
              transactions alone do not explain intent, relationships,
              ownership, or risk.
            </p>
            <p className="text-[15px] leading-relaxed text-lp-muted">
              The challenge is not finding the data. The challenge is
              understanding the network behind it.
            </p>
          </FadeIn>
          <FadeIn delay={0.25} className="mt-10 max-w-sm">
            <MetaRow k="Addresses observed" v="millions" />
            <MetaRow k="Possible routes" v="unbounded" />
            <MetaRow k="Context attached" v="none" tone="critical" />
          </FadeIn>
        </div>

        <div ref={ref} className="relative min-h-[420px]">
          <motion.div
            style={{ filter: useTransform(blur, (b) => `blur(${b}px)`) }}
            className="lp-frame lp-scanline relative h-full min-h-[420px] overflow-hidden p-5"
          >
            {FRAGMENTS.map((f, i) => {
              const col = i % 3;
              const row = Math.floor(i / 3);
              return (
                <motion.span
                  key={f}
                  className="mono absolute whitespace-nowrap text-[11px] text-lp-muted"
                  style={{
                    left: `${8 + col * 31}%`,
                    top: `${6 + row * 13}%`,
                    opacity: chaos,
                  }}
                  animate={{
                    x: [0, (i % 5) - 2, 0],
                    y: [0, ((i % 4) - 1.5) * 3, 0],
                  }}
                  transition={{
                    duration: 5 + (i % 5),
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {f}
                </motion.span>
              );
            })}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-lp-line bg-[rgb(6_7_10/0.7)] px-5 py-3">
              <span className="lp-meta">Unresolved activity</span>
              <span className="mono text-[11px] text-lp-critical">
                no structure detected
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

const SIGNAL_STEPS = [
  { k: "01", t: "One wallet activates", d: "A target address enters scope." },
  { k: "02", t: "Connected transfers illuminate", d: "Value-carrying edges resolve first." },
  { k: "03", t: "The path expands", d: "Bounded hop-by-hop, never the whole chain." },
  { k: "04", t: "Irrelevant nodes fade", d: "Noise is dimmed, not deleted." },
  { k: "05", t: "The route becomes clear", d: "A suspicious path emerges from the field." },
];

/** Chapter 02 — signal extraction from noise. */
function ChapterSignal() {
  return (
    <Section id="signal">
      <div className="max-w-4xl">
        <ChapterLabel index="02" label="Find the Signal" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>Somewhere</Reveal>
          <Reveal delay={0.08}>Inside the noise</Reveal>
          <Reveal delay={0.16}>Is a pattern.</Reveal>
        </h2>
      </div>

      <div className="mt-16 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <ol className="space-y-0">
          {SIGNAL_STEPS.map((s, i) => (
            <FadeIn key={s.k} delay={i * 0.06}>
              <li className="group flex items-start gap-6 border-t border-lp-line py-5 transition-colors hover:border-lp-line-strong">
                <span className="mono mt-0.5 text-[11px] text-lp-accent">{s.k}</span>
                <div className="min-w-0">
                  <p className="text-[15px] text-lp-text transition-colors">
                    {s.t}
                  </p>
                  <p className="mt-1 text-[13px] text-lp-muted">{s.d}</p>
                </div>
                <span className="ml-auto mt-2 h-px w-0 bg-lp-signal transition-all duration-500 group-hover:w-12" />
              </li>
            </FadeIn>
          ))}
        </ol>

        <div className="space-y-8">
          <FadeIn>
            <p className="text-[15px] leading-relaxed text-lp-text-2">
              TRACIFY helps investigators move beyond isolated transactions and
              reveal the relationships that matter.
            </p>
          </FadeIn>
          <FadeIn delay={0.1} className="space-y-0">
            {[
              "Multi-hop transaction tracing",
              "Connected wallet intelligence",
              "Path prioritisation",
              "Context-aware analysis",
            ].map((f) => (
              <div
                key={f}
                className="flex items-center gap-3 border-t border-lp-line py-3.5"
              >
                <span className="size-1 rounded-full bg-lp-signal" />
                <span className="text-[13px] text-lp-text-2">{f}</span>
              </div>
            ))}
          </FadeIn>
        </div>
      </div>
    </Section>
  );
}

const HOPS = [
  {
    hop: "HOP 01",
    role: "Target wallet",
    address: "0x8c29…7F1",
    out: "$142,500 USDT",
    risk: "Reported",
    net: "Ethereum",
    tone: "signal" as const,
  },
  {
    hop: "HOP 02",
    role: "Intermediary",
    address: "0x2c9e…47c",
    out: "$118,900 USDT",
    risk: "Elevated",
    net: "Ethereum",
    tone: "warning" as const,
  },
  {
    hop: "HOP 03",
    role: "Mule cluster",
    address: "0x5d18…c8d",
    out: "$96,400 USDT",
    risk: "High",
    net: "Polygon",
    tone: "critical" as const,
  },
  {
    hop: "HOP 04",
    role: "Cross-chain bridge",
    address: "0x3b07…c6b",
    out: "$88,050 USDT",
    risk: "High",
    net: "Bridge",
    tone: "critical" as const,
  },
  {
    hop: "HOP 05",
    role: "Attributed entity",
    address: "0x1521…052",
    out: "$77,400 USDT",
    risk: "Attributed VASP",
    net: "Exchange",
    tone: "verified" as const,
  },
];

/** Chapter 03 — the traced flow, hop by hop. */
function ChapterFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 60%"],
  });
  const height = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Section id="investigation">
      <div className="max-w-4xl">
        <ChapterLabel index="03" label="Follow the Flow" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>Follow the money.</Reveal>
          <Reveal delay={0.08}>Not just the data.</Reveal>
        </h2>
        <FadeIn delay={0.16} className="mt-7 max-w-xl">
          <p className="text-[15px] leading-relaxed text-lp-text-2">
            Value continuity is followed across hops — through intermediaries,
            mule clusters, and cross-chain movement — until the flow reaches an
            attributable endpoint.
          </p>
        </FadeIn>
      </div>

      <div ref={ref} className="relative mt-16 pl-6 sm:pl-10">
        {/* Flow rail */}
        <div className="absolute inset-y-0 left-0 w-px bg-lp-line sm:left-3">
          <motion.div
            style={{ height }}
            className="w-px bg-gradient-to-b from-lp-signal via-lp-accent to-lp-accent-2"
          />
        </div>

        <div className="space-y-4">
          {HOPS.map((h, i) => (
            <FadeIn key={h.hop} delay={i * 0.05}>
              <article className="group relative lp-frame p-5 transition-colors hover:border-lp-line-strong sm:p-6">
                <span className="absolute -left-6 top-8 h-px w-6 bg-lp-line sm:-left-7 sm:w-7" />
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <span className="mono text-[11px] tracking-[0.18em] text-lp-accent">
                    {h.hop}
                  </span>
                  <h3 className="text-[17px] text-lp-text">{h.role}</h3>
                  <span className="mono ml-auto text-[12px] text-lp-muted">
                    {h.address}
                  </span>
                </div>
                <div className="mt-4 grid gap-x-8 sm:grid-cols-3">
                  <MetaRow k="Outflow" v={h.out} />
                  <MetaRow k="Risk signal" v={h.risk} tone={h.tone} />
                  <MetaRow k="Network" v={h.net} />
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Chapter 04 — zoom out, clusters and convergence. */
function ChapterNetwork() {
  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-20">
        <div>
          <ChapterLabel index="04" label="Connect the Network" />
          <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
            <Reveal>Every address</Reveal>
            <Reveal delay={0.08}>Is part of</Reveal>
            <Reveal delay={0.16}>A bigger story.</Reveal>
          </h2>
          <FadeIn delay={0.2} className="mt-8 max-w-md">
            <p className="text-[15px] leading-relaxed text-lp-text-2">
              Investigate relationships, convergence points, clusters, and
              pathways across fragmented blockchain activity.
            </p>
          </FadeIn>
        </div>

        <FadeIn delay={0.12} className="self-end">
          <div className="lp-frame divide-y divide-[color:var(--lp-line)]">
            {[
              ["Wallet clusters", "grouped by behaviour"],
              ["Entity groups", "shared control signals"],
              ["Suspicious bridges", "cross-chain hand-offs"],
              ["High-risk nodes", "prioritised for review"],
              ["VASP connection points", "service interaction candidates"],
            ].map(([t, d]) => (
              <div
                key={t}
                className="group flex items-baseline justify-between gap-6 px-5 py-4 transition-colors hover:bg-[rgb(255_255_255/0.02)]"
              >
                <span className="text-[14px] text-lp-text">{t}</span>
                <span className="lp-meta text-right">{d}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

const LAYERS = [
  { n: "LAYER 01", t: "Address", d: "The raw on-chain identifier." },
  { n: "LAYER 02", t: "Behaviour", d: "How the address actually transacts." },
  { n: "LAYER 03", t: "Relationships", d: "Counterparties and repeated routes." },
  { n: "LAYER 04", t: "Entity intelligence", d: "Cluster and ownership candidates." },
  { n: "LAYER 05", t: "VASP context", d: "Potential service provider interaction." },
];

/** Chapter 05 — raw geometry receives intelligence layers. */
function ChapterContext() {
  return (
    <Section>
      <div className="max-w-4xl">
        <ChapterLabel index="05" label="Add Context" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>An address</Reveal>
          <Reveal delay={0.08}>Is just the beginning.</Reveal>
        </h2>
      </div>

      <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:gap-20">
        {/* Stacked translucent intelligence planes */}
        <div className="relative">
          {LAYERS.map((l, i) => (
            <motion.div
              key={l.n}
              initial={{ opacity: 0, y: 26, rotateX: 18 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                duration: 0.8,
                delay: i * 0.09,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="lp-frame relative -mt-px flex items-center gap-5 px-5 py-4 backdrop-blur-[2px]"
              style={{ marginLeft: `${i * 14}px` }}
            >
              <span className="mono text-[10px] tracking-[0.18em] text-lp-accent">
                {l.n}
              </span>
              <span className="text-[14px] text-lp-text">{l.t}</span>
              <span className="lp-meta ml-auto hidden sm:block">{l.d}</span>
            </motion.div>
          ))}
        </div>

        <div className="space-y-0">
          {[
            [
              "Entity resolution",
              "Understand potential relationships between wallets and real-world services.",
            ],
            [
              "VASP intelligence",
              "Surface potential interactions with virtual asset service providers.",
            ],
            [
              "Network context",
              "See how individual transactions connect to broader activity.",
            ],
            [
              "Risk signals",
              "Prioritise the paths and relationships that deserve attention.",
            ],
          ].map(([t, d], i) => (
            <FadeIn key={t} delay={i * 0.06}>
              <div className="border-t border-lp-line py-6">
                <h3 className="text-[15px] uppercase tracking-[0.1em] text-lp-text">
                  {t}
                </h3>
                <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-lp-muted">
                  {d}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

const REDUCTION = [
  { v: 1000, l: "Observed nodes" },
  { v: 200, l: "Relevant nodes" },
  { v: 24, l: "Connected addresses" },
  { v: 5, l: "Critical paths" },
  { v: 1, l: "Investigation" },
];

/** Chapter 06 — prioritisation as progressive reduction. */
function ChapterPrioritise() {
  return (
    <Section>
      <div className="max-w-4xl">
        <ChapterLabel index="06" label="Prioritise the Signal" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>Not every</Reveal>
          <Reveal delay={0.08}>Connection</Reveal>
          <Reveal delay={0.16}>Deserves attention.</Reveal>
        </h2>
      </div>

      <div className="mt-16 grid gap-px border border-lp-line bg-[color:var(--lp-line)] sm:grid-cols-5">
        {REDUCTION.map((r, i) => (
          <FadeIn key={r.l} delay={i * 0.08}>
            <div className="h-full bg-lp-bg px-5 py-8">
              <p
                className={cn(
                  "mono text-[clamp(1.8rem,3.4vw,2.8rem)] tabular-nums",
                  i === REDUCTION.length - 1 ? "text-lp-signal" : "text-lp-text",
                )}
              >
                <CountTo to={r.v} from={i === 0 ? 0 : REDUCTION[i - 1]!.v} />
              </p>
              <p className="lp-meta mt-3">{r.l}</p>
              <div className="mt-5 h-px w-full bg-lp-line">
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: Math.max(0.06, r.v / 1000) }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="h-px origin-left bg-lp-accent"
                />
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.2} className="mt-12 grid gap-x-16 gap-y-3 sm:grid-cols-2">
        {[
          "Risk scoring architecture — designed to support consistent prioritisation",
          "Suspicious path prioritisation — built to help investigators focus first",
          "Pattern detection — structured for repeatable behavioural review",
          "Network anomaly identification — designed to surface outliers",
          "Investigator-guided analysis — the analyst stays in control",
        ].map((c) => (
          <div key={c} className="flex gap-3 border-t border-lp-line py-3.5">
            <span className="mono text-[11px] text-lp-accent">—</span>
            <span className="text-[13px] leading-relaxed text-lp-text-2">{c}</span>
          </div>
        ))}
      </FadeIn>
    </Section>
  );
}

/** Chapter 07 — network geometry becomes case artefacts. */
function ChapterEvidence() {
  const stages = [
    { k: "Network", d: "Connected on-chain activity in scope." },
    { k: "Finding", d: "An observation with severity and confidence." },
    { k: "Evidence", d: "The records that support the observation." },
    { k: "Case", d: "A structured, defensible investigation." },
  ];

  return (
    <Section>
      <div className="max-w-4xl">
        <ChapterLabel index="07" label="Build the Case" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>Discovery is</Reveal>
          <Reveal delay={0.08}>Only the beginning.</Reveal>
        </h2>
      </div>

      <div className="mt-16 flex flex-col gap-px sm:flex-row">
        {stages.map((s, i) => (
          <FadeIn key={s.k} delay={i * 0.1} className="flex-1">
            <div className="lp-frame relative h-full p-6">
              <span className="mono text-[11px] text-lp-muted">
                0{i + 1}
              </span>
              <p className="mt-4 text-[20px] uppercase tracking-[0.06em] text-lp-text">
                {s.k}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-lp-muted">
                {s.d}
              </p>
              {i < stages.length - 1 ? (
                <ArrowRight className="absolute -right-3 top-1/2 hidden size-4 -translate-y-1/2 text-lp-accent sm:block" />
              ) : null}
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.2} className="mt-10 max-w-2xl">
        <p className="text-[15px] leading-relaxed text-lp-text-2">
          TRACIFY is designed to preserve investigative context across the
          entire workflow. Trace activity. Document findings. Attach evidence.
          Build the investigation.
        </p>
      </FadeIn>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace reveal                                                    */
/* ------------------------------------------------------------------ */

function WorkspaceReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "center 55%"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  return (
    <Section>
      <div className="max-w-4xl">
        <ChapterLabel index="08" label="The Workspace" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>From complexity</Reveal>
          <Reveal delay={0.08}>To clarity.</Reveal>
        </h2>
      </div>

      <div
        ref={ref}
        className="mt-16"
        style={{ perspective: "1600px" }}
      >
        <motion.div
          style={{ rotateX, scale, opacity, transformStyle: "preserve-3d" }}
          className="lp-frame overflow-hidden bg-[rgb(9_11_16/0.86)] backdrop-blur-xl"
        >
          {/* Chrome */}
          <div className="flex items-center gap-3 border-b border-lp-line px-4 py-3">
            <TraceMark className="size-4" />
            <span className="mono text-[11px] tracking-[0.18em] text-lp-text-2">
              INV-0314 · SECONDARY FAN-OUT BRANCH REVIEW
            </span>
            <span className="mono ml-auto text-[10px] text-lp-verified">
              ● TRACE ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[170px_minmax(0,1fr)_220px]">
            {/* Left: navigation */}
            <div className="hidden flex-col gap-1 border-r border-lp-line p-3 md:flex">
              {[
                "Dashboard",
                "Cases",
                "Investigations",
                "Findings",
                "Evidence vault",
                "Reports",
              ].map((n, i) => (
                <span
                  key={n}
                  className={cn(
                    "px-2.5 py-2 text-[12px]",
                    i === 2 ? "bg-[rgb(110_140_255/0.12)] text-lp-text" : "text-lp-muted",
                  )}
                >
                  {n}
                </span>
              ))}
            </div>

            {/* Center: graph */}
            <div className="relative min-h-[280px] overflow-hidden p-4">
              <MiniGraph />
            </div>

            {/* Right: intelligence panel */}
            <div className="border-t border-lp-line p-4 md:border-l md:border-t-0">
              <p className="lp-meta">Intelligence</p>
              <div className="mt-3">
                <MetaRow k="Address" v="0x8c29…7F1" />
                <MetaRow k="Outflow" v="$142,500" />
                <MetaRow k="Risk" v="High" tone="critical" />
                <MetaRow k="Entity" v="Candidate VASP" tone="signal" />
                <MetaRow k="Continuity" v="87%" tone="verified" />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex items-center gap-4 border-t border-lp-line px-4 py-3">
            <span className="lp-meta">Timeline</span>
            <div className="relative h-px flex-1 bg-lp-line">
              {[12, 28, 41, 56, 73, 88].map((x) => (
                <span
                  key={x}
                  className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-lp-accent"
                  style={{ left: `${x}%` }}
                />
              ))}
            </div>
            <span className="mono text-[10px] text-lp-muted">30D</span>
          </div>
        </motion.div>
      </div>

      {/* Annotations */}
      <div className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Trace paths", "Follow multi-hop movement"],
          ["Entity context", "Connect addresses to investigative signals"],
          ["Evidence", "Preserve what supports the case"],
          ["Findings", "Turn observations into structured intelligence"],
        ].map(([t, d], i) => (
          <FadeIn key={t} delay={i * 0.07}>
            <div className="border-t border-lp-line pt-4">
              <p className="lp-meta text-lp-accent">{t}</p>
              <p className="mt-2 text-[13px] text-lp-text-2">{d}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

/** Small SVG graph used inside the workspace reveal. */
function MiniGraph() {
  const nodes = [
    { x: 8, y: 52, r: 5, c: "var(--lp-critical)" },
    { x: 30, y: 30, r: 4, c: "var(--lp-signal)" },
    { x: 30, y: 74, r: 4, c: "var(--lp-accent)" },
    { x: 54, y: 22, r: 4, c: "var(--lp-accent)" },
    { x: 54, y: 58, r: 4, c: "var(--lp-accent-2)" },
    { x: 54, y: 88, r: 3.4, c: "var(--lp-muted)" },
    { x: 80, y: 40, r: 5, c: "var(--lp-verified)" },
    { x: 80, y: 76, r: 4, c: "var(--lp-warning)" },
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 4],
    [2, 5],
    [3, 6],
    [4, 6],
    [4, 7],
    [5, 7],
  ];
  return (
    <svg viewBox="0 0 100 100" className="size-full" preserveAspectRatio="none">
      {edges.map(([a, b], i) => {
        const n1 = nodes[a!]!;
        const n2 = nodes[b!]!;
        const hot = i === 0 || i === 2 || i === 6;
        return (
          <g key={i}>
            <line
              x1={n1.x}
              y1={n1.y}
              x2={n2.x}
              y2={n2.y}
              stroke={hot ? "var(--lp-signal)" : "var(--lp-line-strong)"}
              strokeWidth={hot ? 0.5 : 0.3}
              vectorEffect="non-scaling-stroke"
            />
            {hot ? (
              <circle r="0.9" fill="#EAF2FF">
                <animateMotion
                  dur={`${2.6 + i * 0.4}s`}
                  repeatCount="indefinite"
                  path={`M${n1.x},${n1.y} L${n2.x},${n2.y}`}
                />
              </circle>
            ) : null}
          </g>
        );
      })}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r / 2.2} fill={n.c} opacity={0.95} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Capabilities constellation                                          */
/* ------------------------------------------------------------------ */

const CAPABILITIES = [
  {
    key: "TRACE",
    t: "Transaction tracing",
    d: "Follow virtual asset movement across connected paths.",
  },
  {
    key: "CONNECT",
    t: "Network exploration",
    d: "Visualise wallet relationships and transaction structures.",
  },
  {
    key: "CONTEXT",
    t: "Entity context",
    d: "Build intelligence around wallets, clusters, and potential services.",
  },
  {
    key: "VASP",
    t: "VASP intelligence",
    d: "Support investigations involving virtual asset service provider interactions.",
  },
  {
    key: "SIGNAL",
    t: "Findings",
    d: "Turn observations into structured investigative signals.",
  },
  {
    key: "VAULT",
    t: "Evidence vault",
    d: "Preserve transactions, records, references, and supporting material.",
  },
  {
    key: "TIME",
    t: "Timeline analysis",
    d: "Understand how activity unfolds over time.",
  },
  {
    key: "REPORT",
    t: "Investigation reports",
    d: "Structure intelligence into a defensible investigation narrative.",
  },
];

function Constellation() {
  const [active, setActive] = useState(0);

  return (
    <Section id="capabilities">
      <div className="max-w-4xl">
        <ChapterLabel index="09" label="Capabilities" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>One system.</Reveal>
          <Reveal delay={0.08}>Eight orbits.</Reveal>
        </h2>
      </div>

      <div className="mt-16 grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-20">
        <div className="relative mx-auto aspect-square w-full max-w-[520px]">
          {/* Orbit rings */}
          {[38, 50].map((r) => (
            <span
              key={r}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-lp-line"
              style={{ width: `${r * 2}%`, height: `${r * 2}%` }}
            />
          ))}

          {/* Core */}
          <div className="absolute left-1/2 top-1/2 flex size-[26%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-lp-line-strong bg-[rgb(9_11_16/0.8)] backdrop-blur-md">
            <TraceMark className="size-5" />
            <span className="mono text-[9px] tracking-[0.2em] text-lp-text">
              TRACIFY
            </span>
          </div>

          {CAPABILITIES.map((c, i) => {
            const angle = (i / CAPABILITIES.length) * Math.PI * 2 - Math.PI / 2;
            const radius = i % 2 === 0 ? 38 : 50;
            const x = 50 + Math.cos(angle) * radius;
            const y = 50 + Math.sin(angle) * radius;
            const on = active === i;
            return (
              <button
                key={c.key}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={c.t}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span
                  className={cn(
                    "mono flex items-center gap-2 border px-2.5 py-1.5 text-[9px] tracking-[0.16em] transition-all duration-300",
                    on
                      ? "border-lp-accent bg-[rgb(110_140_255/0.14)] text-lp-text"
                      : "border-lp-line bg-[rgb(9_11_16/0.7)] text-lp-muted hover:border-lp-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "size-1 rounded-full transition-colors",
                      on ? "bg-lp-signal" : "bg-lp-muted",
                    )}
                  />
                  {c.key}
                </span>
              </button>
            );
          })}
        </div>

        <div>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="mono text-[11px] tracking-[0.2em] text-lp-accent">
              {CAPABILITIES[active]!.key}
            </p>
            <h3 className="mt-4 text-[clamp(1.4rem,2.6vw,2rem)] uppercase tracking-[-0.01em] text-lp-text">
              {CAPABILITIES[active]!.t}
            </h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-lp-text-2">
              {CAPABILITIES[active]!.d}
            </p>
          </motion.div>

          <div className="mt-10 space-y-0">
            {CAPABILITIES.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-4 border-t border-lp-line py-3 text-left transition-colors",
                  active === i ? "text-lp-text" : "text-lp-muted hover:text-lp-text-2",
                )}
              >
                <span className="mono text-[10px]">0{i + 1}</span>
                <span className="text-[13px]">{c.t}</span>
                <ArrowUpRight
                  className={cn(
                    "ml-auto size-3.5 transition-opacity",
                    active === i ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const STEPS = [
  ["Start", "Enter a target wallet, transaction, or investigation context."],
  ["Explore", "Map connected activity and expand relevant paths."],
  ["Trace", "Follow movement across multiple transaction hops."],
  ["Connect", "Add entity and VASP context to important relationships."],
  ["Prioritise", "Focus on suspicious paths and relevant investigative signals."],
  ["Build", "Capture findings, preserve evidence, and structure the case."],
];

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 65%"],
  });
  const width = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Section id="how-it-works">
      <div className="max-w-4xl">
        <ChapterLabel index="10" label="Investigate" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>From address</Reveal>
          <Reveal delay={0.08}>To actionable</Reveal>
          <Reveal delay={0.16}>Intelligence.</Reveal>
        </h2>
      </div>

      <div ref={ref} className="mt-16">
        <div className="relative h-px w-full bg-lp-line">
          <motion.div style={{ width }} className="h-px bg-lp-accent" />
        </div>
        <div className="grid gap-x-8 gap-y-10 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <FadeIn key={t} delay={i * 0.06}>
              <div>
                <p className="mono text-[11px] tracking-[0.2em] text-lp-accent">
                  STEP 0{i + 1}
                </p>
                <h3 className="mt-3 text-[18px] uppercase tracking-[0.04em] text-lp-text">
                  {t}
                </h3>
                <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-lp-muted">
                  {d}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Modules + technology                                                */
/* ------------------------------------------------------------------ */

const MODULES = [
  [
    "Case management",
    "Organise investigations around structured cases, priorities, assignments, and investigative context.",
    "/cases",
  ],
  [
    "Investigation canvas",
    "Explore connected blockchain activity through a spatial transaction graph.",
    "/investigations",
  ],
  [
    "Findings",
    "Capture important investigative observations with severity, confidence, and supporting context.",
    "/findings",
  ],
  [
    "Evidence vault",
    "Collect and organise records that support the investigation.",
    "/evidence",
  ],
  [
    "Reports",
    "Transform investigation data into structured reporting workflows.",
    "/reports",
  ],
] as const;

function Modules() {
  return (
    <Section>
      <div className="max-w-4xl">
        <ChapterLabel index="11" label="Platform Modules" />
        <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
          <Reveal>Five portals</Reveal>
          <Reveal delay={0.08}>Into the case.</Reveal>
        </h2>
      </div>

      <div className="mt-14 grid gap-px bg-[color:var(--lp-line)] md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(([t, d, to], i) => (
          <FadeIn key={t} delay={i * 0.06} className="h-full">
            <Link
              to={to}
              className="group relative flex h-full flex-col justify-between gap-10 overflow-hidden bg-lp-bg p-7 transition-colors hover:bg-[rgb(13_16_23/0.9)]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: "rgba(110,140,255,0.28)" }}
              />
              <div>
                <span className="mono text-[11px] text-lp-muted">0{i + 1}</span>
                <h3 className="mt-4 text-[20px] uppercase tracking-[0.02em] text-lp-text">
                  {t}
                </h3>
                <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-lp-muted">
                  {d}
                </p>
              </div>
              <span className="lp-meta flex items-center gap-2 text-lp-accent">
                Open module
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

const STACK = [
  ["Data", "Blockchain providers · Transaction sources · Intelligence sources"],
  ["Analysis", "Tracing · Graph analysis · Entity resolution · Risk analysis"],
  ["Intelligence", "Findings · Evidence · Relationships · Investigation context"],
  ["Workspace", "Cases · Visual investigation · Timeline · Reports"],
];

function Technology() {
  return (
    <Section id="technology">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <ChapterLabel index="12" label="Technology" />
          <h2 className="lp-display mt-8 text-[clamp(2.2rem,5.2vw,4.4rem)] text-lp-text">
            <Reveal>Built for the</Reveal>
            <Reveal delay={0.08}>Investigation</Reveal>
            <Reveal delay={0.16}>Layer.</Reveal>
          </h2>
          <FadeIn delay={0.2} className="mt-8 max-w-md">
            <p className="text-[15px] leading-relaxed text-lp-text-2">
              Raw chain activity flows upward through analysis and intelligence
              until it arrives in the investigator&apos;s workspace as
              structured, reviewable context.
            </p>
          </FadeIn>
        </div>

        <div className="flex flex-col-reverse">
          {STACK.map(([t, d], i) => (
            <FadeIn key={t} delay={i * 0.08}>
              <div className="lp-frame relative -mt-px flex flex-col gap-2 p-6">
                <div className="flex items-center gap-3">
                  <span className="mono text-[10px] tracking-[0.2em] text-lp-accent">
                    L{STACK.length - i}
                  </span>
                  <span className="text-[17px] uppercase tracking-[0.04em] text-lp-text">
                    {t}
                  </span>
                </div>
                <p className="mono text-[11px] leading-relaxed text-lp-muted">
                  {d}
                </p>
                {/* Upward data flow */}
                <motion.span
                  aria-hidden
                  className="absolute -top-px left-8 h-px w-16 bg-lp-signal"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA + footer                                                  */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  return (
    <Section className="py-40 text-center sm:py-52">
      <h2 className="lp-display mx-auto max-w-[18ch] text-[clamp(2.4rem,6.4vw,5.4rem)] text-lp-text">
        <Reveal>The network</Reveal>
        <Reveal delay={0.08}>Was always there.</Reveal>
      </h2>
      <h3 className="lp-display mx-auto mt-8 max-w-[20ch] text-[clamp(1.5rem,3.4vw,2.6rem)] text-lp-muted">
        <Reveal delay={0.16}>You just needed</Reveal>
        <Reveal delay={0.22}>The right way to see it.</Reveal>
      </h3>

      <FadeIn delay={0.34} className="mt-16 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5">
          <TraceMark className="size-6" />
          <span className="text-[15px] font-semibold tracking-[0.3em] text-lp-text">
            TRACIFY
          </span>
        </div>
        <p className="mono text-[11px] tracking-[0.18em] text-lp-muted">
          Trace the flow. Reveal the network. Build the evidence.
        </p>
      </FadeIn>

      <FadeIn delay={0.44} className="mt-12 flex flex-wrap justify-center gap-3">
        <Link to="/dashboard">
          <MagneticButton>
            Enter TRACIFY
            <ArrowRight className="size-4" />
          </MagneticButton>
        </Link>
        <a href="#platform">
          <MagneticButton variant="ghost">Explore the Platform</MagneticButton>
        </a>
      </FadeIn>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-lp-line">
      {/* Animated network line */}
      <svg
        className="absolute inset-x-0 -top-px h-px w-full overflow-visible"
        aria-hidden
      >
        <motion.line
          x1="0%"
          y1="0"
          x2="100%"
          y2="0"
          stroke="var(--lp-accent)"
          strokeWidth="1"
          strokeDasharray="60 240"
          animate={{ strokeDashoffset: [0, -300] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </svg>

      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <TraceMark />
            <span className="text-[13px] font-semibold tracking-[0.22em] text-lp-text">
              TRACIFY
            </span>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-lp-muted">
            Blockchain intelligence for connected investigations.
          </p>
        </div>

        <FooterCol
          title="Explore"
          items={[
            ["Platform", "#platform"],
            ["Capabilities", "#capabilities"],
            ["Technology", "#technology"],
            ["How it works", "#how-it-works"],
          ]}
        />

        <div>
          <p className="lp-meta">Application</p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link to="/auth" className="text-[13px] text-lp-text-2 hover:text-lp-text">
              Sign In
            </Link>
            <Link
              to="/dashboard"
              className="text-[13px] text-lp-text-2 hover:text-lp-text"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <FooterCol
          title="Legal"
          items={[
            ["Privacy", "#top"],
            ["Terms", "#top"],
          ]}
        />
      </div>

      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between border-t border-lp-line px-5 py-6 sm:px-8">
        <span className="mono text-[11px] text-lp-muted">© 2026 TRACIFY</span>
        <span className="mono text-[11px] text-lp-muted">
          Every transaction leaves a trace.
        </span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <p className="lp-meta">{title}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {items.map(([label, href]) => (
          <a
            key={label}
            href={href}
            className="text-[13px] text-lp-text-2 transition-colors hover:text-lp-text"
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Landing() {
  // Drive the WebGL scene from page scroll and pointer without re-rendering.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollState.progress = max > 0 ? window.scrollY / max : 0;
    };
    const onPointer = (e: PointerEvent) => {
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onVisibility = () => {
      scrollState.visible = document.visibilityState === "visible";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Smooth in-page anchor navigation.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-lp-bg text-lp-text antialiased">
      <SceneLayer />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <ChapterProblem />
        <ChapterSignal />
        <ChapterFlow />
        <ChapterNetwork />
        <ChapterContext />
        <ChapterPrioritise />
        <ChapterEvidence />
        <WorkspaceReveal />
        <Constellation />
        <HowItWorks />
        <Modules />
        <Technology />
        <FinalCTA />
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}

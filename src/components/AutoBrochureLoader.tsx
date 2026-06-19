/**
 * AutoBrochureLoader.tsx
 * Animated step-progress overlay shown during the auto-brochure generation flow.
 * Pure presentational — no store reads, no side effects.
 * Extracted from analysis.tsx.
 */

import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles, Camera, CircleDot, Map as MapIcon } from "lucide-react";

const AUTO_BROCHURE_STEPS = [
  { label: "Loading vicinity data", Icon: MapIcon },
  { label: "Selecting key POIs", Icon: MapPin },
  { label: "Enabling distance rings", Icon: CircleDot },
  { label: "Capturing map snapshot", Icon: Camera },
  { label: "Preparing brochure", Icon: Sparkles },
];

interface AutoBrochureLoaderProps {
  step: number;
  isGenerating: boolean;
}

export function AutoBrochureLoader({ step, isGenerating }: AutoBrochureLoaderProps) {
  // Derive displayed step — if still generating, clamp at 0 (Loading data)
  const displayStep = isGenerating ? 0 : step;
  const ActiveIcon = AUTO_BROCHURE_STEPS[displayStep]?.Icon ?? Sparkles;

  return (
    <AnimatePresence>
      <motion.div
        key="auto-brochure-loader"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[150] flex items-center justify-center font-body bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-8 bg-white/5 border border-white/10 rounded-3xl p-10 shadow-2xl"
          style={{ minWidth: 340 }}
        >
          {/* Pulsing gold ring */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(200, 185, 126, 0.15)" }}
            />
            <div
              className="w-20 h-20 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "rgba(200, 185, 126, 0.2)", borderTopColor: "var(--gold)" }}
            />
            <ActiveIcon className="absolute text-[var(--gold)] w-7 h-7" />
          </div>

          {/* Title */}
          <div className="text-center">
            <div
              className="text-[10px] tracking-[0.25em] uppercase font-bold mb-2"
              style={{ color: "var(--gold)" }}
            >
              Vicinity Intelligence
            </div>
            <motion.h2
              key={displayStep}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white text-xl font-heading font-semibold"
            >
              {AUTO_BROCHURE_STEPS[displayStep]?.label}…
            </motion.h2>
          </div>

          {/* Step indicators */}
          <div className="flex flex-col gap-3.5 w-full">
            {AUTO_BROCHURE_STEPS.map((s, i) => {
              const done = i < displayStep;
              const active = i === displayStep;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4"
                >
                  {/* Status dot */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-500"
                    style={{
                      background: done
                        ? "var(--gold)"
                        : active
                        ? "rgba(200, 185, 126, 0.15)"
                        : "rgba(255, 255, 255, 0.05)",
                      border: active
                        ? "1.5px solid var(--gold)"
                        : done
                        ? "none"
                        : "1px solid rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    {done ? (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path
                          d="M1 5L4.5 8L11 1"
                          stroke="var(--navy)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : active ? (
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ background: "var(--gold)" }}
                      />
                    ) : null}
                  </div>

                  {/* Label */}
                  <span
                    className="text-sm font-medium transition-all duration-300"
                    style={{
                      color: done
                        ? "var(--gold)"
                        : active
                        ? "white"
                        : "rgba(255, 255, 255, 0.4)",
                    }}
                  >
                    {s.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Subtitle hint */}
          <p className="text-xs tracking-wide text-center text-white/30 mt-2">
            Preparing your professional brochure
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

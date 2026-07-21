import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export function HealthBadge({ score, previousScore, compact = false }: { score: number; previousScore?: number; compact?: boolean }) {
  const [displayScore, setDisplayScore] = useState(score);
  const displayScoreRef = useRef(score);
  const normalized = Math.max(0, Math.min(100, score));
  const displayNormalized = Math.max(0, Math.min(100, displayScore));
  const radius = compact ? 25 : 32;
  const size = compact ? 68 : 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - displayNormalized / 100);
  const status = statusFor(score);
  const stroke = colorFor(score);
  const improvement = typeof previousScore === "number" ? score - previousScore : null;

  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayScore(score);
      displayScoreRef.current = score;
      return;
    }
    const start = displayScoreRef.current;
    const delta = score - start;
    let frame = 0;
    const frames = 28;
    const id = window.setInterval(() => {
      frame += 1;
      const next = Math.round(start + delta * easeOutCubic(frame / frames));
      setDisplayScore(next);
      displayScoreRef.current = next;
      if (frame >= frames) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [score]);

  const ringStyle = useMemo(() => ({
    strokeDasharray: circumference,
    strokeDashoffset: dashOffset
  }), [circumference, dashOffset]);

  return (
    <div className="flex shrink-0 items-center gap-3" aria-label={`Geometry Health Score ${normalized}%`}>
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${normalized}% ${status}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#dbe7f3" strokeWidth="6" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            style={ringStyle}
            data-testid="health-progress-ring"
            data-dashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute text-center">
          <div className={`${compact ? "text-lg" : "text-2xl"} font-semibold leading-none text-slate-950`}>
            {displayScore}<span className="text-xs">%</span>
          </div>
          <div className="mt-0.5 text-[10px] uppercase text-slate-500">Health</div>
        </div>
      </div>
      {!compact ? (
        <div className="min-w-[120px]">
          <div className="text-sm font-semibold text-slate-950">{status}</div>
          {improvement !== null && improvement > 0 ? <div className="text-xs font-medium text-emerald-700">+{improvement} points</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function statusFor(score: number) {
  if (score >= 95) return "Excellent";
  if (score >= 85) return "Ready with minor warnings";
  if (score >= 65) return "Needs repair";
  if (score >= 40) return "Repairs required";
  return "Critical geometry problems";
}

function colorFor(score: number) {
  if (score >= 85) return "#10b981";
  if (score >= 65) return "#38bdf8";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

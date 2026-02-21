"use client";

/**
 * Rich inline AI insight callout.
 *
 * Numbers, percentages and key figures found in the AI text are highlighted
 * with a violet accent so the data-backed reasoning stands out at a glance.
 *
 * Shows a loading skeleton while the insight is being generated, and renders
 * nothing once dismissed or when no text is available.
 */

interface InsightCalloutProps {
  text: string | null;
  isLoading: boolean;
}

/**
 * Break the insight text into alternating plain/highlighted spans.
 * Patterns highlighted:
 *   - percentages:           76%, 12.3%
 *   - plain numbers ≥ 2 digits: 177,714  14  3
 *   - day counts:            120d, 45 days
 */
function HighlightedText({ text }: { text: string }) {
  // Match: percentage OR comma-formatted number OR plain integer (≥2 digits) OR Nd/N days
  const pattern = /(\d[\d,]*\.?\d*%|\d+d\b|\d[\d,]+|\b\d{2,}\b)/g;
  const parts: { str: string; highlight: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ str: text.slice(last, m.index), highlight: false });
    }
    parts.push({ str: m[0], highlight: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ str: text.slice(last), highlight: false });
  }

  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <strong key={i} className="text-violet-300 font-semibold">
            {p.str}
          </strong>
        ) : (
          <span key={i}>{p.str}</span>
        ),
      )}
    </>
  );
}

export function InsightCallout({ text, isLoading }: InsightCalloutProps) {
  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-violet-900/30">
        <div className="flex items-center gap-2 bg-violet-950/20 border border-violet-900/30 rounded-lg px-3 py-2.5">
          <span className="w-3 h-3 shrink-0 border border-violet-700 border-t-violet-300 rounded-full animate-spin" />
          <span className="text-xs text-violet-500 animate-pulse">
            Analysing…
          </span>
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="mt-3 pt-3 border-t border-violet-900/30">
      <div className="bg-violet-950/25 border border-violet-800/40 rounded-lg px-3 py-2.5">
        {/* Header row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <SparkleIcon />
          <span className="text-violet-500 text-[10px] font-semibold uppercase tracking-widest">
            AI Analysis
          </span>
        </div>
        {/* Body with highlighted figures */}
        <p className="text-xs text-violet-200/90 leading-relaxed">
          <HighlightedText text={text} />
        </p>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      className="w-3 h-3 shrink-0 text-violet-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

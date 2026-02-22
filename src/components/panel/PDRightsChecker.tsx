"use client";

import { useState, useRef } from "react";
import { SectionCard } from "./SectionCard";
import { useSiteStore } from "@/stores/siteStore";
import type { PDCheckResult, PDVerdict } from "@/app/api/pd-check/route";
import type { ConstraintType } from "@/types/constraints";

const VERDICT_CONFIG: Record<
  PDVerdict,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  permitted: {
    label: "Permitted Development",
    color: "text-green-400",
    bg: "bg-green-950/50",
    border: "border-green-800/60",
    dot: "bg-green-500",
  },
  "prior-approval": {
    label: "Prior Approval Required",
    color: "text-amber-400",
    bg: "bg-amber-950/50",
    border: "border-amber-800/60",
    dot: "bg-amber-500",
  },
  "full-planning": {
    label: "Full Planning Required",
    color: "text-red-400",
    bg: "bg-red-950/50",
    border: "border-red-800/60",
    dot: "bg-red-500",
  },
  unclear: {
    label: "Unclear — Seek Advice",
    color: "text-gray-400",
    bg: "bg-gray-800/50",
    border: "border-gray-700/60",
    dot: "bg-gray-500",
  },
};

const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  "green-belt": "Green Belt",
  "conservation-area": "Conservation Area",
  "article-4": "Article 4 Direction",
  "flood-risk": "Flood Risk Zone",
};

/**
 * Permitted Development Rights Checker.
 * User describes proposed works; Gemini applies GPDO 2015 rules against
 * the site's active statutory constraints and returns a structured verdict.
 */
export function PDRightsChecker() {
  const { siteContext } = useSiteStore();
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PDCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const constraints = siteContext?.statutoryConstraints;

  // Active constraint flags to pass to the API
  const activeConstraints: Partial<Record<ConstraintType, boolean>> = {
    "green-belt": constraints?.["green-belt"]?.intersects ?? false,
    "conservation-area":
      constraints?.["conservation-area"]?.intersects ?? false,
    "article-4": constraints?.["article-4"]?.intersects ?? false,
    "flood-risk": constraints?.["flood-risk"]?.intersects ?? false,
  };

  const activeConstraintLabels = (
    Object.entries(activeConstraints) as [ConstraintType, boolean][]
  )
    .filter(([, v]) => v)
    .map(([k]) => CONSTRAINT_LABELS[k]);

  async function handleCheck() {
    if (!description.trim() || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/pd-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          constraints: activeConstraints,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as PDCheckResult;
      setResult(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const verdictCfg = result ? VERDICT_CONFIG[result.verdict] : null;

  // Collapsed summary line
  const summary = result ? (
    <div className="flex items-center gap-2 mt-0.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${verdictCfg!.dot}`} />
      <span className={`text-xs font-medium ${verdictCfg!.color}`}>
        {verdictCfg!.label}
      </span>
      {result.pdClass && (
        <span className="text-[10px] text-gray-600 ml-1">{result.pdClass}</span>
      )}
    </div>
  ) : (
    <span className="text-xs text-gray-600">
      Describe proposed works to check PD rights
    </span>
  );

  return (
    <SectionCard
      title="PD Rights Checker"
      summary={summary}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div className="space-y-3 mt-1">
        {/* Active constraints notice */}
        {activeConstraintLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeConstraintLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Description input */}
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
            Describe the proposed works
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCheck();
            }}
            placeholder={
              "e.g. Single-storey rear extension, depth 4m, height 3.5m to a semi-detached dwellinghouse"
            }
            rows={3}
            className="w-full text-xs text-gray-300 placeholder-gray-600 bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-violet-600/60 focus:ring-1 focus:ring-violet-600/30 transition-colors"
          />
        </div>

        <button
          onClick={handleCheck}
          disabled={!description.trim() || loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            bg-violet-900/50 border border-violet-700/60 text-violet-300 hover:bg-violet-900/70
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 rounded-full border border-violet-500 border-t-transparent animate-spin shrink-0" />
              Checking GPDO…
            </>
          ) : (
            "Check PD rights"
          )}
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Result card */}
        {result && verdictCfg && (
          <div
            className={`rounded-xl border ${verdictCfg.border} ${verdictCfg.bg} p-3 space-y-3`}
          >
            {/* Verdict header */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${verdictCfg.dot}`}
              />
              <span className={`text-sm font-semibold ${verdictCfg.color}`}>
                {verdictCfg.label}
              </span>
            </div>

            {result.pdClass && (
              <p className="text-[11px] text-gray-400 font-medium">
                {result.pdClass}
              </p>
            )}

            {/* Rationale */}
            <p className="text-xs text-gray-300 leading-relaxed">
              {result.rationale}
            </p>

            {/* Conditions */}
            {result.conditions.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">
                  Key conditions
                </p>
                <ul className="space-y-1">
                  {result.conditions.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-gray-400"
                    >
                      <span className="w-1 h-1 rounded-full bg-gray-600 mt-1.5 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Restrictions */}
            {result.restrictions.length > 0 && (
              <div>
                <p className="text-[10px] text-amber-500/80 uppercase tracking-wider mb-1.5 font-semibold">
                  Restrictions / risks
                </p>
                <ul className="space-y-1">
                  {result.restrictions.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-amber-400/80"
                    >
                      <span className="w-1 h-1 rounded-full bg-amber-600/60 mt-1.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setResult(null);
                setDescription("");
              }}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors mt-1"
            >
              Clear and check another proposal
            </button>
          </div>
        )}

        {/* Legal disclaimer */}
        <p className="text-[9px] text-gray-700 leading-tight border-t border-gray-800 pt-2">
          AI-generated indicative assessment only. Always confirm PD rights with
          your Local Planning Authority before commencing works. This does not
          constitute professional planning advice.
        </p>
      </div>
    </SectionCard>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useCouncilStore } from "@/stores/councilStore";
import { SuggestionCard } from "./SuggestionCard";
export function CouncilPanel() {
  const {
    stages,
    suggestions,
    isAnalysing,
    currentStageNum,
    cachedAt,
    selectedSuggestionId,
  } = useCouncilStore();
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll selected card into view when selection changes (e.g. map click)
  useEffect(() => {
    if (!selectedSuggestionId) return;
    const el = cardRefs.current.get(selectedSuggestionId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedSuggestionId]);

  const completedStages = stages.filter((s) => s.status === "complete").length;

  // Sort by priority: high → medium → low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...suggestions].sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );

  const currentStageName = currentStageNum
    ? stages.find((s) => s.stageNum === currentStageNum)?.name
    : null;

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Council Analysis</h2>
          <span className="text-xs text-gray-500">
            {completedStages}/10 stages
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedStages / 10) * 100}%` }}
          />
        </div>

        {/* Current stage indicator / cache notice */}
        {isAnalysing && cachedAt && (
          <p className="mt-1.5 text-[11px] text-amber-500/70 flex items-center gap-1.5">
            <svg
              className="w-3 h-3 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            Using cached analysis from{" "}
            {new Date(cachedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
        {isAnalysing && !cachedAt && currentStageName && (
          <p className="mt-1.5 text-[11px] text-indigo-400 flex items-center gap-1.5">
            <span className="block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            {currentStageName}
          </p>
        )}
      </div>

      {/* Suggestion list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {sorted.length === 0 && isAnalysing && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <span className="block w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
            <p className="text-xs">Generating suggestions…</p>
          </div>
        )}

        {sorted.length === 0 && !isAnalysing && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <p className="text-xs text-center">
              No suggestions yet.
              <br />
              Click "Ask for Suggestions" to begin.
            </p>
          </div>
        )}

        {sorted.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              if (el) cardRefs.current.set(s.id, el);
              else cardRefs.current.delete(s.id);
            }}
          >
            <SuggestionCard suggestion={s} />
          </div>
        ))}
      </div>

      {/* Footer summary */}
      {suggestions.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-gray-800 bg-gray-950">
          <p className="text-[11px] text-gray-600">
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}{" "}
            across {completedStages} stage{completedStages !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

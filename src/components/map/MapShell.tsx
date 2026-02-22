"use client";

import { MapCanvas } from "./MapCanvas";
import { MapPrompt } from "./MapPrompt";
import { BuildingHoverCard } from "./BuildingHoverCard";
import { MapLayerToggle } from "./MapLayerToggle";
import { FloatingWidget } from "./FloatingWidget";
import { SidePanel } from "@/components/panel/SidePanel";
import { BuildPanel } from "@/components/panel/BuildPanel";
import { BuildInsightsPanel } from "@/components/panel/BuildInsightsPanel";
import { ProjectPanel } from "@/components/panel/ProjectPanel";
import {
  IdentityGate,
  IdentityBadge,
} from "@/components/identity/IdentityGate";
import { CouncilView } from "@/components/council/CouncilView";
import { MarketValueLegend } from "./MarketValueLegend";
import { useSiteStore } from "@/stores/siteStore";
import { useDevStore } from "@/stores/devStore";
import { useIdentityStore } from "@/stores/identityStore";
import { useProjectStore } from "@/stores/projectStore";
import { useState, useEffect } from "react";

/**
 * Top-level layout container:
 *   Full-screen map with floating widgets overlaid.
 *   Build widget — top-left when build mode active.
 *   Site Context widget — top-right when a site is selected.
 * Wrapped in IdentityGate so users identify their role before exploring.
 *
 * When role === 'council', renders CouncilView instead of the developer layout.
 */
export function MapShell() {
  const { siteContext, clearSiteContext } = useSiteStore();
  const { buildMode, buildStep, deactivateBuild } = useDevStore();
  const { role } = useIdentityStore();
  const {
    projectMode,
    projectStep,
    deactivateProjectMode,
    activateProjectMode,
  } = useProjectStore();

  const hasSite = siteContext !== null;
  const buildActive = buildMode === "new";

  // Dismissed when user clicks × on the build insights overlay; auto-resets on new placements
  const [insightsDismissed, setInsightsDismissed] = useState(false);
  useEffect(() => {
    setInsightsDismissed(false);
  }, [buildStep]);

  const showBuildInsights =
    buildActive &&
    !projectMode &&
    buildStep === "result" &&
    hasSite &&
    !insightsDismissed;

  return (
    <IdentityGate>
      {role === "council" ? (
        <CouncilView />
      ) : (
        <div className="relative w-screen h-screen overflow-hidden">
          {/* Map fills the entire screen */}
          <MapCanvas />
          {!hasSite && <MapPrompt showHint />}
          <BuildingHoverCard />
          <MapLayerToggle />
          <MarketValueLegend />
          <IdentityBadge />

          {/* Build widget — top-left, shown when build mode is active and project mode is off */}
          {buildActive && !projectMode && (
            <FloatingWidget
              title="New Development"
              onClose={deactivateBuild}
              className="top-4 left-4 w-72 z-10"
            >
              <BuildPanel />
            </FloatingWidget>
          )}

          {/* Site Context widget — top-right, shown when a site is selected.
              When build insights are active it acts as a background "tab" peeking from above. */}
          {hasSite && (
            <FloatingWidget
              title="Site Context"
              onClose={clearSiteContext}
              className={`top-4 right-4 w-96 ${showBuildInsights ? "z-10" : "z-20"}`}
            >
              <SidePanel />
            </FloatingWidget>
          )}

          {/* Building insights overlay — slides in front of site context when build result is ready.
              Positioned 52px lower so the site context header/tab peeks from above. */}
          {showBuildInsights && (
            <FloatingWidget
              title="New Building Insights"
              onClose={() => setInsightsDismissed(true)}
              className="top-[52px] right-4 w-96 z-20"
            >
              <BuildInsightsPanel siteContext={siteContext!} />
            </FloatingWidget>
          )}

          {/* Plan Project toggle — bottom-left, above the identity badge */}
          <button
            onClick={() => {
              if (projectMode) {
                deactivateProjectMode();
              } else {
                deactivateBuild();
                activateProjectMode();
              }
            }}
            className={`absolute bottom-28 left-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium bg-gray-900/80 backdrop-blur transition-colors ${
              projectMode
                ? "border-indigo-500/60 text-indigo-400"
                : "border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600"
            }`}
          >
            <span>📋</span>
            <span>{projectMode ? "Exit Plan Project" : "Plan Project"}</span>
          </button>

          {/* Project panel FloatingWidget — bottom-left above button */}
          {projectMode && !buildActive && projectStep !== "idle" && (
            <FloatingWidget
              title="Plan Project"
              onClose={deactivateProjectMode}
              className="bottom-40 left-4 w-80 z-10"
            >
              <ProjectPanel />
            </FloatingWidget>
          )}
        </div>
      )}
    </IdentityGate>
  );
}

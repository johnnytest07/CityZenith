"use client";

import { MapCanvas } from "./MapCanvas";
import { MapPrompt } from "./MapPrompt";
import { BuildingHoverCard } from "./BuildingHoverCard";
import { SidePanel } from "@/components/panel/SidePanel";
import { BuildPanel } from "@/components/panel/BuildPanel";
import { useSiteStore } from "@/stores/siteStore";
import { useDevStore } from "@/stores/devStore";

/**
 * Top-level layout container:
 *   [BuildPanel — left, build mode only] [map — flex-1] [SidePanel — right, site selected]
 * The MapPrompt overlay is shown when no site is selected.
 */
export function MapShell() {
  const { siteContext } = useSiteStore();
  const { buildMode } = useDevStore();

  const hasSite = siteContext !== null;
  const buildActive = buildMode === "new";

  return (
    <div className="flex h-screen w-screen bg-gray-950 overflow-hidden">
      {/* Build panel — slides in from the left when build mode is active */}
      {buildActive && (
        <div className="w-72 flex-shrink-0 overflow-y-auto">
          <BuildPanel />
        </div>
      )}

      {/* Map area */}
      <div className="relative flex-1 min-w-0">
        <MapCanvas />
        <MapPrompt visible={!hasSite} />
        <BuildingHoverCard />
      </div>

      {/* Context panel — slides in from the right when a site is selected */}
      {hasSite && (
        <div className="w-96 flex-shrink-0 border-l border-gray-800 overflow-y-auto bg-gray-950">
          <SidePanel />
        </div>
      )}
    </div>
  );
}

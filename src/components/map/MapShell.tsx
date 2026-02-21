"use client";

import { MapCanvas } from "./MapCanvas";
import { MapPrompt } from "./MapPrompt";
import { BuildingHoverCard } from "./BuildingHoverCard";
import { MapLayerToggle } from "./MapLayerToggle";
import { SidePanel } from "@/components/panel/SidePanel";
import { BuildPanel } from "@/components/panel/BuildPanel";
import {
  IdentityGate,
  IdentityBadge,
} from "@/components/identity/IdentityGate";
import { useSiteStore } from "@/stores/siteStore";
import { useDevStore } from "@/stores/devStore";

/**
 * Top-level layout container:
 *   [BuildPanel — left, build mode only] [map — flex-1] [SidePanel — right, site selected]
 * Wrapped in IdentityGate so users identify their role before exploring.
 */
export function MapShell() {
  const { siteContext } = useSiteStore();
  const { buildMode } = useDevStore();

  const hasSite = siteContext !== null;
  const buildActive = buildMode === "new";

  return (
    <IdentityGate>
      <div className="flex h-screen w-screen bg-gray-950 overflow-hidden">
        {/* Build panel — slides in from the left when build mode is active */}
        {buildActive && (
          <div className="w-72 shrink-0 overflow-y-auto">
            <BuildPanel />
          </div>
        )}

        {/* Map area */}
        <div className="relative flex-1 min-w-0">
          <MapCanvas />
          {!hasSite && <MapPrompt showHint />}
          <BuildingHoverCard />
          <MapLayerToggle />
          <IdentityBadge />
        </div>

        {/* Side panel — slides in when a site is selected */}
        {hasSite && (
          <div className="w-96 shrink-0 border-l border-gray-800 overflow-y-auto bg-gray-950">
            <SidePanel />
          </div>
        )}
      </div>
    </IdentityGate>
  );
}

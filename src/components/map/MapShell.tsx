"use client";

import { MapCanvas } from "./MapCanvas";
import { MapPrompt } from "./MapPrompt";
import { BuildingHoverCard } from "./BuildingHoverCard";
import { MapLayerToggle } from "./MapLayerToggle";
import { FloatingWidget } from "./FloatingWidget";
import { SidePanel } from "@/components/panel/SidePanel";
import { BuildPanel } from "@/components/panel/BuildPanel";
import {
  IdentityGate,
  IdentityBadge,
} from "@/components/identity/IdentityGate";
import { CouncilView } from "@/components/council/CouncilView";
import { useSiteStore } from "@/stores/siteStore";
import { useDevStore } from "@/stores/devStore";
import { useIdentityStore } from "@/stores/identityStore";

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
  const { buildMode, deactivateBuild } = useDevStore();
  const { role } = useIdentityStore();

  const hasSite = siteContext !== null;
  const buildActive = buildMode === "new";

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
          <IdentityBadge />

          {/* Build widget — top-left, shown when build mode is active */}
          {buildActive && (
            <FloatingWidget
              title="New Development"
              onClose={deactivateBuild}
              className="top-4 left-4 w-72 z-10"
            >
              <BuildPanel />
            </FloatingWidget>
          )}

          {/* Site Context widget — top-right, shown when a site is selected */}
          {hasSite && (
            <FloatingWidget
              title="Site Context"
              onClose={clearSiteContext}
              className="top-4 right-4 w-96 z-10"
            >
              <SidePanel />
            </FloatingWidget>
          )}
        </div>
      )}
    </IdentityGate>
  );
}

"use client";

import { useState } from "react";
import { useSiteStore } from "@/stores/siteStore";
import { AMENITY_GROUPS } from "@/types/amenities";
import type { NearbyAmenity } from "@/types/amenities";
import { SectionCard } from "./SectionCard";
import { InsightCallout } from "./InsightCallout";

function fmtDist(m: number): string {
  if (m < 100) return `<100m`;
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function walkTime(m: number): string {
  const mins = Math.ceil(m / 80); // ~80m/min walking pace
  return `${mins} min walk`;
}

/**
 * Connectivity panel — shows nearest amenities per category from Overpass/OSM.
 * Clicking a row flies the map to that location and shows a dot + line.
 */
export function AmenitiesPanel() {
  const {
    siteContext,
    loadingStates,
    insightBullets,
    insightLoading,
    selectedAmenity,
    setSelectedAmenity,
  } = useSiteStore();

  const connectivityBullets =
    insightBullets?.filter((b) => b.category === "connectivity").map((b) => b.text) ?? [];
  const [expanded, setExpanded] = useState(false);

  const amenities: NearbyAmenity[] = siteContext?.nearbyAmenities ?? [];
  const isLoading = loadingStates.amenities;

  // Build summary: nearest transport + nearest supermarket
  const nearestTransport = amenities.find((a) =>
    ["bus_stop", "train_station", "subway_station"].includes(a.category),
  );
  const nearestShop = amenities.find((a) =>
    ["supermarket", "convenience"].includes(a.category),
  );

  const summaryParts: string[] = [];
  if (nearestTransport)
    summaryParts.push(
      `${nearestTransport.name} (${fmtDist(nearestTransport.distanceM)})`,
    );
  if (nearestShop)
    summaryParts.push(
      `${nearestShop.name} (${fmtDist(nearestShop.distanceM)})`,
    );

  const summary = isLoading ? (
    <span className="text-xs text-gray-700 animate-pulse">Fetching…</span>
  ) : amenities.length === 0 ? (
    <span className="text-xs text-gray-600">No data</span>
  ) : (
    <p className="text-xs text-gray-500 truncate">
      {summaryParts.join(" · ") || `${amenities.length} places nearby`}
    </p>
  );

  const handleRowClick = (amenity: NearbyAmenity) => {
    setSelectedAmenity(
      selectedAmenity?.name === amenity.name &&
        selectedAmenity?.category === amenity.category
        ? null
        : amenity,
    );
  };

  return (
    <SectionCard
      title="Connectivity"
      scope="1km radius"
      summary={summary}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      {isLoading ? (
        <div className="mt-3 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between animate-pulse"
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-800 rounded" />
                <div className="h-3 bg-gray-800 rounded w-28" />
              </div>
              <div className="h-3 bg-gray-800 rounded w-12" />
            </div>
          ))}
        </div>
      ) : amenities.length === 0 ? (
        <p className="text-gray-600 text-xs mt-2">
          No amenity data found for this location.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {AMENITY_GROUPS.map((group) => {
            const matches = amenities
              .filter((a) => group.categories.includes(a.category))
              .slice(0, 3);
            if (matches.length === 0) return null;

            return (
              <div key={group.label}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm leading-none">{group.emoji}</span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                <div className="space-y-0.5 pl-5">
                  {matches.map((a, i) => {
                    const isSelected =
                      selectedAmenity?.name === a.name &&
                      selectedAmenity?.category === a.category;
                    return (
                      <button
                        key={i}
                        onClick={() => handleRowClick(a)}
                        className={`w-full flex items-center justify-between gap-2 rounded px-1.5 py-1 cursor-pointer text-left transition-colors ${
                          isSelected
                            ? "bg-violet-950/30 ring-1 ring-inset ring-violet-600/40"
                            : "hover:bg-gray-900/60"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-gray-300 truncate">
                            {a.name}
                          </span>
                          {a.subtype && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-400 shrink-0 leading-none">
                              {a.subtype}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-gray-200 tabular-nums">
                            {fmtDist(a.distanceM)}
                          </span>
                          <span className="text-[10px] text-gray-600 tabular-nums whitespace-nowrap">
                            {walkTime(a.distanceM)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {selectedAmenity && (
            <p className="text-[10px] text-gray-600 pt-1">
              Click again to deselect · Map shows route to{" "}
              {selectedAmenity.name}
            </p>
          )}

          <InsightCallout
            texts={connectivityBullets}
            isLoading={insightLoading && connectivityBullets.length === 0}
          />
        </div>
      )}
    </SectionCard>
  );
}

"use client";

import { useState } from "react";
import { useSiteStore } from "@/stores/siteStore";
import { AMENITY_GROUPS } from "@/types/amenities";
import type { NearbyAmenity } from "@/types/amenities";
import { SectionCard } from "./SectionCard";
import { InsightCallout } from "./InsightCallout";

const OSRM_BASE = "https://router.project-osrm.org/route/v1/foot"

async function fetchOsrmRoute(
  from: [number, number],
  to: [number, number],
): Promise<{ coords: [number, number][]; distanceM: number } | null> {
  try {
    const url = `${OSRM_BASE}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route) return null
    return {
      coords: route.geometry.coordinates as [number, number][],
      distanceM: route.distance as number,
    }
  } catch {
    return null
  }
}

function geomCentre(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === "Polygon" && geom.coordinates[0].length > 0) {
    const ring = geom.coordinates[0] as [number, number][]
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length
    return [lng, lat]
  }
  if (geom.type === "Point") return geom.coordinates as [number, number]
  return null
}

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
    amenityRoute,
    amenityRouteDistanceM,
    setAmenityRoute,
  } = useSiteStore();
  const [routeLoading, setRouteLoading] = useState(false);

  const connectivityBullets =
    insightBullets?.filter((b) => b.category === "connectivity").map((b) => b.text) ?? [];
  const [expanded, setExpanded] = useState(false);

  const amenities: NearbyAmenity[] = siteContext?.nearbyAmenities ?? [];
  const isLoading = loadingStates.amenities;

  // Compute which groups are present vs missing
  const presentGroups = AMENITY_GROUPS.filter((g) =>
    amenities.some((a) => g.categories.includes(a.category)),
  );
  const missingGroups = AMENITY_GROUPS.filter(
    (g) => !amenities.some((a) => g.categories.includes(a.category)),
  );

  const summary = isLoading ? (
    <span className="text-xs text-gray-700 animate-pulse">Fetching…</span>
  ) : amenities.length === 0 ? (
    <span className="text-xs text-gray-600">No data</span>
  ) : (
    <div className="space-y-1 mt-0.5">
      {presentGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-[10px] text-gray-500 shrink-0">Has:</span>
          {presentGroups.map((g) => (
            <span
              key={g.label}
              className="text-[10px] text-gray-400 flex items-center gap-0.5"
            >
              <span>{g.emoji}</span>
              <span>{g.label}</span>
            </span>
          ))}
        </div>
      )}
      {missingGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-[10px] text-gray-600 shrink-0">No:</span>
          {missingGroups.map((g) => (
            <span key={g.label} className="text-[10px] text-gray-700">
              {g.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const handleRowClick = async (amenity: NearbyAmenity) => {
    const isSame =
      selectedAmenity?.name === amenity.name &&
      selectedAmenity?.category === amenity.category
    if (isSame) {
      setSelectedAmenity(null)
      setAmenityRoute(null, null)
      return
    }
    setSelectedAmenity(amenity)
    setAmenityRoute(null, null)

    const centre = siteContext ? geomCentre(siteContext.siteGeometry) : null
    if (centre) {
      setRouteLoading(true)
      const result = await fetchOsrmRoute(centre, [amenity.lng, amenity.lat])
      setRouteLoading(false)
      if (result) setAmenityRoute(result.coords, result.distanceM)
    }
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
                            {isSelected && amenityRouteDistanceM
                              ? fmtDist(Math.round(amenityRouteDistanceM))
                              : fmtDist(a.distanceM)}
                          </span>
                          <span className="text-[10px] text-gray-500 tabular-nums whitespace-nowrap flex items-center gap-1">
                            {isSelected && routeLoading ? (
                              <>
                                <span className="w-2 h-2 border border-violet-500 border-t-violet-200 rounded-full animate-spin shrink-0" />
                                <span className="text-gray-600">routing…</span>
                              </>
                            ) : isSelected && amenityRouteDistanceM ? (
                              <span className="text-violet-400">{walkTime(amenityRouteDistanceM)} by road</span>
                            ) : (
                              walkTime(a.distanceM)
                            )}
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
              Click again to deselect ·{" "}
              {amenityRoute ? "Walking route to" : "Locating"}{" "}
              <span className="text-gray-400">{selectedAmenity.name}</span>
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

"use client";

import { useRef, useCallback, useMemo, useEffect } from "react";
import Map, {
  Popup,
  type MapRef,
  type ViewStateChangeEvent,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PolygonLayer, GeoJsonLayer, ScatterplotLayer, PathLayer } from "@deck.gl/layers";
import { DeckOverlay } from "./DeckOverlay";
import { useSiteStore } from "@/stores/siteStore";
import { useMapStore } from "@/stores/mapStore";
import { useDevStore } from "@/stores/devStore";
import { useIdentityStore } from "@/stores/identityStore";
import { useCouncilStore } from "@/stores/councilStore";
import { useSiteSelection } from "@/hooks/useSiteSelection";
import { createPlanningPrecedentLayer } from "./layers/PlanningPrecedentLayer";
import { buildConstraintLayers } from "./layers/ConstraintIntersectionLayer";
import { createSiteHighlightLayer } from "./layers/SiteHighlightLayer";
import { createProposedBuildingLayer } from "./layers/ProposedBuildingLayer";
import { createDrawingLayers } from "./layers/DrawingLayer";
import { createMarketValueLayer } from "./layers/MarketValueLayer";
import { createCouncilSuggestionLayers } from "./layers/CouncilSuggestionLayer";
import { useMarketValue } from "@/hooks/useMarketValue";
import {
  polygonIntersectsBuilding,
  calculatePolygonArea,
  calculatePolygonCentroid,
  hasRoadAccess,
} from "@/lib/buildValidation";
import type { Layer, PickingInfo } from "@deck.gl/core";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

/**
 * Returns the [lng, lat] centre of a planning precedent feature.
 * Buffered-centroid features carry lat/lng in properties; real polygon
 * features use the geometric centroid of the outer ring.
 */
function getPrecedentCenter(feature: GeoJSON.Feature): [number, number] | null {
  const p = feature.properties ?? {};
  if (p.geometrySource === "buffered-centroid") {
    const lng =
      typeof p.longitude === "number"
        ? p.longitude
        : parseFloat(String(p.longitude ?? ""));
    const lat =
      typeof p.latitude === "number"
        ? p.latitude
        : parseFloat(String(p.latitude ?? ""));
    if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
  }
  if (feature.geometry?.type === "Polygon") {
    const coords = feature.geometry.coordinates[0] as [number, number][];
    if (coords.length > 0) {
      const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      return [lng, lat];
    }
  }
  return null;
}

/** Extract the [lng, lat] centroid of a GeoJSON Geometry. */
function getSiteGeometryCentre(geometry: GeoJSON.Geometry): [number, number] | null {
  if (geometry.type === "Polygon" && geometry.coordinates[0].length > 0) {
    const ring = geometry.coordinates[0] as [number, number][];
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    return [lng, lat];
  }
  if (geometry.type === "MultiPolygon" && geometry.coordinates[0]?.[0]?.length > 0) {
    const ring = geometry.coordinates[0][0] as [number, number][];
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    return [lng, lat];
  }
  return null;
}

const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// ONS Open Geography Portal — UK Local Authority Districts (ultra-generalised, ~400KB)
// Free, no auth, CORS-enabled
const COUNCIL_BOUNDARIES_URL =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
  "Local_Authority_Districts_May_2024_Boundaries_UK_BUC/FeatureServer/0/query" +
  "?where=1%3D1&outFields=LAD24NM,LAD24CD&returnGeometry=true&outSR=4326&f=geojson";

// ONS uses short-form names for some councils. This lookup maps LAD24CD codes
// to their formal titles so the map label shows the correct full name.
const FORMAL_COUNCIL_NAMES: Record<string, string> = {
  E09000011: "Royal Borough of Greenwich",
  E09000020: "Royal Borough of Kensington and Chelsea",
  E09000021: "Royal Borough of Kingston upon Thames",
  E06000040: "Royal Borough of Windsor and Maidenhead",
};

/**
 * Apply council-mode paint to the boundary layers.
 * When role is 'council' and onsCode is known, all regions except the user's
 * own are greyed out. Otherwise the default indigo wash is shown.
 */
function applyCouncilBoundaryStyle(
  map: MapLibreMap,
  isCouncilMode: boolean,
  onsCode?: string,
) {
  if (!map.getLayer("council-boundaries-fill")) return;

  if (isCouncilMode && onsCode) {
    // Own council: keep the subtle indigo wash. Others: heavy grey overlay.
    map.setPaintProperty("council-boundaries-fill", "fill-color", [
      "case",
      ["==", ["get", "LAD24CD"], onsCode],
      "#6366f1",
      "#374151",
    ]);
    map.setPaintProperty("council-boundaries-fill", "fill-opacity", [
      "case",
      ["==", ["get", "LAD24CD"], onsCode],
      0.06,
      0.45,
    ]);
    map.setPaintProperty("council-boundaries-line", "line-color", [
      "case",
      ["==", ["get", "LAD24CD"], onsCode],
      "#818cf8",
      "#1f2937",
    ]);
    map.setPaintProperty("council-boundaries-line", "line-opacity", [
      "case",
      ["==", ["get", "LAD24CD"], onsCode],
      0.8,
      0.6,
    ]);
    // Dim labels for other councils
    map.setPaintProperty("council-names", "text-color", [
      "case",
      ["==", ["get", "LAD24CD"], onsCode],
      "#3730a3",
      "#374151",
    ]);
    map.setPaintProperty("council-names", "text-opacity", [
      "case",
      ["==", ["get", "LAD24CD"], onsCode],
      1.0,
      0.3,
    ]);
  } else {
    // Default: uniform indigo wash for all councils
    map.setPaintProperty("council-boundaries-fill", "fill-color", "#6366f1");
    map.setPaintProperty("council-boundaries-fill", "fill-opacity", 0.04);
    map.setPaintProperty("council-boundaries-line", "line-color", "#6366f1");
    map.setPaintProperty("council-boundaries-line", "line-opacity", 0.6);
    map.setPaintProperty("council-names", "text-color", "#3730a3");
    map.setPaintProperty("council-names", "text-opacity", 1.0);
  }
}

async function addCouncilBoundaries(
  map: MapLibreMap,
  isCouncilMode: boolean,
  onsCode?: string,
) {
  if (map.getSource("council-boundaries")) return;

  try {
    const res = await fetch(COUNCIL_BOUNDARIES_URL);
    if (!res.ok) throw new Error(`ONS fetch failed: ${res.status}`);
    const geojson = await res.json();

    if (map.getSource("council-boundaries")) return; // guard against double-add on fast loads

    // Patch a displayName field using formal titles where ONS uses short forms
    if (Array.isArray(geojson.features)) {
      for (const f of geojson.features) {
        const code: string = f.properties?.LAD24CD ?? "";
        f.properties.displayName =
          FORMAL_COUNCIL_NAMES[code] ?? f.properties.LAD24NM;
      }
    }

    map.addSource("council-boundaries", {
      type: "geojson",
      data: geojson,
    });

    // Subtle fill — just enough to give each borough a tinted wash
    map.addLayer({
      id: "council-boundaries-fill",
      type: "fill",
      source: "council-boundaries",
      paint: {
        "fill-color": "#6366f1", // indigo
        "fill-opacity": 0.04,
      },
    });

    // Bold boundary outline
    map.addLayer({
      id: "council-boundaries-line",
      type: "line",
      source: "council-boundaries",
      paint: {
        "line-color": "#6366f1",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          0.8,
          12,
          1.5,
          16,
          2.5,
        ],
        "line-opacity": 0.6,
      },
    });

    // Council name labels — centred on each LAD polygon
    map.addLayer({
      id: "council-names",
      type: "symbol",
      source: "council-boundaries",
      minzoom: 7,
      layout: {
        "text-field": ["get", "displayName"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          9,
          10,
          12,
          13,
          14,
        ],
        "text-anchor": "center",
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#3730a3",
        "text-halo-color": "rgba(255,255,255,0.85)",
        "text-halo-width": 1.5,
      },
    });

    // Apply council-mode styling immediately after layers are added
    applyCouncilBoundaryStyle(map, isCouncilMode, onsCode);
  } catch (err) {
    console.warn("Could not load council boundaries:", err);
  }
}

export function MapCanvas() {
  const mapRef = useRef<MapRef>(null);
  const { viewState, setViewState, setBounds, marketValueEnabled, bounds } = useMapStore();
  const {
    siteContext,
    insight,
    insightLoading,
    hoveredPrecedentId,
    selectedPrecedentId,
    setSelectedPrecedentId,
    selectedAmenity,
  } = useSiteStore();
  const {
    buildMode,
    buildStep,
    buildRecommendation,
    polygonNodes,
    cursorPosition,
    buildPolygon,
    pendingComplete,
    setBuildStep,
    addPolygonNode,
    completePolygon,
    setCursorPosition,
    resetToPlace,
    clearPendingComplete,
    setRecommendation,
    setBuildError,
    setRoadWarning,
    setHoverInfo,
  } = useDevStore();

  const mapLibreRef = useRef<MapLibreMap | null>(null);

  const { hexData: marketHexData } = useMarketValue(marketValueEnabled, bounds);

  const { selectSite } = useSiteSelection(mapLibreRef);
  const { role, council } = useIdentityStore();
  const {
    suggestions: councilSuggestions,
    selectedSuggestionId,
    hoveredSuggestionId,
    setSelectedSuggestion,
    setHoveredSuggestion,
  } = useCouncilStore();

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    mapLibreRef.current = map as unknown as MapLibreMap;

    // --- 3D buildings ---
    if (!map.getLayer("3d-buildings")) {
      const style = map.getStyle();
      const styleLayers = style.layers;

      // streets-v2: a layer already renders building footprints — reuse its source.
      // hybrid/satellite: no building layer exists in the style (satellite imagery
      // already shows rooftops, so MapTiler omits the 2D fill), but the vector
      // overlay source still contains building footprint data. Fall back to the
      // first vector source found in the style.
      const existingBuildingLayer = styleLayers.find(
        (l) => "source-layer" in l && (l as { "source-layer": string })["source-layer"] === "building",
      ) as { source: string } | undefined;

      let buildingSource: string | undefined = existingBuildingLayer?.source;

      if (!buildingSource) {
        const sources = style.sources as Record<string, { type: string }>;
        for (const [id, src] of Object.entries(sources)) {
          if (src.type === "vector") {
            buildingSource = id;
            break;
          }
        }
      }

      if (buildingSource) {
        const firstSymbolLayerId = styleLayers.find(
          (l) => l.type === "symbol",
        )?.id;

        try {
          map.addLayer(
            {
              id: "3d-buildings",
              source: buildingSource,
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 13,
              paint: {
                "fill-extrusion-color": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  13,
                  "#8a8a8f",
                  16,
                  "#78787d",
                ],
                "fill-extrusion-height": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  13,
                  0,
                  14,
                  ["coalesce", ["get", "render_height"], ["get", "height"], 4],
                ],
                "fill-extrusion-base": [
                  "coalesce",
                  ["get", "render_min_height"],
                  ["get", "min_height"],
                  0,
                ],
                "fill-extrusion-opacity": 0.85,
              },
            },
            firstSymbolLayerId,
          );
        } catch (err) {
          console.warn("Could not add 3D buildings layer:", err);
        }
      }
    }

    // --- Council boundaries (async, non-blocking) ---
    const isCouncilMode = useIdentityStore.getState().role === "council";
    const onsCode = useIdentityStore.getState().council?.onsCode;
    addCouncilBoundaries(map as unknown as MapLibreMap, isCouncilMode, onsCode);
  }, []);

  // Re-apply boundary styles whenever the user's identity changes
  useEffect(() => {
    const map = mapLibreRef.current;
    if (!map) return;
    const isCouncilMode = role === "council";
    const onsCode = council?.onsCode;
    // Layers may still be loading from the async fetch; retry after a short delay
    applyCouncilBoundaryStyle(map, isCouncilMode, onsCode);
    const timer = setTimeout(
      () => applyCouncilBoundaryStyle(map, isCouncilMode, onsCode),
      1500,
    );
    return () => clearTimeout(timer);
  }, [role, council]);

  // Fly to selected amenity location when the user clicks a connectivity row
  useEffect(() => {
    if (!selectedAmenity) return;
    const map = mapLibreRef.current;
    if (!map) return;
    map.flyTo({
      center: [selectedAmenity.lng, selectedAmenity.lat],
      zoom: 16,
      duration: 900,
    });
  }, [selectedAmenity]);

  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewState(evt.viewState);
      const map = mapRef.current?.getMap();
      if (map) {
        const b = map.getBounds();
        setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }
    },
    [setViewState, setBounds],
  );

  // Mouse move — track cursor position for the ghost preview line during drawing
  const handleMouseMove = useCallback(
    (evt: MapLayerMouseEvent) => {
      const { buildMode: mode, buildStep: step } = useDevStore.getState();
      if (mode === "new" && step === "place") {
        const { lngLat } = evt;
        setCursorPosition([lngLat.lng, lngLat.lat]);
      }
    },
    [setCursorPosition],
  );

  // Finish the polygon: validate, compute area, call the recommend API
  const finishPolygon = useCallback(
    async (nodes: [number, number][]) => {
      if (nodes.length < 3 || !siteContext) return;

      const closedRing = [...nodes, nodes[0]];

      // Block if polygon overlaps any existing building
      if (
        polygonIntersectsBuilding(
          closedRing,
          siteContext.nearbyContextFeatures.buildings,
        )
      ) {
        setBuildError(
          "Polygon overlaps an existing building — adjust your shape",
        );
        return;
      }

      const areaM2 = calculatePolygonArea(nodes);
      const centroidCoords = calculatePolygonCentroid(nodes);

      // Road access check at centroid (non-blocking — warns but does not prevent)
      const map = mapLibreRef.current;
      if (map) {
        setRoadWarning(!hasRoadAccess(map, centroidCoords));
      }

      completePolygon(closedRing, areaM2);
      setBuildStep("loading");
      setBuildError(null);

      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteContext,
            polygon: closedRing,
            footprintM2: areaM2,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setBuildError(data.error ?? "Recommendation failed");
          resetToPlace();
          return;
        }
        setRecommendation(data);
        setBuildStep("result");
      } catch (err) {
        setBuildError(err instanceof Error ? err.message : "Request failed");
        resetToPlace();
      }
    },
    [
      siteContext,
      completePolygon,
      setBuildStep,
      setBuildError,
      setRoadWarning,
      setRecommendation,
      resetToPlace,
    ],
  );

  // Trigger finishPolygon when DevModePanel "Complete shape" button sets pendingComplete
  useEffect(() => {
    if (!pendingComplete) return;
    clearPendingComplete();
    const nodes = useDevStore.getState().polygonNodes;
    if (nodes.length >= 3) {
      void finishPolygon(nodes);
    }
  }, [pendingComplete, clearPendingComplete, finishPolygon]);

  const handleClick = useCallback(
    async (evt: MapLayerMouseEvent) => {
      const { lngLat } = evt;
      const clickPoint: [number, number] = [lngLat.lng, lngLat.lat];

      // Council mode — deselect any active suggestion when clicking empty map space.
      // Suggestion polygon clicks are handled by the deck.gl layer onClick (which returns true
      // to stop propagation, so this handler won't fire for those clicks).
      if (useIdentityStore.getState().role === "council") {
        useCouncilStore.getState().setSelectedSuggestion(null)
        return
      }

      // Read live state from store to avoid stale closure
      const {
        buildMode: mode,
        buildStep: step,
        polygonNodes: nodes,
      } = useDevStore.getState();

      if (mode === "new" && step === "place") {
        // When ≥3 nodes, check if clicking near the first node to close the polygon
        if (nodes.length >= 3) {
          const map = mapLibreRef.current;
          if (map) {
            const firstNodeScreen = map.project(nodes[0]);
            const clickScreen = map.project(clickPoint);
            const dx = firstNodeScreen.x - clickScreen.x;
            const dy = firstNodeScreen.y - clickScreen.y;
            if (Math.sqrt(dx * dx + dy * dy) < 20) {
              await finishPolygon(nodes);
              return;
            }
          }
        }

        addPolygonNode(clickPoint);
        return; // Do NOT call selectSite
      }

      selectSite(clickPoint);
    },
    [selectSite, addPolygonNode, finishPolygon],
  );

  const getTooltip = useCallback(
    (info: PickingInfo) => {
      if (!info.object) return null;
      const layerId = info.layer?.id ?? "";

      // Proposed building — hover card handles display; suppress deck.gl tooltip
      if (layerId === "proposed-building") return null;

      // ── Council suggestion area ──────────────────────────────────
      if (layerId === "council-suggestions-area") {
        const props = (info.object as GeoJSON.Feature).properties ?? {};
        const rationale: string = props.rationale ?? "";
        const title: string = props.title ?? "";
        if (!rationale && !title) return null;
        return {
          html: `
          <div style="font-family:system-ui;font-size:11px;color:#e4e4e7;line-height:1.5">
            <div style="font-weight:700;color:#a78bfa;margin-bottom:4px">${title}</div>
            <div>${rationale}</div>
          </div>`,
          style: {
            background: "rgba(15,15,25,0.92)",
            borderRadius: "8px",
            padding: "10px 12px",
            border: "1px solid rgba(139,92,246,0.3)",
            maxWidth: "260px",
            pointerEvents: "none",
          },
        };
      }

      // ── Market value hex ────────────────────────────────────────
      if (layerId === "market-value-hex") {
        const props = (info.object as GeoJSON.Feature).properties;
        if (!props?.relativeScore) return null;
        const { medianPrice, relativeScore, txCount, growth1yr, growth3yr } = props as {
          medianPrice: number;
          relativeScore: number;
          txCount: number;
          growth1yr: number | null;
          growth3yr: number | null;
        };
        const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
        const fmt = (v: number) =>
          `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
        return {
          html: `<div style="background:rgba(17,24,39,0.92);border:1px solid rgba(75,85,99,0.6);border-radius:8px;padding:10px 12px;font-family:system-ui;font-size:12px;line-height:1.6;color:#e5e7eb;min-width:180px">
            <div style="font-weight:700;margin-bottom:4px">Market Value</div>
            <div>Median Price (250m): <b>${fmt(medianPrice)}</b></div>
            <div>vs Borough Median: <b style="color:${relativeScore < 0 ? "#60a5fa" : "#fb923c"}">${pct(relativeScore)}</b></div>
            ${growth1yr != null ? `<div>1yr Growth: <b>${pct(growth1yr)}</b></div>` : ""}
            ${growth3yr != null ? `<div>3yr Growth: <b>${pct(growth3yr)}</b></div>` : ""}
            <div style="color:#6b7280;margin-top:4px">${txCount} transactions</div>
          </div>`,
          style: { background: "none", border: "none", padding: "0" } as Record<string, string>,
        };
      }

      // ── Planning precedent ──────────────────────────────────────
      // Layer IDs are planning-precedent-{slot} where slot ∈ undetermined|approved|refused
      if (layerId.startsWith("planning-precedent-")) {
        const p = (info.object as GeoJSON.Feature).properties ?? {};
        const decision: string = p.normalised_decision ?? "Unknown";
        const decisionColor = decision.toLowerCase().includes("approv")
          ? "#4ade80"
          : decision.toLowerCase().includes("refus")
            ? "#f87171"
            : "#9ca3af";
        const proposal: string = (p.proposal ?? "").slice(0, 120);
        const date: string = p.decided_date ?? "";

        // ── Z-debug ──────────────────────────────────────────────
        // Each slot has a fixed base polygonOffset + per-feature step.
        // Draw order: undetermined (1st) → approved (2nd) → refused (3rd/top).
        // Higher units offset = drawn later = visually on top when depthTest:false.
        const slot = layerId.replace("planning-precedent-", "");
        const SLOT_BASE_OFFSETS: Record<string, [number, number]> = {
          undetermined: [0, 0],
          approved: [-2, -500],
          refused: [-4, -1000],
        };
        const SLOT_DRAW_ORDER: Record<string, string> = {
          undetermined: "1st — bottommost",
          approved: "2nd",
          refused: "3rd — topmost (drawn last)",
        };
        const [bFactor, bUnits] = SLOT_BASE_OFFSETS[slot] ?? [0, 0];
        const drawOrder = SLOT_DRAW_ORDER[slot] ?? "unknown";
        const geomSource = p.geometrySource ?? "unknown";

        return {
          html: `
          <div style="font-family:system-ui;font-size:11px;color:#e4e4e7;line-height:1.5">
            <div style="font-weight:700;color:${decisionColor};margin-bottom:4px">${decision}</div>
            <div style="color:#a1a1aa;margin-bottom:2px">${p.planning_reference ?? ""}</div>
            <div style="margin-bottom:4px">${proposal}${(p.proposal ?? "").length > 120 ? "…" : ""}</div>
            ${date ? `<div style="color:#71717a;margin-bottom:6px">${String(date).slice(0, 10)}</div>` : ""}
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(99,102,241,0.25)">
              <div style="color:#6366f1;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">⬛ z-index debug</div>
              <div style="color:#818cf8;margin-bottom:2px">layer: <span style="color:#a5b4fc">${layerId}</span></div>
              <div style="color:#818cf8;margin-bottom:2px">draw order: <span style="color:#a5b4fc">${drawOrder}</span></div>
              <div style="color:#818cf8;margin-bottom:2px">polygonOffset: <span style="color:#a5b4fc">factor ${bFactor}, units ${bUnits}</span></div>
              <div style="color:#818cf8">geometry: <span style="color:#a5b4fc">${geomSource}</span></div>
            </div>
          </div>`,
          style: {
            background: "rgba(9,9,19,0.96)",
            borderRadius: "8px",
            padding: "10px 12px",
            border: "1px solid rgba(99,102,241,0.35)",
            maxWidth: "310px",
            pointerEvents: "none",
          },
        };
      }

      // ── Site highlight ──────────────────────────────────────────
      if (layerId === "site-highlight") {
        const content = insightLoading
          ? '<span style="color:#a78bfa">Analysing site…</span>'
          : insight
            ? (insight
                .split("\n")
                .find((l: string) => l.trim().startsWith("•"))
                ?.slice(2) ?? insight.split("\n")[0])
            : '<span style="color:#71717a">AI insights loading…</span>';
        return {
          html: `
          <div style="font-family:system-ui;font-size:11px;color:#e4e4e7;line-height:1.5">
            <div style="font-weight:700;color:#a78bfa;margin-bottom:6px">✦ Site Insight</div>
            <div>${content}</div>
          </div>`,
          style: {
            background: "rgba(15,15,25,0.92)",
            borderRadius: "8px",
            padding: "10px 12px",
            border: "1px solid rgba(139,92,246,0.3)",
            maxWidth: "280px",
            pointerEvents: "none",
          },
        };
      }

      return null;
    },
    [insight, insightLoading],
  );

  const deckLayers = useMemo((): Layer[] => {
    const layers: Layer[] = [];

    // --- Council mode: render suggestion layers, skip all developer layers ---
    if (role === "council") {
      if (councilSuggestions.length > 0) {
        layers.push(
          ...createCouncilSuggestionLayers(
            councilSuggestions,
            selectedSuggestionId,
            hoveredSuggestionId,
            (id) => setSelectedSuggestion(selectedSuggestionId === id ? null : id),
            (id) => setHoveredSuggestion(id),
          ),
        );
      }
      return layers;
    }

    // --- Market value hex grid (bottom — beneath all other layers) ---
    if (marketValueEnabled && marketHexData) {
      layers.push(createMarketValueLayer(marketHexData));
    }

    if (!siteContext) return layers;

    // --- Statutory constraints (bottom) ---
    layers.push(...buildConstraintLayers(siteContext.statutoryConstraints));

    // --- Site highlight and planning precedent circles ---
    layers.push(createSiteHighlightLayer(siteContext.siteGeometry));

    if (siteContext.planningPrecedentFeatures.features.length > 0) {
      layers.push(
        ...createPlanningPrecedentLayer(
          siteContext.planningPrecedentFeatures,
          (feature) => {
            const ref = feature.properties?.planning_reference as string | undefined;
            if (ref) setSelectedPrecedentId(ref);
          },
        ),
      );
    }

    // --- Hover highlight for precedent hovered in the side panel ---
    if (hoveredPrecedentId) {
      const hoveredFeature =
        siteContext.planningPrecedentFeatures.features.find(
          (f) => f.properties?.planning_reference === hoveredPrecedentId,
        );
      if (hoveredFeature) {
        layers.push(
          new GeoJsonLayer({
            id: "precedent-hover-highlight",
            data: {
              type: "FeatureCollection",
              features: [hoveredFeature],
            },
            stroked: true,
            filled: true,
            getFillColor: [255, 255, 255, 30],
            getLineColor: [255, 255, 255, 210],
            lineWidthMinPixels: 2.5,
            parameters: { depthTest: false, depthMask: false },
            pickable: false,
          }),
        );
      }
    }

    // --- Drawing layer (polygon being placed) ---
    if (
      buildMode === "new" &&
      buildStep === "place" &&
      polygonNodes.length > 0
    ) {
      layers.push(
        ...createDrawingLayers(
          polygonNodes,
          cursorPosition,
          polygonNodes.length >= 3,
        ),
      );
    }

    // --- Flat polygon preview while recommendation is loading ---
    if (buildMode === "new" && buildStep === "loading" && buildPolygon) {
      layers.push(
        new PolygonLayer({
          id: "proposed-building-loading",
          data: [{ contour: buildPolygon }],
          getPolygon: (d: { contour: [number, number][] }) => d.contour,
          getFillColor: [139, 92, 246, 60],
          getLineColor: [167, 139, 250, 180],
          lineWidthMinPixels: 1.5,
          extruded: false,
          pickable: false,
        }),
      );
    }

    // --- Proposed building (build new mode result) ---
    if (buildStep === "result" && buildPolygon && buildRecommendation) {
      const { primary, alternatives, activeIndex } = buildRecommendation;
      const activeOption =
        activeIndex === 0 ? primary : alternatives[activeIndex - 1];
      if (activeOption) {
        layers.push(
          createProposedBuildingLayer(
            buildPolygon,
            activeOption.approxHeightM,
            (info: PickingInfo) => {
              if (info.picked) {
                setHoverInfo({ x: info.x, y: info.y });
              } else {
                setHoverInfo(null);
              }
            },
          ),
        );
      }
    }

    // --- Amenity marker + path line ---
    if (selectedAmenity) {
      const siteCentre = getSiteGeometryCentre(siteContext.siteGeometry);
      if (siteCentre) {
        layers.push(
          new PathLayer({
            id: "amenity-path",
            data: [
              {
                path: [
                  siteCentre,
                  [selectedAmenity.lng, selectedAmenity.lat] as [number, number],
                ],
              },
            ],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: [139, 92, 246, 110],
            getWidth: 2,
            widthUnits: "pixels",
            pickable: false,
            parameters: { depthTest: false },
          }),
        );
      }
      layers.push(
        new ScatterplotLayer({
          id: "amenity-marker",
          data: [selectedAmenity],
          getPosition: (d: typeof selectedAmenity) => [d.lng, d.lat],
          getFillColor: [139, 92, 246, 230],
          getLineColor: [255, 255, 255, 200],
          getRadius: 8,
          radiusUnits: "pixels",
          stroked: true,
          lineWidthMinPixels: 2,
          pickable: false,
          parameters: { depthTest: false },
        }),
      );
    }

    return layers;
  }, [
    siteContext,
    selectSite,
    setSelectedPrecedentId,
    buildMode,
    buildStep,
    buildPolygon,
    buildRecommendation,
    polygonNodes,
    cursorPosition,
    setHoverInfo,
    hoveredPrecedentId,
    selectedAmenity,
    marketValueEnabled,
    marketHexData,
    role,
    councilSuggestions,
    selectedSuggestionId,
    hoveredSuggestionId,
    setSelectedSuggestion,
    setHoveredSuggestion,
  ]);

  // Popup shows for the panel-hovered precedent OR the map-clicked one.
  // Panel hover takes priority (it's more ephemeral).
  const popupPrecedentId = hoveredPrecedentId ?? selectedPrecedentId;
  const hoveredPrecedentFeature = popupPrecedentId
    ? (siteContext?.planningPrecedentFeatures.features.find(
        (f) => f.properties?.planning_reference === popupPrecedentId,
      ) ?? null)
    : null;
  const hoveredPrecedentCenter = hoveredPrecedentFeature
    ? getPrecedentCenter(hoveredPrecedentFeature)
    : null;

  const isBuildPlacing = buildMode === "new" && buildStep === "place";

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      className={isBuildPlacing ? "cursor-crosshair" : ""}
    >
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onLoad={handleMapLoad}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay layers={deckLayers} getTooltip={getTooltip} />

        {/* Precedent hover popup — shown when a panel list item is hovered */}
        {hoveredPrecedentCenter &&
          hoveredPrecedentFeature &&
          (() => {
            const p = hoveredPrecedentFeature.properties ?? {};
            const decision: string = p.normalised_decision ?? "";
            const decisionColor = decision.toLowerCase().includes("approv")
              ? "#4ade80"
              : decision.toLowerCase().includes("refus")
                ? "#f87171"
                : "#9ca3af";
            const proposal: string = (p.proposal ?? "").slice(0, 110);
            const date: string = p.decided_date
              ? new Date(p.decided_date).toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "";
            return (
              <Popup
                longitude={hoveredPrecedentCenter[0]}
                latitude={hoveredPrecedentCenter[1]}
                closeButton={false}
                closeOnClick={false}
                anchor="bottom"
                offset={12}
                className="precedent-popup"
              >
                <div>
                  {decision && (
                    <div
                      style={{
                        fontWeight: 700,
                        color: decisionColor,
                        marginBottom: 4,
                      }}
                    >
                      {decision}
                    </div>
                  )}
                  <div
                    style={{
                      color: "#a1a1aa",
                      fontFamily: "monospace",
                      marginBottom: 3,
                    }}
                  >
                    {p.planning_reference}
                  </div>
                  {proposal && (
                    <div style={{ color: "#d4d4d8", marginBottom: 3 }}>
                      {proposal}
                      {(p.proposal ?? "").length > 110 ? "…" : ""}
                    </div>
                  )}
                  <div style={{ color: "#71717a", display: "flex", gap: 8 }}>
                    {date && <span>{date}</span>}
                    {p.normalised_application_type && (
                      <span style={{ color: "#52525b" }}>
                        {p.normalised_application_type}
                      </span>
                    )}
                  </div>
                </div>
              </Popup>
            );
          })()}
      </Map>
    </div>
  );
}

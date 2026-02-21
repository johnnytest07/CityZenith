"use client";

import { useRef, useCallback, useMemo } from "react";
import Map, {
  type MapRef,
  type ViewStateChangeEvent,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DeckOverlay } from "./DeckOverlay";
import { useSiteStore } from "@/stores/siteStore";
import { useMapStore } from "@/stores/mapStore";
import { useDevStore } from "@/stores/devStore";
import { useSiteSelection } from "@/hooks/useSiteSelection";
import { createPlanningPrecedentLayer } from "./layers/PlanningPrecedentLayer";
import { buildConstraintLayers } from "./layers/ConstraintIntersectionLayer";
import { createSiteHighlightLayer } from "./layers/SiteHighlightLayer";
import { createProposedBuildingLayer } from "./layers/ProposedBuildingLayer";
import { isOnExistingBuilding, hasRoadAccess } from "@/lib/buildValidation";
import type { Layer, PickingInfo } from "@deck.gl/core";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

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

async function addCouncilBoundaries(map: MapLibreMap) {
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
  } catch (err) {
    console.warn("Could not load council boundaries:", err);
  }
}

export function MapCanvas() {
  const mapRef = useRef<MapRef>(null);
  const { viewState, setViewState, setBounds } = useMapStore();
  const { siteContext, insight, insightLoading } = useSiteStore();
  const {
    buildMode,
    buildStep,
    buildLocation,
    buildRecommendation,
    setBuildStep,
    setBuildLocation,
    setRecommendation,
    setBuildError,
    setRoadWarning,
    setHoverInfo,
  } = useDevStore();

  const mapLibreRef = useRef<MapLibreMap | null>(null);

  const { selectSite } = useSiteSelection(mapLibreRef);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    mapLibreRef.current = map as unknown as MapLibreMap;

    // --- 3D buildings ---
    if (!map.getLayer("3d-buildings")) {
      const styleLayers = map.getStyle().layers;

      const existingBuildingLayer = styleLayers.find(
        (l) => "source-layer" in l && l["source-layer"] === "building",
      ) as { source: string } | undefined;

      if (existingBuildingLayer) {
        const firstSymbolLayerId = styleLayers.find(
          (l) => l.type === "symbol",
        )?.id;

        try {
          map.addLayer(
            {
              id: "3d-buildings",
              source: existingBuildingLayer.source,
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
    addCouncilBoundaries(map as unknown as MapLibreMap);
  }, []);

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

  const handleClick = useCallback(
    async (evt: MapLayerMouseEvent) => {
      const { lngLat } = evt;
      const point: [number, number] = [lngLat.lng, lngLat.lat];

      // Build New mode intercepts clicks during the 'place' step
      if (buildMode === 'new' && buildStep === 'place') {
        const map = mapLibreRef.current;
        if (!map || !siteContext) return;

        // Block placement on existing buildings
        if (isOnExistingBuilding(point, siteContext.nearbyContextFeatures.buildings)) {
          setBuildError('Cannot build on an existing structure');
          return;
        }

        // Check road access (non-blocking — warns but does not prevent placement)
        const roadFound = hasRoadAccess(map, point);
        setRoadWarning(!roadFound);

        setBuildLocation(point);
        setBuildStep('loading');
        setBuildError(null);

        try {
          const res = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteContext, location: point }),
          });
          const data = await res.json();
          if (!res.ok) {
            setBuildError(data.error ?? 'Recommendation failed');
            setBuildStep('place');
            return;
          }
          setRecommendation(data);
          setBuildStep('result');
        } catch (err) {
          setBuildError(err instanceof Error ? err.message : 'Request failed');
          setBuildStep('place');
        }
        return; // Do NOT call selectSite
      }

      selectSite(point);
    },
    [
      buildMode,
      buildStep,
      siteContext,
      selectSite,
      setBuildError,
      setBuildLocation,
      setBuildStep,
      setRecommendation,
      setRoadWarning,
    ],
  );

  const getTooltip = useCallback((info: PickingInfo) => {
    if (!info.object) return null
    const layerId = info.layer?.id ?? ''

    // Proposed building — hover card handles display; suppress deck.gl tooltip
    if (layerId === 'proposed-building') return null

    // ── Planning precedent ──────────────────────────────────────
    if (layerId === 'planning-precedent') {
      const p = (info.object as GeoJSON.Feature).properties ?? {}
      const decision: string = p.normalised_decision ?? 'Unknown'
      const decisionColor = decision.toLowerCase().includes('approv')
        ? '#4ade80'
        : decision.toLowerCase().includes('refus') ? '#f87171' : '#9ca3af'
      const proposal: string = (p.proposal ?? '').slice(0, 120)
      const date: string = p.decision_date ?? p.received_date ?? ''
      return {
        html: `
          <div style="font-family:system-ui;font-size:11px;color:#e4e4e7;line-height:1.5">
            <div style="font-weight:700;color:${decisionColor};margin-bottom:4px">${decision}</div>
            <div style="color:#a1a1aa;margin-bottom:2px">${p.planning_reference ?? ''}</div>
            <div style="margin-bottom:2px">${proposal}${(p.proposal ?? '').length > 120 ? '…' : ''}</div>
            ${date ? `<div style="color:#71717a">${String(date).slice(0, 10)}</div>` : ''}
          </div>`,
        style: {
          background: 'rgba(15,15,25,0.92)',
          borderRadius: '8px',
          padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: '260px',
          pointerEvents: 'none',
        },
      }
    }

    // ── Site highlight ──────────────────────────────────────────
    if (layerId === 'site-highlight') {
      const content = insightLoading
        ? '<span style="color:#a78bfa">Analysing site…</span>'
        : insight
          ? insight.split('\n').find((l: string) => l.trim().startsWith('•'))?.slice(2) ?? insight.split('\n')[0]
          : '<span style="color:#71717a">AI insights loading…</span>'
      return {
        html: `
          <div style="font-family:system-ui;font-size:11px;color:#e4e4e7;line-height:1.5">
            <div style="font-weight:700;color:#a78bfa;margin-bottom:6px">✦ Site Insight</div>
            <div>${content}</div>
          </div>`,
        style: {
          background: 'rgba(15,15,25,0.92)',
          borderRadius: '8px',
          padding: '10px 12px',
          border: '1px solid rgba(139,92,246,0.3)',
          maxWidth: '280px',
          pointerEvents: 'none',
        },
      }
    }

    return null
  }, [insight, insightLoading])

  const deckLayers = useMemo((): Layer[] => {
    if (!siteContext) return [];

    const layers: Layer[] = [];

    // --- Statutory constraints (bottom) ---
    layers.push(...buildConstraintLayers(siteContext.statutoryConstraints));

    // --- Site highlight and planning precedent circles (top) ---
    layers.push(createSiteHighlightLayer(siteContext.siteGeometry));

    if (siteContext.planningPrecedentFeatures.features.length > 0) {
      layers.push(
        createPlanningPrecedentLayer(
          siteContext.planningPrecedentFeatures,
          (feature) => {
            const center =
              feature.geometry.type === "Polygon"
                ? (feature.geometry.coordinates[0][0] as [number, number])
                : ([
                    feature.properties?.longitude ?? 0,
                    feature.properties?.latitude ?? 0,
                  ] as [number, number]);
            selectSite(center);
          },
        ),
      );
    }

    // --- Proposed building (build new mode result) ---
    if (buildStep === 'result' && buildLocation && buildRecommendation) {
      const { primary, alternatives, activeIndex } = buildRecommendation;
      const activeOption = activeIndex === 0 ? primary : alternatives[activeIndex - 1];
      if (activeOption) {
        layers.push(
          createProposedBuildingLayer(
            buildLocation,
            activeOption,
            (info: PickingInfo) => {
              if (info.picked) {
                setHoverInfo({ x: info.x, y: info.y });
              } else {
                // Trigger a delayed hide via store (BuildingHoverCard handles the delay)
                // We signal no hover by scheduling hide — card onMouseLeave handles the timer
                setHoverInfo(null);
              }
            },
          ),
        );
      }
    }

    return layers;
  }, [siteContext, selectSite, buildStep, buildLocation, buildRecommendation, setHoverInfo]);

  const isBuildPlacing = buildMode === 'new' && buildStep === 'place';

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }} className={isBuildPlacing ? "cursor-crosshair" : ""}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleClick}
        onLoad={handleMapLoad}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay layers={deckLayers} getTooltip={getTooltip} />
      </Map>
    </div>
  );
}

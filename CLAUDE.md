# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

CityZenith is a parcel-level spatial evidence assembly tool — a 3D planning map. When a user selects a site, the system assembles a **SiteContext**: a container of raw spatial evidence tied to the selected parcel, including normalised planning precedent features, statutory constraints, nearby building/land use features, and planning statistics.

**Core rule:** SiteContext stores raw spatial data. Descriptive summaries (counts, heights, coverage) are computed at render-time only inside panel components.

**Architectural deviation — `developer_metrics`:** Planning precedent features carry a `developer_metrics` property (complexityScore, isHighValue, highValueTags, decisionSpeedDays) computed at normalisation time in `normalise.ts` and stored on the feature. This is an intentional exception to the raw-evidence-only rule, applied only to `planningPrecedentFeatures`.

This is a **site-first workflow**: the user selects a site and the system retrieves raw spatial evidence around that parcel.

---

## Commands

### Setup

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir
```

Install dependencies:
```bash
npm install maplibre-gl react-map-gl @deck.gl/core @deck.gl/layers @deck.gl/mapbox
npm install proj4 @types/proj4 @turf/turf
npm install zustand
npm install -D vitest @testing-library/react
```

### Development

```bash
npm run dev
```

### Tests

```bash
npx vitest                        # all tests
npx vitest src/lib/coords.test.ts # single test file
```

### Build / Lint

```bash
npm run build
npm run lint
```

### Environment

Create `.env.local` (see `.env.example`):
```
IBEX_API_KEY=
MAPTILER_KEY=
```

---

## Architecture

### Core Principle: Raw Evidence Only in SiteContext

`SiteContext` (defined in `src/types/siteContext.ts`) is the central domain object. It holds:

- `siteGeometry` — the selected parcel polygon (WGS84)
- `planningPrecedentFeatures` — normalised GeoJSON FeatureCollection from IBEX `/search` (all polygons, no point/polygon mix)
- `planningContextStats` — unmodified IBEX `/stats` response
- `statutoryConstraints` — results from constraint endpoints (Green Belt, Conservation Area, Article 4, Flood Risk)
- `nearbyContextFeatures` — raw buildings + landuse GeoJSON from MapLibre vector tiles (250m radius)

**No min/max/mean/median/counts/density are ever stored in state.** Panel components receive raw features and compute summaries at render-time.

### Data Flow

**Initial load:** Map at Thamesmead (51.5010, 0.1155), zoom 14, pitch 45°. MapPrompt visible. No data fetched.

**Site click → `useSiteSelection.ts` orchestrates:**
1. Determine site geometry (priority): planning precedent polygon → building footprint → 100m buffer fallback
2. Generate UUID as `siteId`, initialise `SiteContext`
3. Convert geometry to EPSG:27700 via `src/lib/coords.ts`
4. Four parallel data retrievals, each calling `siteStore.updateSiteContext()` progressively:
   - IBEX `/search` → `normaliseApplicationsToFeatures()` → `planningPrecedentFeatures`
   - IBEX `/stats` → `planningContextStats` (stored as-is)
   - Constraint endpoints × 4 → `statutoryConstraints`
   - `extractNearbyFeatures(map, center, 250)` → `nearbyContextFeatures`

**Clear:** `siteStore.clearSiteContext()` → all overlays removed, panel closes, prompt reappears.

### Key Libraries

| File | Purpose |
|---|---|
| `src/lib/coords.ts` | EPSG:27700 ↔ WGS84 transforms via proj4 |
| `src/lib/normalise.ts` | Converts planning applications → uniform polygon features (apps without geometry get 50m buffered centroid; `geometrySource` property distinguishes them) |
| `src/lib/builtForm.ts` | `extractNearbyFeatures()` — reads raw features from already-loaded MapLibre vector tiles via `queryRenderedFeatures()`. No computation. |
| `src/lib/geometry.ts` | Turf.js wrappers: `bufferClickPoint`, `bufferGeometry`, `bufferCentroid` |
| `src/lib/ibexClient.ts` | Typed API client for IBEX `/search` and `/stats` |
| `src/lib/constraintSources.ts` | Constraint endpoint URLs (planning.data.gov.uk, EA WFS) |
| `src/lib/colors.ts` | Decision colour mapping (Approved → green, Refused → red, Undetermined → grey) |

### Stores (Zustand)

- `src/stores/mapStore.ts` — `viewState`, `bounds`; no business logic
- `src/stores/siteStore.ts` — `siteContext`, `loadingStates` (per-source), `error`; **never stores computed values**

### API Proxies (server-side)

- `src/app/api/ibex/search/route.ts` — proxies IBEX `/search`, injects JWT
- `src/app/api/ibex/stats/route.ts` — proxies IBEX `/stats`, injects JWT
- `src/app/api/constraints/route.ts` — queries planning.data.gov.uk or EA WFS, returns intersecting GeoJSON

### Map Rendering

- `MapCanvas.tsx` — `react-map-gl/maplibre` `<Map>` with MapTiler OSM vector tiles; 3D buildings via MapLibre native `fill-extrusion` (grey, 70% opacity)
- `DeckOverlay.tsx` — deck.gl `MapboxOverlay` via `useControl()`, interleaved mode
- `PlanningPrecedentLayer.ts` — deck.gl `GeoJsonLayer`; all features are polygons (normalised); dashed outline for `geometrySource: 'buffered-centroid'`
- `ConstraintOverlayLayer.ts` — `GeoJsonLayer` per constraint type
- `SiteHighlightLayer.ts` — highlight outline for selected site geometry

### Panel Components

Panel components receive raw features from `SiteContext` and compute any summaries at render-time only — nothing computed is stored back into state.

- `PrecedentList.tsx` — computes approval/refusal counts, recent decisions (2yr filter) at render-time
- `BuiltFormSummary.tsx` — computes building heights (min/max/mean/median from `render_height`), footprint count/coverage, land use tag distribution at render-time
- `PlanningStats.tsx` — displays IBEX stats as-is
- `ConstraintsSummary.tsx` — lists intersecting constraints with type label and source

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # 'use client', renders <MapShell />
│   ├── globals.css
│   └── api/
│       ├── ibex/
│       │   ├── search/route.ts
│       │   └── stats/route.ts
│       └── constraints/route.ts
├── components/
│   ├── map/
│   │   ├── MapShell.tsx          # flex container: map + side panel
│   │   ├── MapCanvas.tsx
│   │   ├── MapPrompt.tsx
│   │   ├── DeckOverlay.tsx
│   │   └── layers/
│   │       ├── PlanningPrecedentLayer.ts
│   │       ├── ConstraintOverlayLayer.ts
│   │       └── SiteHighlightLayer.ts
│   └── panel/
│       ├── SidePanel.tsx
│       ├── SiteHeader.tsx
│       ├── PlanningStats.tsx
│       ├── PrecedentList.tsx
│       ├── ConstraintsSummary.tsx
│       └── BuiltFormSummary.tsx
├── stores/
│   ├── mapStore.ts
│   └── siteStore.ts
├── hooks/
│   ├── useSiteSelection.ts       # core orchestrator
│   ├── useConstraintFetch.ts
│   └── useBuiltForm.ts
├── lib/
│   ├── coords.ts
│   ├── colors.ts
│   ├── geometry.ts
│   ├── normalise.ts
│   ├── builtForm.ts
│   ├── ibexClient.ts
│   └── constraintSources.ts
└── types/
    ├── siteContext.ts            # central domain type
    ├── ibex.ts
    ├── constraints.ts
    └── map.ts
```

---

## Key Architectural Decisions

1. **SiteContext stores raw spatial evidence only** — no min/max/mean/density/counts in the domain object. Derived summaries computed at render-time inside panel components, never persisted.
2. **Planning applications normalised to polygon features** — all apps converted to `GeoJSON.FeatureCollection` on receipt. Apps with geometry keep it (`geometrySource: 'application-geometry'`). Apps without geometry get a 50m buffered centroid polygon (`geometrySource: 'buffered-centroid'`). No inconsistent point/polygon mix.
3. **Built form stored as raw features** — `nearbyContextFeatures.buildings` and `.landuse` are raw GeoJSON FeatureCollections from vector tiles. Heights, coverage, land use tags extracted at render-time only.
4. **IBEX Stats stored as-is** — `planningContextStats` is the unmodified IBEX response.
5. **Site-first workflow** — no data fetched on pan/zoom. All evidence assembled on site click.
6. **Automatic constraints** — all 4 types auto-fetch on site selection; no manual toggle.
7. **No scoring, ranking, inference, or recommendation** — purely descriptive of what exists around the selected parcel today.

---

## Verification Checklist

1. Load map at Thamesmead zoom 14 — 3D buildings render, prompt visible
2. Click on a parcel — progressive loading, then:
   - Site boundary highlighted
   - All planning precedent rendered as polygons (no points)
   - Buffered-centroid features shown with dashed outline
   - Constraints auto-render on map
   - Panel: PlanningStats (IBEX as-is), PrecedentList, ConstraintsSummary, BuiltFormSummary
3. Verify `SiteContext` in devtools contains only raw features + as-is IBEX stats — no computed values
4. Verify `BuiltFormSummary` computes heights/coverage at render-time from raw features
5. Verify `PrecedentList` computes counts/filters at render-time from raw features
6. Close panel — all overlays clear, prompt reappears
7. Unit tests pass: `coords.test.ts`, `geometry.test.ts`, `normalise.test.ts`

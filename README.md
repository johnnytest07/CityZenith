# CityZenith

**AI-powered urban intelligence — from a single parcel to an entire borough.**

CityZenith is a real-time 3D planning map that assembles spatial evidence the moment you click a site, then layers in AI-generated planning intelligence to help developers and council planners act faster and smarter. It runs entirely in the browser, no GIS skills required.

---

## The Problem

UK planning is broken by information asymmetry. Developers spend weeks manually trawling planning portals, constraint maps, and Land Registry data just to decide whether a site is worth pursuing. Council planners lack the tools to identify strategic opportunity at scale — instead relying on legacy GIS and manual policy reviews. CityZenith collapses that research from weeks to seconds.

---

## What It Does

### Site-First Workflow

Click anywhere on the map. CityZenith immediately fires four parallel data retrievals and assembles a **SiteContext** — a container of raw spatial evidence tied to the exact parcel you selected:

- **Planning precedents** — every planning application within ~500m, normalised to uniform polygons and rendered on the map. Applications with geometry use their real site boundary; those without get a 50m buffered centroid so there are no missing data points.
- **Statutory constraints** — Green Belt, Conservation Area, Article 4 Directions, Flood Risk Zones — auto-fetched from planning.data.gov.uk and the Environment Agency WFS and rendered as overlays the instant the site clicks.
- **Built form** — raw building footprints and land use polygons pulled directly from already-loaded MapLibre OSM vector tiles within a 250m radius. No second network round trip.
- **Planning statistics** — approval rates, application volume, and decision speed sourced from the IBEX planning intelligence API.

Everything is streamed progressively — the map updates as each dataset arrives.

### AI Insights & Viability Score

Once planning data loads, CityZenith automatically sends the assembled evidence to **Gemini 2.5 Pro** to generate a structured insights report. The model is given:

- Serialised planning precedents (filtered to substantive applications — no domestic extensions)
- Active statutory constraints with policy implications
- Chunks of the adopted Local Plan retrieved by semantic vector search from a MongoDB corpus
- IBEX approval rate statistics

It returns prioritised insights across five categories — planning, constraints, built form, council, and connectivity — each tagged High / Medium / Low. These bullets are surfaced inline within each evidence panel rather than isolated in a separate tab. A **viability score** (0–100) is derived from the priority distribution and shown at the top of the panel so you can see site health at a glance.

### Developer Build Mode

Click any building to enter **Build Mode** — a step-by-step development appraisal workflow:

1. **Select project type** — new build, demolition and rebuild, extension, renovation, change of use, or subdivision.
2. **AI approval likelihood** — Gemini analyses your project type against the 40 most recent decided local applications and returns a structured verdict: High / Medium / Low likelihood, with specific precedent citations and risk factors drawn only from real local history.
3. **Financial appraisal** — estimated GDV, build cost range, total investment, net profit, and ROI — calibrated against UK benchmark cost data and the site's actual location.
4. **Alternative options** — ranked alternative project types with comparative viability scores, so you can quickly pivot if the primary option looks constrained.

The building's height, footprint, implied storeys, and use class are extracted automatically from the map so you don't input any numbers.

### Renovation Estimator

Separate from the full build appraisal, CityZenith offers a quick renovation return estimate for any building — GDV, refurbishment cost range, net profit, and ROI using UK benchmarks (£300–£1,400/m² depending on depth of works), with confidence scoring based on data completeness.

### Market Value Heat Map

A live **hex-grid market value layer** overlays postcode-level residential transaction prices sourced from HM Land Registry SPARQL (UK price paid dataset). As you pan, new postcodes are fetched, merged into the client-side cache, and the hex grid rebuilds locally — no full reload on zoom or pan. The layer gives instant spatial context on value zones before committing to any site.

### Amenities Intelligence

A dedicated amenities panel surfaces nearby transport links, schools, green space, retail, and healthcare within reach of the selected site — providing the connectivity context that planning officers and valuers need.

---

## Council Mode

CityZenith has a completely separate interface for **local authority planners**, unlocked by selecting the Council role at startup.

### 10-Stage Borough Analysis

Council users trigger a multi-stage AI analysis of their entire borough. Gemini 2.5 Pro runs ten sequential analytical passes, each grounded in the council's **adopted Local Plan** (retrieved by RAG from the MongoDB vector store):

| Stage | Focus |
|---|---|
| 1 | Land use & vacancy audit — brownfield sites, underutilised parcels |
| 2 | Statutory constraint mapping — proportionality assessment |
| 3 | Planning performance — refusal clusters, stalled schemes |
| 4 | Local plan opportunity areas — regeneration allocations vs delivery |
| 5 | Housing delivery & pipeline — 5-year land supply gap |
| 6 | Green & blue infrastructure deficit — open space vs Fields in Trust standard |
| 7 | Transport & connectivity gaps — low PTAL zones, missing active travel links |
| 8 | Economic & employment challenges — commercial vacancy, employment land loss |
| 9 | Opportunity zone synthesis — cross-referenced priority ranking |
| 10 | Implementation proposals — spatial interventions with delivery mechanisms |

Each stage streams its output progressively using Server-Sent Events — the council panel updates in real-time as each analysis completes. Results are cached in MongoDB per council so repeat queries are instant.

### Spatial Suggestions on the Map

Each analysis stage produces spatially-located **suggestions** — GeoJSON polygon overlays on the map showing exactly where the opportunity or intervention sits. Each suggestion includes:
- Rationale grounded in the Local Plan
- Priority rating (High / Medium / Low)
- Implementation options (specific sites, density, heights, delivery mechanism)
- Policy basis citations

Council planners can click any suggestion to fly the map to that location.

### Local Plan RAG

Local plan PDFs are ingested, chunked, and embedded into a MongoDB vector store. When Gemini analyses a council's borough, relevant policy chunks are retrieved by semantic similarity and injected into the prompt — so every recommendation is tethered to actual adopted policy, not generic planning knowledge.

Currently supported: **Royal Greenwich** and **Enfield**. Additional councils can be onboarded by running the ingest pipeline against any Local Plan PDF.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Map engine | MapLibre GL + react-map-gl |
| 3D overlays | deck.gl (GeoJsonLayer, interleaved mode) |
| AI / LLM | Google Gemini 2.5 Pro |
| Vector store | MongoDB Atlas (Local Plan RAG) |
| Planning data | IBEX API (`/search`, `/stats`) |
| Constraint data | planning.data.gov.uk + EA WFS |
| Market data | HM Land Registry SPARQL (price paid) |
| Coordinate transforms | proj4 (EPSG:27700 ↔ WGS84) |
| Spatial ops | Turf.js |
| State management | Zustand |
| Language | TypeScript throughout |

---

## Data Architecture

**SiteContext stores raw spatial evidence only.** No computed values (counts, averages, densities) are ever persisted in state. All summaries — building height statistics, approval/refusal ratios, coverage percentages — are derived at render-time inside panel components from the raw feature collections. This keeps the domain object honest and all UI logic transparent.

The one intentional exception: `developer_metrics` (complexity score, high-value tags, decision speed) are computed at normalisation time and stored on planning precedent features so the map layer can drive visual styling without repeated computation.

---

## Getting Started

### Prerequisites

```bash
node >= 18
```

### Install

```bash
npm install
```

### Environment

Create `.env.local`:

```
IBEX_API_KEY=your_ibex_key
MAPTILER_KEY=your_maptiler_key
GEMINI_API_KEY=your_gemini_key
MONGODB_URI=your_mongodb_uri
```

### Run

```bash
npm run dev
```

Map loads at Thamesmead (51.5010°N, 0.1155°E), zoom 14, pitch 45°. Click any parcel to begin.

### Tests

```bash
npx vitest
```

### Ingest a Local Plan (Council Mode)

```bash
cd intelligence/council
npm run ingest path/to/local-plan.pdf "Council Name"
```

---

## What's Next

- Expanded council coverage (any UK LPA ingestion)
- Permitted development rights checker
- Section 106 / CIL obligation estimator
- Portfolio mode — assess multiple sites in one session
- Agent mode — autonomous site sourcing against user-defined criteria

---

*Built for the UK proptech and govtech ecosystem. All planning data sourced from public APIs. AI analysis is indicative only and does not constitute planning or financial advice.*

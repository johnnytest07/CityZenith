'use client'

import { useSiteStore } from '@/stores/siteStore'

/**
 * Reads nearbyContextFeatures (raw GeoJSON) from SiteContext.
 * ALL summary values are computed HERE at render-time — never stored in state.
 *
 * Displays descriptive raw measurements of what exists around the site today.
 * No interpretation, scoring, or inference.
 */
export function BuiltFormSummary() {
  const { siteContext } = useSiteStore()

  const { buildings, landuse, queryRadiusM } =
    siteContext?.nearbyContextFeatures ?? {
      buildings: { type: 'FeatureCollection' as const, features: [] },
      landuse: { type: 'FeatureCollection' as const, features: [] },
      queryRadiusM: 250,
    }

  // ---- Render-time computation from raw features only ----

  // Building heights
  const heights: number[] = buildings.features
    .map((f) => {
      const h = f.properties?.render_height ?? f.properties?.height ?? f.properties?.building_height
      return typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
    })
    .filter((h) => !isNaN(h) && h > 0)
    .sort((a, b) => a - b)

  const heightStats = heights.length > 0
    ? {
        count: heights.length,
        min: heights[0],
        max: heights[heights.length - 1],
        mean: heights.reduce((s, h) => s + h, 0) / heights.length,
        median: heights[Math.floor(heights.length / 2)],
      }
    : null

  // Building footprint count
  const buildingCount = buildings.features.length

  // Land use tag distribution
  const landuseMap: Record<string, number> = {}
  for (const f of landuse.features) {
    const tag = (
      f.properties?.landuse ??
      f.properties?.['landuse:type'] ??
      f.properties?.leisure ??
      f.properties?.natural ??
      'unknown'
    ) as string
    landuseMap[tag] = (landuseMap[tag] ?? 0) + 1
  }
  const landuseTags = Object.entries(landuseMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  // -------------------------------------------------------

  if (buildingCount === 0 && landuse.features.length === 0) {
    return (
      <Section title={`Built Form Context (${queryRadiusM}m radius)`}>
        <p className="text-gray-600 text-xs">No built form data loaded for this area yet. Pan to zoom level 14+ and reselect.</p>
      </Section>
    )
  }

  return (
    <Section title={`Built Form Context (${queryRadiusM}m radius)`}>
      {/* Buildings */}
      <div className="mb-4">
        <p className="text-gray-500 text-xs mb-2">Buildings nearby</p>
        <div className="flex gap-2 text-xs flex-wrap">
          <StatChip label="Count" value={String(buildingCount)} />
          {heightStats && (
            <>
              <StatChip label="Min height" value={`${heightStats.min.toFixed(1)}m`} />
              <StatChip label="Max height" value={`${heightStats.max.toFixed(1)}m`} />
              <StatChip label="Mean height" value={`${heightStats.mean.toFixed(1)}m`} />
              <StatChip label="Median height" value={`${heightStats.median.toFixed(1)}m`} />
            </>
          )}
          {!heightStats && buildingCount > 0 && (
            <span className="text-gray-600 text-xs">Height data not available in tiles</span>
          )}
        </div>
      </div>

      {/* Land use */}
      {landuseTags.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs mb-2">Adjacent land use</p>
          <div className="flex flex-wrap gap-1.5">
            {landuseTags.map(([tag, count]) => (
              <span
                key={tag}
                className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded"
              >
                {tag}
                {count > 1 && (
                  <span className="text-gray-600 ml-1">×{count}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded px-2 py-1">
      <span className="text-gray-500 mr-1">{label}:</span>
      <span className="text-gray-300 font-medium tabular-nums">{value}</span>
    </div>
  )
}

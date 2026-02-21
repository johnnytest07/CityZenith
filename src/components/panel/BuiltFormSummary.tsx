'use client'

import { useState } from 'react'
import { useSiteStore } from '@/stores/siteStore'
import { SectionCard } from './SectionCard'

/**
 * Reads nearbyContextFeatures (raw GeoJSON) from SiteContext.
 * ALL summary values computed HERE at render-time — never stored in state.
 */
export function BuiltFormSummary() {
  const { siteContext, insightBullets } = useSiteStore()
  const [expanded, setExpanded] = useState(false)

  const insightBullet = insightBullets?.find((b) => b.category === 'built_form') ?? null

  const { buildings, landuse, queryRadiusM } =
    siteContext?.nearbyContextFeatures ?? {
      buildings: { type: 'FeatureCollection' as const, features: [] },
      landuse: { type: 'FeatureCollection' as const, features: [] },
      queryRadiusM: 250,
    }

  // ---- Render-time computation from raw features only ----
  const heights: number[] = buildings.features
    .map((f) => {
      const h =
        f.properties?.render_height ??
        f.properties?.height ??
        f.properties?.building_height
      return typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
    })
    .filter((h) => !isNaN(h) && h > 0)
    .sort((a, b) => a - b)

  const heightStats =
    heights.length > 0
      ? {
          min: heights[0],
          max: heights[heights.length - 1],
          mean: heights.reduce((s, h) => s + h, 0) / heights.length,
          median: heights[Math.floor(heights.length / 2)],
        }
      : null

  const buildingCount = buildings.features.length

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

  const noData = buildingCount === 0 && landuse.features.length === 0

  const summary = noData ? (
    <span className="text-xs text-gray-600">No data — zoom to level 14+</span>
  ) : (
    <div className="flex items-center gap-1.5 text-xs flex-wrap">
      <span className="font-semibold text-gray-300 tabular-nums">{buildingCount}</span>
      <span className="text-gray-600">buildings</span>
      {heightStats && (
        <>
          <span className="text-gray-700 mx-0.5">·</span>
          <span className="text-gray-400 tabular-nums">
            {heightStats.min.toFixed(0)}–{heightStats.max.toFixed(0)}m
          </span>
        </>
      )}
      {landuseTags.length > 0 && (
        <>
          <span className="text-gray-700 mx-0.5">·</span>
          <span className="text-gray-500">{landuseTags[0][0]}</span>
          {landuseTags.length > 1 && (
            <span className="text-gray-700">+{landuseTags.length - 1}</span>
          )}
        </>
      )}
    </div>
  )

  return (
    <SectionCard
      title={`Built Form (${queryRadiusM}m)`}
      summary={summary}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      {noData ? (
        <>
          <p className="text-gray-600 text-xs mt-2">
            No built form data loaded for this area yet. Pan to zoom level 14+ and reselect.
          </p>
          {insightBullet && (
            <div className="mt-3 pt-3 border-t border-violet-900/40 flex gap-2">
              <span className="text-violet-500 shrink-0 mt-0.5">✦</span>
              <p className="text-xs text-violet-300 leading-relaxed">{insightBullet.text}</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-2 space-y-4">
          <div>
            <p className="text-gray-500 text-xs mb-2">Buildings nearby</p>
            <div className="flex gap-2 text-xs flex-wrap">
              <StatChip label="Count" value={String(buildingCount)} />
              {heightStats && (
                <>
                  <StatChip label="Min" value={`${heightStats.min.toFixed(1)}m`} />
                  <StatChip label="Max" value={`${heightStats.max.toFixed(1)}m`} />
                  <StatChip label="Mean" value={`${heightStats.mean.toFixed(1)}m`} />
                  <StatChip label="Median" value={`${heightStats.median.toFixed(1)}m`} />
                </>
              )}
              {!heightStats && buildingCount > 0 && (
                <span className="text-gray-600 text-xs">Height data not available in tiles</span>
              )}
            </div>
          </div>

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
                    {count > 1 && <span className="text-gray-600 ml-1">×{count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {insightBullet && (
            <div className="mt-1 pt-3 border-t border-violet-900/40 flex gap-2">
              <span className="text-violet-500 shrink-0 mt-0.5">✦</span>
              <p className="text-xs text-violet-300 leading-relaxed">{insightBullet.text}</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
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

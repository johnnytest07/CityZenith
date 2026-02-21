'use client'

import { useMapStore } from '@/stores/mapStore'

/**
 * Floating pill toggle for the market-value hex layer.
 * Positioned bottom-right of the map area, above the MapLibre attribution bar.
 */
export function MapLayerToggle() {
  const { marketValueEnabled, setMarketValueEnabled } = useMapStore()

  return (
    <div
      style={{ position: 'absolute', bottom: 32, right: 16, zIndex: 10 }}
    >
      <button
        onClick={() => setMarketValueEnabled(!marketValueEnabled)}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium',
          'bg-gray-900/80 backdrop-blur transition-colors',
          marketValueEnabled
            ? 'border-amber-500/60 text-amber-400'
            : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600',
        ].join(' ')}
        title={marketValueEnabled ? 'Hide market value layer' : 'Show market value layer'}
      >
        <span>💷</span>
        <span>Market Value</span>
      </button>
    </div>
  )
}

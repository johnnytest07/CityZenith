'use client'

import { useMapStore } from '@/stores/mapStore'

export function MapLayerToggle() {
  const { marketValueEnabled, setMarketValueEnabled, marketValueLoading } = useMapStore()

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
        {marketValueLoading ? (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <span>💷</span>
        )}
        <span>Market Value</span>
      </button>
    </div>
  )
}

'use client'

import { useRenovStore } from '@/stores/renovStore'
import type { RecommendFactor } from '@/types/devMode'

const fmt = (v: number) =>
  v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })

const IMPACT_DOT: Record<RecommendFactor['impact'], string> = {
  positive: 'bg-green-400',
  neutral: 'bg-gray-500',
  negative: 'bg-red-400',
}

const IMPACT_TEXT: Record<RecommendFactor['impact'], string> = {
  positive: 'text-green-300',
  neutral: 'text-gray-400',
  negative: 'text-red-300',
}

function FactorRow({ factor }: { factor: RecommendFactor }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[factor.impact]}`} />
        <span className="text-[11px] text-gray-500 truncate">{factor.label}</span>
      </div>
      <span className={`text-[11px] font-medium shrink-0 ${IMPACT_TEXT[factor.impact]}`}>
        {factor.value}
      </span>
    </div>
  )
}

export function RenovationPanel() {
  const {
    renovStep,
    renovResult,
    renovError,
    selectedBuilding,
    setRenovStep,
    setRenovResult,
    setRenovError,
    deactivateRenovMode,
  } = useRenovStore()

  const handleRetry = async () => {
    if (!selectedBuilding) return
    setRenovStep('loading')
    try {
      const res = await fetch('/api/renovation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building: selectedBuilding }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRenovError(data.error ?? 'Failed')
        return
      }
      setRenovResult(data)
    } catch (err) {
      setRenovError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  if (renovStep === 'loading') {
    return (
      <div className="flex items-center gap-2 text-xs text-orange-400 px-4 py-4">
        <span className="w-3 h-3 border border-orange-500 border-t-orange-200 rounded-full animate-spin shrink-0" />
        Estimating renovation return…
      </div>
    )
  }

  if (renovStep === 'error') {
    return (
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          <span className="text-red-400 shrink-0 text-sm">✕</span>
          <p className="text-[11px] text-red-300 leading-snug">{renovError ?? 'Unknown error'}</p>
        </div>
        <button
          onClick={handleRetry}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors w-full"
        >
          Retry
        </button>
      </div>
    )
  }

  if (renovStep !== 'result' || !renovResult) return null

  const { gdvEstimate, renovationCostRange, netProfitEstimate, roiPercent, summary, factors, confidence } = renovResult

  const roiColor =
    roiPercent >= 15
      ? 'text-green-400'
      : roiPercent >= 5
        ? 'text-amber-400'
        : 'text-red-400'

  const roiBarColor =
    roiPercent >= 15
      ? 'bg-green-500'
      : roiPercent >= 5
        ? 'bg-amber-400'
        : 'bg-red-500'

  const roiBarWidth = Math.min(100, (roiPercent / 50) * 100)

  const confidenceBadge: Record<string, string> = {
    high:   'bg-green-950/60 text-green-300 border-green-800/50',
    medium: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
    low:    'bg-red-950/60   text-red-300   border-red-800/50',
  }

  return (
    <div className="px-4 pt-3 pb-4 space-y-3">
      {/* ROI hero card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3 relative">
        {/* Confidence badge — top-right */}
        <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${confidenceBadge[confidence] ?? confidenceBadge.medium}`}>
          {confidence}
        </span>

        <div className="flex items-baseline gap-1 mb-2.5">
          <span className={`text-3xl font-bold tabular-nums leading-none ${roiColor}`}>
            {roiPercent.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-600 font-medium ml-1">ROI</span>
        </div>

        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${roiBarColor}`}
            style={{ width: `${Math.max(0, roiBarWidth)}%` }}
          />
        </div>
      </div>

      {/* Financial grid — GDV + Net Profit side by side, cost range full-width below */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-0.5">GDV</p>
            <p className="text-xs font-semibold text-gray-200">{fmt(gdvEstimate)}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-0.5">Net Profit</p>
            <p className={`text-xs font-semibold ${netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {fmt(netProfitEstimate)}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">Reno Cost Range</p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Low</span>
            <span className="text-xs font-semibold text-gray-200">{fmt(renovationCostRange[0])}</span>
            <span className="text-gray-700 text-[10px] mx-1">→</span>
            <span className="text-xs font-semibold text-gray-200">{fmt(renovationCostRange[1])}</span>
            <span className="text-[10px] text-gray-500">High</span>
          </div>
        </div>
        {selectedBuilding && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-0.5">Building</p>
            <p className="text-xs text-gray-400">
              {selectedBuilding.footprintM2 != null ? `${Math.round(selectedBuilding.footprintM2)}m²` : '—'}
              {' · '}
              {selectedBuilding.impliedStoreys != null ? `${selectedBuilding.impliedStoreys} storeys` : '—'}
              {selectedBuilding.buildingType ? ` · ${selectedBuilding.buildingType}` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Summary */}
      <p className="text-[11px] text-gray-400 leading-relaxed">{summary}</p>

      {/* Factors */}
      {factors.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5">Influencing factors</p>
          {factors.slice(0, 5).map((f, i) => (
            <FactorRow key={i} factor={f} />
          ))}
        </div>
      )}

      {/* Clear button */}
      <button
        onClick={deactivateRenovMode}
        className="text-[11px] text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors w-full"
      >
        Clear
      </button>
    </div>
  )
}

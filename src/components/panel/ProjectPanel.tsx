'use client'

import { useProjectStore } from '@/stores/projectStore'
import { useDevStore } from '@/stores/devStore'
import { PROJECT_TYPE_META, PROJECT_TYPES } from '@/types/project'
import type { ProjectType, ProjectFinancials, ApprovalLikelihood } from '@/types/project'
import type { RecommendFactor } from '@/types/devMode'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })

const IMPACT_DOT: Record<RecommendFactor['impact'], string> = {
  positive: 'bg-green-400',
  neutral:  'bg-gray-500',
  negative: 'bg-red-400',
}
const IMPACT_TEXT: Record<RecommendFactor['impact'], string> = {
  positive: 'text-green-300',
  neutral:  'text-gray-400',
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

// ─── Type selector ────────────────────────────────────────────────────────────

function TypeGrid({ onSelect, onNewBuild }: { onSelect: (t: ProjectType) => void; onNewBuild: () => void }) {
  return (
    <div className="px-4 pt-3 pb-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Select a project type</p>
      <div className="grid grid-cols-2 gap-2">
        {PROJECT_TYPES.map((type) => {
          const meta = PROJECT_TYPE_META[type]
          return (
            <button
              key={type}
              onClick={() => type === 'new-build' ? onNewBuild() : onSelect(type)}
              className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border border-gray-800 bg-gray-900/60 hover:border-gray-600 hover:bg-gray-900 transition-colors text-left"
            >
              <span className="text-lg leading-none">{meta.icon}</span>
              <span className="text-xs font-semibold text-gray-200 leading-tight">{meta.label}</span>
              <span className="text-[10px] text-gray-600 leading-snug">{meta.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Awaiting click ───────────────────────────────────────────────────────────

function AwaitingClick({ projectType, onChangeType }: { projectType: ProjectType; onChangeType: () => void }) {
  const meta = PROJECT_TYPE_META[projectType]
  return (
    <div className="px-4 pt-3 pb-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{meta.icon}</span>
        <span className="text-xs font-semibold text-gray-200">{meta.label}</span>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-4 text-center">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Click a <span className="text-white font-medium">3D building</span> on the map to analyse it
        </p>
        <p className="text-[10px] text-gray-600 mt-1">Zoom in until buildings are visible (zoom 14+)</p>
      </div>
      <button
        onClick={onChangeType}
        className="text-[11px] text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors w-full"
      >
        ← Change project type
      </button>
    </div>
  )
}

// ─── Planning likelihood section ──────────────────────────────────────────────

function PlanningSection({ approval }: { approval: ApprovalLikelihood }) {
  const { percent, confidence, summary, supportingPrecedents, riskFactors, comparableCases } = approval

  const barColor =
    percent >= 65 ? 'bg-green-500' :
    percent >= 35 ? 'bg-amber-400' :
    'bg-red-500'

  const pctColor =
    percent >= 65 ? 'text-green-400' :
    percent >= 35 ? 'text-amber-400' :
    'text-red-400'

  const confidenceBadge: Record<string, string> = {
    high:   'bg-green-950/60 text-green-300 border-green-800/50',
    medium: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
    low:    'bg-red-950/60   text-red-300   border-red-800/50',
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-gray-600">Planning Likelihood</p>

      <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3 relative">
        <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${confidenceBadge[confidence] ?? confidenceBadge.medium}`}>
          {confidence}
        </span>

        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-3xl font-bold tabular-nums leading-none ${pctColor}`}>{percent}%</span>
          <span className="text-xs text-gray-600 ml-1">
            {comparableCases > 0 ? `${comparableCases} comparable case${comparableCases !== 1 ? 's' : ''}` : 'limited precedent'}
          </span>
        </div>

        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">{summary}</p>

      {riskFactors.length > 0 && (
        <div className="space-y-1">
          {riskFactors.map((r, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-amber-500 shrink-0 text-[10px] mt-0.5">⚠</span>
              <span className="text-[11px] text-gray-500 leading-snug">{r}</span>
            </div>
          ))}
        </div>
      )}

      {supportingPrecedents.length > 0 && (
        <div className="space-y-1">
          {supportingPrecedents.map((p, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-indigo-400 shrink-0 text-[10px] mt-0.5">▸</span>
              <span className="text-[11px] text-gray-500 leading-snug">{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Financials section ───────────────────────────────────────────────────────

function FinancialsSection({ fin }: { fin: ProjectFinancials }) {
  const primaryColor =
    fin.primaryMetric === 'ROI' || fin.primaryMetric === 'Dev Margin'
      ? parseFloat(fin.primaryValue) >= 15 ? 'text-green-400'
        : parseFloat(fin.primaryValue) >= 5  ? 'text-amber-400'
        : 'text-red-400'
      : 'text-green-400'  // Value Uplift / Uplift — always positive framing

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-gray-600">Financial Projection</p>

      {/* Primary metric hero */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-bold tabular-nums leading-none ${primaryColor}`}>
            {fin.primaryValue}
          </span>
          <span className="text-sm text-gray-600">{fin.primaryMetric}</span>
        </div>
      </div>

      {/* Type-specific financial grid */}
      <FinancialGrid fin={fin} />

      <p className="text-[11px] text-gray-400 leading-relaxed">{fin.summary}</p>

      {fin.factors.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5">Influencing factors</p>
          {fin.factors.slice(0, 5).map((f, i) => <FactorRow key={i} factor={f} />)}
        </div>
      )}
    </div>
  )
}

function FinancialGrid({ fin }: { fin: ProjectFinancials }) {
  const cells: { label: string; value: string; highlight?: string }[] = []

  switch (fin.projectType) {
    case 'renovation':
      if (fin.gdvEstimate != null) cells.push({ label: 'GDV', value: fmt(fin.gdvEstimate) })
      if (fin.netProfitEstimate != null) cells.push({ label: 'Net Profit', value: fmt(fin.netProfitEstimate), highlight: fin.netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300' })
      if (fin.renovationCostRange) cells.push({ label: 'Reno Cost', value: `${fmt(fin.renovationCostRange[0])} – ${fmt(fin.renovationCostRange[1])}` })
      if (fin.totalInvestment != null) cells.push({ label: 'Total In', value: fmt(fin.totalInvestment) })
      break
    case 'new-build':
      if (fin.gdvEstimate != null) cells.push({ label: 'GDV', value: fmt(fin.gdvEstimate) })
      if (fin.netProfitEstimate != null) cells.push({ label: 'Net Profit', value: fmt(fin.netProfitEstimate), highlight: fin.netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300' })
      if (fin.buildCostRange) cells.push({ label: 'Build Cost', value: `${fmt(fin.buildCostRange[0])} – ${fmt(fin.buildCostRange[1])}` })
      if (fin.totalInvestment != null) cells.push({ label: 'Total In', value: fmt(fin.totalInvestment) })
      break
    case 'demolish-rebuild':
      if (fin.gdvEstimate != null) cells.push({ label: 'New GDV', value: fmt(fin.gdvEstimate) })
      if (fin.netProfitEstimate != null) cells.push({ label: 'Net Profit', value: fmt(fin.netProfitEstimate), highlight: fin.netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300' })
      if (fin.demolitionCost != null) cells.push({ label: 'Demo Cost', value: fmt(fin.demolitionCost) })
      if (fin.buildCostRange) cells.push({ label: 'Build Cost', value: `${fmt(fin.buildCostRange[0])} – ${fmt(fin.buildCostRange[1])}` })
      break
    case 'extension':
      if (fin.valueUplift != null) cells.push({ label: 'Value Added', value: fmt(fin.valueUplift), highlight: 'text-green-300' })
      if (fin.netProfitEstimate != null) cells.push({ label: 'Net Gain', value: fmt(fin.netProfitEstimate), highlight: fin.netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300' })
      if (fin.extensionCostRange) cells.push({ label: 'Build Cost', value: `${fmt(fin.extensionCostRange[0])} – ${fmt(fin.extensionCostRange[1])}` })
      break
    case 'change-of-use':
      if (fin.suggestedUse) cells.push({ label: 'Proposed Use', value: fin.suggestedUse })
      if (fin.gdvEstimate != null) cells.push({ label: 'Post-CoU Value', value: fmt(fin.gdvEstimate) })
      if (fin.netProfitEstimate != null) cells.push({ label: 'Net Uplift', value: fmt(fin.netProfitEstimate), highlight: fin.netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300' })
      if (fin.totalInvestment != null) cells.push({ label: 'Conversion', value: fmt(fin.totalInvestment) })
      break
    case 'subdivision':
      if (fin.unitCount != null) cells.push({ label: 'Units', value: `${fin.unitCount}` })
      if (fin.gdvPerUnit != null) cells.push({ label: 'GDV / Unit', value: fmt(fin.gdvPerUnit) })
      if (fin.gdvEstimate != null) cells.push({ label: 'Total GDV', value: fmt(fin.gdvEstimate) })
      if (fin.netProfitEstimate != null) cells.push({ label: 'Net Profit', value: fmt(fin.netProfitEstimate), highlight: fin.netProfitEstimate >= 0 ? 'text-green-300' : 'text-red-300' })
      break
  }

  if (cells.length === 0) return null

  // Pair cells into rows of 2
  const rows: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2))

  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <div key={ri} className={`grid gap-2 ${row.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {row.map((cell, ci) => (
            <div key={ci} className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2 min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-0.5">{cell.label}</p>
              <p className={`text-xs font-semibold truncate ${cell.highlight ?? 'text-gray-200'}`}>{cell.value}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ProjectPanel() {
  const {
    projectStep,
    projectType,
    projectResult,
    projectError,
    selectedBuilding,
    setProjectType,
    setProjectStep,
    deactivateProjectMode,
  } = useProjectStore()
  const { activateBuildNew } = useDevStore()

  // Re-analyse with the same type on a new building
  const handleRetry = () => {
    if (projectType) setProjectType(projectType)
  }

  const handleNewBuild = () => {
    deactivateProjectMode()
    activateBuildNew()
  }

  if (projectStep === 'select-type') {
    return <TypeGrid onSelect={setProjectType} onNewBuild={handleNewBuild} />
  }

  if (projectStep === 'awaiting-click' && projectType) {
    return (
      <AwaitingClick
        projectType={projectType}
        onChangeType={() => setProjectStep('select-type')}
      />
    )
  }

  if (projectStep === 'loading') {
    return (
      <div className="px-4 py-4 space-y-2">
        {projectType && (
          <div className="flex items-center gap-2">
            <span className="text-base">{PROJECT_TYPE_META[projectType].icon}</span>
            <span className="text-xs font-semibold text-gray-300">{PROJECT_TYPE_META[projectType].label}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-indigo-400 py-2">
          <span className="w-3 h-3 border border-indigo-500 border-t-indigo-200 rounded-full animate-spin shrink-0" />
          Analysing project…
        </div>
        <p className="text-[10px] text-gray-600">Fetching planning history and financial projections in parallel…</p>
      </div>
    )
  }

  if (projectStep === 'error') {
    return (
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          <span className="text-red-400 shrink-0 text-sm">✕</span>
          <p className="text-[11px] text-red-300 leading-snug">{projectError ?? 'Analysis failed'}</p>
        </div>
        <button onClick={handleRetry} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors w-full">
          Retry
        </button>
        <button onClick={() => setProjectStep('select-type')} className="text-[11px] text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors w-full">
          ← Change project type
        </button>
      </div>
    )
  }

  if (projectStep === 'result' && projectResult && projectType) {
    const { approval, financials, approvalError, financialsError } = projectResult
    const meta = PROJECT_TYPE_META[projectType]

    return (
      <div className="px-4 pt-3 pb-4 space-y-4">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className="text-xs font-semibold text-gray-300">{meta.label}</span>
          {selectedBuilding?.buildingType && (
            <span className="text-[10px] text-gray-600">· {selectedBuilding.buildingType}</span>
          )}
        </div>

        {/* Planning section */}
        {approval
          ? <PlanningSection approval={approval} />
          : approvalError && (
            <div className="text-[11px] text-gray-600 border border-gray-800 rounded-lg px-3 py-2">
              Planning assessment unavailable: {approvalError}
            </div>
          )
        }

        {/* Divider */}
        {approval && financials && <div className="border-t border-gray-800" />}

        {/* Financials section */}
        {financials
          ? <FinancialsSection fin={financials} />
          : financialsError && (
            <div className="text-[11px] text-gray-600 border border-gray-800 rounded-lg px-3 py-2">
              Financial projection unavailable: {financialsError}
            </div>
          )
        }

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleRetry}
            className="flex-1 text-[11px] text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            New building
          </button>
          <button
            onClick={() => setProjectStep('select-type')}
            className="flex-1 text-[11px] text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            Change type
          </button>
          <button
            onClick={deactivateProjectMode}
            className="flex-1 text-[11px] text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    )
  }

  return null
}

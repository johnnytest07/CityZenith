'use client'

import type { AnalysisStage } from '@/types/council'

interface StageProgressProps {
  stages: AnalysisStage[]
  cachedAt?: string | null
}

export function StageProgress({ stages, cachedAt }: StageProgressProps) {
  const cacheLabel = cachedAt
    ? new Date(cachedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
      {cacheLabel && (
        <p className="text-[10px] text-amber-500/70 mb-1 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
          </svg>
          Using cached analysis from {cacheLabel} — skipping live processing
        </p>
      )}
      {stages.map((stage) => (
        <div key={stage.stageNum} className="flex items-start gap-2 py-1">
          {/* Status icon */}
          <div className="mt-0.5 shrink-0 w-4 h-4 flex items-center justify-center">
            {stage.status === 'complete' && stage.fromCache ? (
              <svg className="w-3.5 h-3.5 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
            ) : stage.status === 'complete' ? (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : stage.status === 'running' ? (
              <span className="block w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            ) : (
              <span className="block w-2 h-2 rounded-full bg-gray-600" />
            )}
          </div>

          {/* Stage text */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-medium truncate ${
                stage.status === 'complete'
                  ? stage.fromCache ? 'text-gray-500' : 'text-gray-300'
                  : stage.status === 'running'
                    ? 'text-indigo-300'
                    : 'text-gray-600'
              }`}
            >
              {stage.name}
            </p>
            {stage.status === 'complete' && stage.fromCache && (
              <p className="text-[10px] text-amber-600/60 mt-0.5">skipped — from cache</p>
            )}
            {stage.status === 'complete' && !stage.fromCache && stage.suggestionCount > 0 && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                {stage.suggestionCount} suggestion{stage.suggestionCount !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

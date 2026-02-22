'use client'

import type { AnalysisStage } from '@/types/council'

interface StageProgressProps {
  stages: AnalysisStage[]
}

export function StageProgress({ stages }: StageProgressProps) {
  return (
    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
      {stages.map((stage) => (
        <div key={stage.stageNum} className="flex items-start gap-2 py-1">
          {/* Status icon */}
          <div className="mt-0.5 shrink-0 w-4 h-4 flex items-center justify-center">
            {stage.status === 'complete' ? (
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
                  ? 'text-gray-300'
                  : stage.status === 'running'
                    ? 'text-indigo-300'
                    : 'text-gray-600'
              }`}
            >
              {stage.name}
            </p>
            {stage.status === 'complete' && stage.suggestionCount > 0 && (
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

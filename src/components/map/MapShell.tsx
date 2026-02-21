'use client'

import { MapCanvas } from './MapCanvas'
import { MapPrompt } from './MapPrompt'
import { BuildingHoverCard } from './BuildingHoverCard'
import { SidePanel } from '@/components/panel/SidePanel'
import { IdentityGate, IdentityBadge } from '@/components/identity/IdentityGate'
import { useSiteStore } from '@/stores/siteStore'

/**
 * Top-level layout container: map (flex-1) + side panel (w-96, conditional).
 * Wrapped in IdentityGate so users identify their role before exploring.
 */
export function MapShell() {
  const { siteContext } = useSiteStore()

  const hasSite = siteContext !== null

  return (
    <IdentityGate>
      <div className="flex h-screen w-screen bg-gray-950 overflow-hidden">
        {/* Map area */}
        <div className="relative flex-1 min-w-0">
          <MapCanvas />
          <MapPrompt visible={!hasSite} />
          <BuildingHoverCard />
          <IdentityBadge />
        </div>

        {/* Side panel — slides in when a site is selected */}
        {hasSite && (
          <div className="w-96 flex-shrink-0 border-l border-gray-800 overflow-y-auto bg-gray-950">
            <SidePanel />
          </div>
        )}
      </div>
    </IdentityGate>
  )
}

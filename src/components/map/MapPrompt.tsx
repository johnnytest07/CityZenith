'use client'

import { useState } from 'react'
import { useMapStore } from '@/stores/mapStore'

interface MapPromptProps {
  visible: boolean
}

/**
 * Overlay shown on initial load when no site is selected.
 * Provides site-first workflow guidance and postcode search.
 */
export function MapPrompt({ visible }: MapPromptProps) {
  const [postcode, setPostcode] = useState('')
  const [searching, setSearching] = useState(false)
  const { setViewState } = useMapStore()

  if (!visible) return null

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!postcode.trim()) return

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)}&countrycodes=gb&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      )
      const results = await res.json()

      if (results.length > 0) {
        const { lon, lat } = results[0]
        setViewState({
          longitude: parseFloat(lon),
          latitude: parseFloat(lat),
          zoom: 15,
          pitch: 45,
          bearing: -17.6,
        })
      }
    } catch (err) {
      console.warn('Postcode search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none z-10">
      <div className="pointer-events-auto bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-2xl px-6 py-5 w-full max-w-md mx-4 shadow-2xl">
        <p className="text-white text-sm font-medium mb-1">Site Planning Context</p>
        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
          Click on a land parcel or building to see planning history, statutory constraints and built form context.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Search postcode or address…"
            className="flex-1 bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={searching || !postcode.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {searching ? '…' : 'Go'}
          </button>
        </form>
      </div>
    </div>
  )
}

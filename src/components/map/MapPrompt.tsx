"use client";

import { useState, useEffect, useRef } from "react";
import { useMapStore } from "@/stores/mapStore";

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface MapPromptProps {
  /** When true, show the hint text below the search bar */
  showHint?: boolean;
}

/**
 * Google Maps–style search bar pinned to the top of the map.
 * Always visible; shows autocomplete suggestions from Nominatim as the user types.
 */
export function MapPrompt({ showHint = false }: MapPromptProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setViewState } = useMapStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // True after a successful navigation — suppresses dropdown until user types new text
  const navigatedRef = useRef(false);

  // Debounced autocomplete fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (navigatedRef.current) return;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=gb&format=json&limit=6`,
          { headers: { "Accept-Language": "en" } },
        );
        const results: Suggestion[] = await res.json();
        setSuggestions(results);
        if (results.length > 0) setShowSuggestions(true);
      } catch {
        // silently ignore network errors
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function navigateTo(lat: string, lon: string) {
    setViewState({
      longitude: parseFloat(lon),
      latitude: parseFloat(lat),
      zoom: 15,
      pitch: 45,
      bearing: -17.6,
    });
    navigatedRef.current = true;
    setShowSuggestions(false);
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.display_name.split(",")[0]);
    navigateTo(s.lat, s.lon);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=gb&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } },
      );
      const results: Suggestion[] = await res.json();
      if (results.length > 0) navigateTo(results[0].lat, results[0].lon);
    } catch (err) {
      console.warn("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function clearQuery() {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    navigatedRef.current = false;
  }

  const showDropdown = showSuggestions && suggestions.length > 0;
  const showHintBar = showHint && !showDropdown && query.trim().length === 0;

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4 pointer-events-auto"
    >
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Search input row */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center px-4 h-12 gap-3"
        >
          {/* Search icon */}
          <svg
            className="w-5 h-5 text-gray-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-3.5-3.5" />
          </svg>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              navigatedRef.current = false;
              setQuery(e.target.value);
            }}
            onFocus={() =>
              !navigatedRef.current &&
              suggestions.length > 0 &&
              setShowSuggestions(true)
            }
            placeholder="Search postcode or address…"
            className="flex-1 text-gray-800 text-sm bg-transparent outline-none placeholder-gray-400"
            autoComplete="off"
          />

          {loading && (
            <svg
              className="w-4 h-4 text-gray-400 animate-spin shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}

          {query && !loading && (
            <button
              type="button"
              onClick={clearQuery}
              className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
              aria-label="Clear search"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>

        {/* Autocomplete suggestions */}
        {showDropdown && (
          <ul className="border-t border-gray-100 divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-start gap-3 transition-colors"
                  onClick={() => handleSelect(s)}
                >
                  <svg
                    className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
                    />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                  <span className="truncate leading-snug">
                    {s.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Hint text — shown only on initial load before any query */}
        {showHintBar && (
          <p className="px-4 pb-3 text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-2">
            Click on a land parcel or building to see planning history,
            statutory constraints and built form context.
          </p>
        )}
      </div>
    </div>
  );
}

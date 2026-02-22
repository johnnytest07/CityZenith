"use client";

import { useState, useEffect } from "react";
import { useMapStore } from "@/stores/mapStore";

const COLOR_STEPS = [
  { color: "#1e6edc", label: "Well below median", sub: "< −30%" },
  { color: "#50a0e6", label: "Below median", sub: "−30% to −10%" },
  { color: "#9b9ba5", label: "Near median", sub: "±10%" },
  { color: "#e69b23", label: "Above median", sub: "+10% to +30%" },
  { color: "#e13c19", label: "Premium", sub: "> +30%" },
];

/**
 * Dismissible legend for the market value hex layer.
 * Re-appears automatically each time the layer is toggled on.
 * Positioned above the layer toggle button (bottom-right).
 */
export function MarketValueLegend() {
  const { marketValueEnabled } = useMapStore();
  const [dismissed, setDismissed] = useState(false);

  // Re-show whenever the layer is turned on
  useEffect(() => {
    if (marketValueEnabled) setDismissed(false);
  }, [marketValueEnabled]);

  if (!marketValueEnabled || dismissed) return null;

  return (
    <div
      style={{ position: "absolute", bottom: 72, right: 16, zIndex: 10 }}
      className="bg-gray-900/92 backdrop-blur border border-gray-700/80 rounded-xl p-3 w-52 text-xs text-gray-300 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-semibold text-white text-[11px] tracking-wide">
          Market Value
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none -mr-0.5"
          aria-label="Dismiss legend"
        >
          ×
        </button>
      </div>

      {/* Colour scale */}
      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">
        Colour &amp; height — price vs borough median
      </p>
      <div className="space-y-1.5 mb-3">
        {COLOR_STEPS.map(({ color, label, sub }) => (
          <div key={color} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: color }}
            />
            <div className="leading-tight">
              <span className="text-[10px] text-gray-200">{label}</span>
              <span className="text-[9px] text-gray-500 ml-1">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Height explanation */}
      <div className="border-t border-gray-700/60 pt-2.5 mb-2">
        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">
          Height
        </p>
        <div className="flex items-end gap-1.5">
          <div className="w-4 rounded-sm bg-gray-400" style={{ height: 28 }} />
          <div className="w-4 rounded-sm bg-gray-500" style={{ height: 18 }} />
          <div className="w-4 rounded-sm bg-gray-600" style={{ height: 8 }} />
          <span className="text-[10px] text-gray-400 ml-1 leading-tight">
            Tall = above
            <br />
            median price
          </span>
        </div>
      </div>

      <p className="text-[9px] text-gray-600 mt-1.5 leading-tight">
        250 m hex cells · hover for details
      </p>
    </div>
  );
}

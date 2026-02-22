"use client";

import { useState, useRef } from "react";

interface FloatingWidgetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function FloatingWidget({
  title,
  onClose,
  children,
  defaultExpanded = true,
  className = "",
}: FloatingWidgetProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{
    mouseX: number;
    mouseY: number;
    elemX: number;
    elemY: number;
  } | null>(null);
  const didDrag = useRef(false);

  function handleHeaderMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();

    const rect = containerRef.current!.getBoundingClientRect();
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: rect.left,
      elemY: rect.top,
    };
    didDrag.current = false;

    function onMouseMove(e: MouseEvent) {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setDragPos({ x: dragStart.current.elemX + dx, y: dragStart.current.elemY + dy });
    }

    function onMouseUp() {
      dragStart.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function handleHeaderClick() {
    if (!didDrag.current) setExpanded((v) => !v);
  }

  return (
    <div
      ref={containerRef}
      style={
        dragPos
          ? { left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto" }
          : undefined
      }
      className={`absolute overflow-hidden backdrop-blur-sm bg-gray-950/90 border border-gray-800 rounded-2xl shadow-2xl flex flex-col ${className}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleHeaderMouseDown}
        onClick={handleHeaderClick}
      >
        <span className="text-sm font-semibold text-gray-100 tracking-wide">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {/* Chevron */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`text-gray-400 transition-transform duration-200 ${
              expanded ? "rotate-180" : "rotate-0"
            }`}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* Close */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-200 transition-colors p-0.5 rounded"
            aria-label="Close widget"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="max-h-[78vh] overflow-y-auto border-t border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
}

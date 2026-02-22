import React from 'react'

/**
 * Renders **bold** markdown from LLM text as <strong> elements.
 * Returns an array of React nodes suitable for inline rendering inside any element.
 *
 * Usage: <p>{renderBold(text)}</p>
 */
export function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*/)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-white">{part}</strong>
      : part,
  )
}

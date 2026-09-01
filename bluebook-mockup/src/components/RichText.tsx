import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { ReactNode } from 'react'

/**
 * Renders exam content text with light markup:
 *   \(...\)  → inline LaTeX (KaTeX) — generated bank questions carry real math
 *   [[...]]  → underlined span (used for "underlined portion" questions)
 *   *...*    → italic (used for math variables, book titles, etc.)
 */

function renderSegments(text: string, keyPrefix: string): ReactNode[] {
  // Math first so \( x * y \) never gets italic-mangled.
  const mathParts = text.split(/\\\((.+?)\\\)/g)
  return mathParts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={`${keyPrefix}-m${i}`} dangerouslySetInnerHTML={{ __html: safeKatex(part) }} />
    ) : (
      <span key={`${keyPrefix}-t${i}`}>{renderMarkup(part, `${keyPrefix}-t${i}`)}</span>
    ),
  )
}

function safeKatex(tex: string): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, output: 'html' })
  } catch {
    return tex
  }
}

function renderMarkup(text: string, keyPrefix: string): ReactNode[] {
  const underlineParts = text.split(/\[\[(.+?)\]\]/g)
  return underlineParts.map((part, i) => {
    const inner = renderItalics(part, `${keyPrefix}-u${i}`)
    return i % 2 === 1 ? (
      <span key={`${keyPrefix}-u${i}`} className="underline underline-offset-2">
        {inner}
      </span>
    ) : (
      <span key={`${keyPrefix}-u${i}`}>{inner}</span>
    )
  })
}

function renderItalics(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/\*(.+?)\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <em key={`${keyPrefix}-i${i}`}>{part}</em> : <span key={`${keyPrefix}-i${i}`}>{part}</span>,
  )
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{renderSegments(text, 'r')}</span>
}

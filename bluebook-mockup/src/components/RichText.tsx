/**
 * Renders exam content text with light markup:
 *   [[...]] → underlined span (used for "underlined portion" questions)
 *   *...*   → italic (used for math variables, book titles, etc.)
 */
export default function RichText({ text, className }: { text: string; className?: string }) {
  const underlineParts = text.split(/\[\[(.+?)\]\]/g)
  return (
    <span className={className}>
      {underlineParts.map((part, i) => {
        const inner = renderItalics(part, i)
        return i % 2 === 1 ? (
          <span key={i} className="underline underline-offset-2">
            {inner}
          </span>
        ) : (
          <span key={i}>{inner}</span>
        )
      })}
    </span>
  )
}

function renderItalics(text: string, keyPrefix: number) {
  const parts = text.split(/\*(.+?)\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <em key={`${keyPrefix}-${i}`}>{part}</em> : <span key={`${keyPrefix}-${i}`}>{part}</span>,
  )
}

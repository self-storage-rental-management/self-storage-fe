import type { ReactNode } from 'react'

/** Small, text-only Markdown subset. HTML, links and images are never interpreted. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-semibold text-stone-900">{part.slice(2, -2)}</strong>
      : part)
}

export default function SupportReplyText({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n')
  const blocks: ReactNode[] = []
  for (let index = 0; index < lines.length;) {
    if (!lines[index].trim()) { index++; continue }
    const ordered = /^\s*\d+[.)]\s+/.test(lines[index])
    const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/
    if (marker.test(lines[index])) {
      const items: ReactNode[] = []
      while (index < lines.length && marker.test(lines[index])) {
        items.push(<li key={index} className="pl-0.5">{inline(lines[index].replace(marker, ''))}</li>)
        index++
      }
      const className = 'space-y-1 pl-5 marker:text-stone-500'
      blocks.push(ordered
        ? <ol key={index} className={`list-decimal ${className}`}>{items}</ol>
        : <ul key={index} className={`list-disc ${className}`}>{items}</ul>)
    } else {
      const paragraph: string[] = []
      while (index < lines.length && lines[index].trim()
        && !/^\s*(?:\d+[.)]|[-*•])\s+/.test(lines[index])) {
        paragraph.push(lines[index++].replace(/^#{1,6}\s+/, ''))
      }
      blocks.push(<p key={index} className="whitespace-pre-line">{inline(paragraph.join('\n'))}</p>)
    }
  }
  return <div className="space-y-2.5">{blocks}</div>
}

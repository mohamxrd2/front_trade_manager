import * as React from 'react'

import { splitForHighlight } from '@/lib/transactions/search-query'

interface HighlightProps {
  text: string
  query: string
  className?: string
}

/**
 * Surligne (fond #EEEAFE) les mots de `query` trouvés dans `text` —
 * résultats de la barre de recherche du Portefeuille. `query` vide : rend
 * le texte tel quel, sans travail inutile.
 */
function Highlight({ text, query, className }: HighlightProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>
  }

  const segments = splitForHighlight(text, query)

  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.matched ? (
          <mark key={i} className="rounded bg-[#EEEAFE] text-inherit">
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        )
      )}
    </span>
  )
}

export { Highlight }
export type { HighlightProps }

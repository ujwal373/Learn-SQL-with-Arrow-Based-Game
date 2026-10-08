import type { QueryResult } from '../sql/check.ts'

// Shows the rows a query returned. Long results are cut so the dialog stays small.
const MAX_SHOWN = 6

interface Props {
  title: string
  result: QueryResult
}

function show(value: unknown): string {
  if (value === null) return 'NULL'
  if (value instanceof Uint8Array) return '(blob)'
  return String(value)
}

export default function ResultTable({ title, result }: Props) {
  const shown = result.rows.slice(0, MAX_SHOWN)
  const hidden = result.rows.length - shown.length

  return (
    <figure className="result">
      <figcaption>
        {title} <span className="result__count">{result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'}</span>
      </figcaption>
      <div className="result__scroll">
        <table>
          <thead>
            <tr>
              {result.columns.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className={cell === null ? 'result__null' : undefined}>
                    {show(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={Math.max(1, result.columns.length)} className="result__null">
                  No rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hidden > 0 && <p className="result__more">and {hidden} more {hidden === 1 ? 'row' : 'rows'}</p>}
    </figure>
  )
}

import type { UserRole } from '../../shared/types.js'

export function parseCsvLines(content: string): {
  headers: string[]
  dataRows: Array<{ lineNumber: number; values: string[] }>
} {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const allLines = normalized.split('\n')
  if (allLines.length === 0) {
    return { headers: [], dataRows: [] }
  }

  const headers = allLines[0]
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h.length > 0)

  const dataRows: Array<{ lineNumber: number; values: string[] }> = []
  for (let i = 1; i < allLines.length; i++) {
    const rawLine = allLines[i]
    if (!rawLine || rawLine.trim().length === 0) continue
    const values = rawLine.split(',').map((v) => {
      let t = v.trim()
      if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1)
      return t
    })
    dataRows.push({ lineNumber: i + 1, values })
  }

  return { headers, dataRows }
}

export function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

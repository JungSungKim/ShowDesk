import type { BOMRow, BOMNode, BOMParseResult } from './types'

// ── CSV 파싱 ──────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

function parseCSV(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\ufeff/, '') // UTF-8 BOM 제거
  const lines = cleaned.split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCSVRow(lines[0])
  const records: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVRow(line)
    const record: Record<string, string> = {}
    headers.forEach((h, idx) => { record[h] = values[idx] ?? '' })
    records.push(record)
  }
  return records
}

// ── 컬럼명 정규화 ─────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_\-\.]+/g, '')
}

const ALIASES: Record<keyof Omit<BOMRow, 'raw'>, string[]> = {
  partNumber:       ['partnumber', 'partno', 'part', 'id', 'itemno', 'itemnumber', 'number', 'pn'],
  partName:         ['partname', 'name', 'itemname', 'title', 'description', 'desc'],
  quantity:         ['quantity', 'qty', 'count', 'amount', 'ea', 'pcs'],
  material:         ['material', 'mat', 'materialtype'],
  description:      ['note', 'notes', 'remark', 'remarks', 'comment'],
  parentPartNumber: ['parent', 'parentpart', 'parentno', 'parentid', 'assemblyno', 'assembly', 'parentpartnumber']
}

function resolveColumns(headers: string[]): Map<string, keyof Omit<BOMRow, 'raw'>> {
  const map = new Map<string, keyof Omit<BOMRow, 'raw'>>()
  for (const header of headers) {
    const n = norm(header)
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(n) && !map.has(header)) {
        map.set(header, field as keyof Omit<BOMRow, 'raw'>)
        break
      }
    }
  }
  return map
}

// ── 트리 구성 ─────────────────────────────────────────────────

function buildTree(rows: BOMRow[], loadedPartNumbers: Set<string>): BOMNode[] {
  const nodeMap = new Map<string, BOMNode>()

  for (const row of rows) {
    nodeMap.set(row.partNumber, {
      ...row,
      children: [],
      mapped: loadedPartNumbers.has(row.partNumber),
      depth: 0
    })
  }

  const roots: BOMNode[] = []

  for (const row of rows) {
    const node = nodeMap.get(row.partNumber)!
    if (row.parentPartNumber && nodeMap.has(row.parentPartNumber)) {
      nodeMap.get(row.parentPartNumber)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function assignDepth(node: BOMNode, depth: number): void {
    node.depth = depth
    node.children.forEach((c) => assignDepth(c, depth + 1))
  }
  roots.forEach((r) => assignDepth(r, 0))

  return roots
}

// ── 공개 API ─────────────────────────────────────────────────

export function parseBOM(
  text: string,
  loadedPartNumbers: Set<string> = new Set()
): BOMParseResult {
  const records = parseCSV(text)
  const warnings: string[] = []

  if (records.length === 0) {
    return { rows: [], tree: [], warnings: ['BOM 파일이 비어 있거나 형식이 올바르지 않습니다.'] }
  }

  const headers = Object.keys(records[0])
  const colMap = resolveColumns(headers)

  if (!Array.from(colMap.values()).includes('partNumber')) {
    warnings.push('part_number 컬럼을 찾을 수 없습니다. 첫 번째 컬럼을 part_number로 사용합니다.')
    colMap.set(headers[0], 'partNumber')
  }
  if (!Array.from(colMap.values()).includes('partName')) {
    warnings.push('part_name 컬럼을 찾을 수 없습니다. part_number를 이름으로 대체합니다.')
  }

  const rows: BOMRow[] = records
    .map((rec) => {
      const get = (field: keyof Omit<BOMRow, 'raw'>): string => {
        for (const [header, f] of colMap.entries()) {
          if (f === field) return rec[header] ?? ''
        }
        return ''
      }

      const partNumber = get('partNumber').trim()
      if (!partNumber) return null

      return {
        partNumber,
        partName:         get('partName').trim() || partNumber,
        quantity:         parseInt(get('quantity') || '1', 10) || 1,
        material:         get('material').trim(),
        description:      get('description').trim(),
        parentPartNumber: get('parentPartNumber').trim() || null,
        raw:              rec
      } satisfies BOMRow
    })
    .filter((r): r is BOMRow => r !== null)

  const tree = buildTree(rows, loadedPartNumbers)
  return { rows, tree, warnings }
}

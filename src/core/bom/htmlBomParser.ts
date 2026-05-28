import type { BOMRow, BOMNode, BOMParseResult } from './types'

interface HtmlTableRow {
  qty: number
  partNumber: string
  type: string
  nomenclature: string
}

interface HtmlBomTable {
  assemblyName: string
  rows: HtmlTableRow[]
}

const BOM_PREFIX = 'Bill of Material: '

function extractTables(html: string): HtmlBomTable[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const tables: HtmlBomTable[] = []
  const anchors = Array.from(doc.querySelectorAll('a[name]'))

  for (const anchor of anchors) {
    const name = anchor.getAttribute('name') ?? ''
    if (!name.startsWith(BOM_PREFIX)) continue

    const assemblyName = name.slice(BOM_PREFIX.length).trim()

    // Find next TABLE element (may be sibling or nested)
    let el: Element | null = anchor
    while (el && el.tagName !== 'TABLE') {
      el = el.nextElementSibling ?? el.parentElement?.nextElementSibling ?? null
    }
    if (!el) continue

    const rows: HtmlTableRow[] = []
    const trs = el.querySelectorAll('tr')

    for (const tr of trs) {
      const tds = tr.querySelectorAll('td')
      if (tds.length < 3) continue

      const qty = parseInt(tds[0].textContent?.trim() ?? '1', 10) || 1
      const partNumber = tds[1].textContent?.trim() ?? ''
      const type = tds[2].textContent?.trim() ?? ''
      const nomenclature = tds[3]?.textContent?.trim() ?? ''

      if (!partNumber) continue
      rows.push({ qty, partNumber, type, nomenclature })
    }

    if (rows.length > 0) {
      tables.push({ assemblyName, rows })
    }
  }

  return tables
}

function buildNodes(
  assemblyName: string,
  tableMap: Map<string, HtmlBomTable>,
  ancestorPath: ReadonlySet<string>,
  depth: number
): BOMNode[] {
  const table = tableMap.get(assemblyName)
  if (!table) return []

  return table.rows.map((row): BOMNode => {
    let children: BOMNode[] = []

    if (row.type === 'Assembly' && !ancestorPath.has(row.partNumber)) {
      const newPath = new Set(ancestorPath)
      newPath.add(assemblyName)
      children = buildNodes(row.partNumber, tableMap, newPath, depth + 1)
    }

    return {
      partNumber: row.partNumber,
      partName: row.nomenclature || row.partNumber,
      quantity: row.qty,
      material: '',
      description: row.type === 'Assembly' ? 'Assembly' : 'Part',
      parentPartNumber: assemblyName,
      raw: {
        'Part Number': row.partNumber,
        'Nomenclature': row.nomenclature,
        'Type': row.type,
        'Quantity': String(row.qty),
      },
      children,
      mapped: false,
      depth,
    }
  })
}

function flattenNodes(nodes: BOMNode[]): BOMRow[] {
  const result: BOMRow[] = []
  for (const node of nodes) {
    const { children, mapped, depth, ...row } = node
    result.push(row)
    result.push(...flattenNodes(children))
  }
  return result
}

export function parseHtmlBOM(html: string): BOMParseResult {
  const tables = extractTables(html)
  const warnings: string[] = []

  if (tables.length === 0) {
    return { rows: [], tree: [], warnings: ['HTML에서 BOM 테이블을 찾을 수 없습니다.'] }
  }

  const tableMap = new Map(tables.map((t) => [t.assemblyName, t]))
  const root = tables[0]

  const tree = buildNodes(root.assemblyName, tableMap, new Set([root.assemblyName]), 0)

  if (tree.length === 0) {
    warnings.push('루트 어셈블리에 파트가 없습니다.')
  }

  const rows = flattenNodes(tree)
  return { rows, tree, warnings }
}

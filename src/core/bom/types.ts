export interface BOMRow {
  partNumber: string
  partName: string
  quantity: number
  material: string
  description: string
  parentPartNumber: string | null
  /** 원본 CSV의 모든 컬럼 (커스텀 필드 포함) */
  raw: Record<string, string>
}

export interface BOMNode extends BOMRow {
  children: BOMNode[]
  /** STL 오브젝트와 매핑됐는지 여부 */
  mapped: boolean
  depth: number
}

export interface BOMParseResult {
  rows: BOMRow[]
  tree: BOMNode[]
  warnings: string[]
}

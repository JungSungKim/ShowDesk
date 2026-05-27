import React from 'react'
import type { BOMNode } from '@core/bom/types'

interface PartInfoPanelProps {
  tree: BOMNode[]
  selectedPartNumber: string | null
  isAssigned: boolean
}

function findNode(nodes: BOMNode[], partNumber: string): BOMNode | null {
  for (const n of nodes) {
    if (n.partNumber === partNumber) return n
    const found = findNode(n.children, partNumber)
    if (found) return found
  }
  return null
}

const KNOWN_FIELDS = new Set(['part_number', 'part_name', 'partNumber', 'partName', 'quantity', 'qty', 'material', 'description', 'desc', 'parent_part', 'parentPart'])

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}

function PartInfoPanel({ tree, selectedPartNumber, isAssigned }: PartInfoPanelProps): React.JSX.Element {
  const node = selectedPartNumber ? findNode(tree, selectedPartNumber) : null

  if (!node) {
    return (
      <aside className="info-panel">
        <div className="info-panel-header">Part Info</div>
        <div className="info-panel-empty">
          <p>Select a part to view details</p>
        </div>
      </aside>
    )
  }

  // raw에서 알려진 필드 제외한 커스텀 컬럼만 추출
  const customRows = Object.entries(node.raw).filter(
    ([k]) => !KNOWN_FIELDS.has(k) && !KNOWN_FIELDS.has(k.toLowerCase().replace(/[\s_]/g, ''))
  )

  return (
    <aside className="info-panel">
      <div className="info-panel-header">
        <span>Part Info</span>
        <span className={`info-status ${isAssigned ? 'linked' : 'unlinked'}`}>
          {isAssigned ? '● Linked' : '○ No STL'}
        </span>
      </div>

      <div className="info-panel-body">
        <Row label="Part No." value={node.partNumber} />
        <Row label="Name"     value={node.partName} />
        <Row label="Quantity" value={String(node.quantity)} />
        {node.material    && <Row label="Material"    value={node.material} />}
        {node.description && <Row label="Description" value={node.description} />}

        {customRows.length > 0 && (
          <>
            <div className="info-divider" />
            {customRows.map(([k, v]) => v ? <Row key={k} label={k} value={v} /> : null)}
          </>
        )}

        {node.children.length > 0 && (
          <>
            <div className="info-divider" />
            <Row label="Sub-parts" value={String(node.children.length)} />
          </>
        )}
      </div>
    </aside>
  )
}

export default PartInfoPanel

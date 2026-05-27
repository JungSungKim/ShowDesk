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

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.JSX.Element {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${accent ? ' accent' : ''}`}>{value}</span>
    </div>
  )
}

function PartInfoPanel({ tree, selectedPartNumber, isAssigned }: PartInfoPanelProps): React.JSX.Element {
  const node = selectedPartNumber ? findNode(tree, selectedPartNumber) : null

  if (!node) {
    return (
      <aside className="hud-panel hud-right hud-status">
        <div className="status-idle">
          <div className="status-idle-icon">◈</div>
          <div className="status-idle-text">파트를 선택하세요</div>
        </div>
      </aside>
    )
  }

  const customRows = Object.entries(node.raw).filter(
    ([k]) => !KNOWN_FIELDS.has(k) && !KNOWN_FIELDS.has(k.toLowerCase().replace(/[\s_]/g, ''))
  )

  return (
    <aside className="hud-panel hud-right hud-status">
      {/* 상단 배지 바 */}
      <div className={`status-badge-bar ${isAssigned ? 'linked' : 'unlinked'}`}>
        <span className="status-badge-dot">{isAssigned ? '●' : '○'}</span>
        <span className="status-badge-text">{isAssigned ? 'STL Linked' : 'No STL'}</span>
        {node.children.length > 0 && (
          <span className="status-badge-sub">{node.children.length} sub-parts</span>
        )}
      </div>

      {/* 파트 번호 + 이름 헤더 */}
      <div className="status-header">
        <div className="status-part-number">{node.partNumber}</div>
        <div className="status-part-name">{node.partName}</div>
      </div>

      {/* 스탯 그리드 */}
      <div className="status-body">
        <StatRow label="QTY" value={String(node.quantity)} accent />
        {node.material    && <StatRow label="MATERIAL"    value={node.material} />}
        {node.description && <StatRow label="DESCRIPTION" value={node.description} />}

        {customRows.length > 0 && (
          <>
            <div className="status-divider" />
            {customRows.map(([k, v]) => v
              ? <StatRow key={k} label={k.toUpperCase()} value={v} />
              : null
            )}
          </>
        )}
      </div>
    </aside>
  )
}

export default PartInfoPanel

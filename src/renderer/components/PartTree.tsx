import React, { useState } from 'react'
import type { BOMNode } from '@core/bom/types'

interface PartTreeProps {
  tree: BOMNode[]
  assignedPartNumbers: Set<string>
  selectedPartNumber: string | null
  onSelect: (partNumber: string) => void
  onAssign: (partNumber: string) => void
}

function PartTreeNode({
  node,
  assignedPartNumbers,
  selectedPartNumber,
  onSelect,
  onAssign
}: {
  node: BOMNode
  assignedPartNumbers: Set<string>
  selectedPartNumber: string | null
  onSelect: (partNumber: string) => void
  onAssign: (partNumber: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = node.partNumber === selectedPartNumber
  const isMapped = assignedPartNumbers.has(node.partNumber)

  return (
    <li className="tree-item">
      <div
        className={`tree-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => onSelect(node.partNumber)}
      >
        <span
          className={`tree-toggle ${hasChildren ? '' : 'invisible'}`}
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
        >
          {expanded ? '▾' : '▸'}
        </span>

        <span
          className={`tree-dot ${isMapped ? 'mapped' : 'unmapped'}`}
          title={isMapped ? 'STL 연결됨' : 'STL 미연결'}
        />

        <span className="tree-name" title={`${node.partNumber} — ${node.partName}`}>
          {node.partName}
        </span>

        {node.quantity > 1 && (
          <span className="tree-qty">×{node.quantity}</span>
        )}

        <button
          className={`tree-assign-btn ${isMapped ? 'reassign' : ''}`}
          title={isMapped ? 'STL 재지정' : 'STL 지정'}
          onClick={(e) => { e.stopPropagation(); onAssign(node.partNumber) }}
        >
          {isMapped ? '⟳' : '+'}
        </button>
      </div>

      {hasChildren && expanded && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <PartTreeNode
              key={child.partNumber}
              node={child}
              assignedPartNumbers={assignedPartNumbers}
              selectedPartNumber={selectedPartNumber}
              onSelect={onSelect}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function PartTree({ tree, assignedPartNumbers, selectedPartNumber, onSelect, onAssign }: PartTreeProps): React.JSX.Element {
  if (tree.length === 0) {
    return (
      <div className="tree-empty">
        <p>BOM 파일을 불러오면<br />파트 트리가 표시됩니다</p>
      </div>
    )
  }

  const total = countNodes(tree)
  const assigned = countAssigned(tree, assignedPartNumbers)

  return (
    <>
      <div className="tree-progress">
        <div className="tree-progress-bar" style={{ width: `${(assigned / total) * 100}%` }} />
        <span className="tree-progress-label">{assigned} / {total} 연결됨</span>
      </div>
      <ul className="tree-root">
        {tree.map((node) => (
          <PartTreeNode
            key={node.partNumber}
            node={node}
            assignedPartNumbers={assignedPartNumbers}
            selectedPartNumber={selectedPartNumber}
            onSelect={onSelect}
            onAssign={onAssign}
          />
        ))}
      </ul>
    </>
  )
}

function countNodes(nodes: BOMNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0)
}

function countAssigned(nodes: BOMNode[], assigned: Set<string>): number {
  return nodes.reduce(
    (sum, n) => sum + (assigned.has(n.partNumber) ? 1 : 0) + countAssigned(n.children, assigned),
    0
  )
}

export default PartTree

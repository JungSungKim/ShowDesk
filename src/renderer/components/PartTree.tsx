import React, { useState, useMemo } from 'react'
import type { BOMNode } from '@core/bom/types'

interface PartTreeProps {
  tree: BOMNode[]
  assignedPartNumbers: Set<string>
  selectedPartNumber: string | null
  onSelect: (partNumber: string) => void
  onAssign: (partNumber: string) => void
}

function nodeMatches(node: BOMNode, q: string): boolean {
  return (
    node.partNumber.toLowerCase().includes(q) ||
    node.partName.toLowerCase().includes(q)
  )
}

function filterTree(nodes: BOMNode[], q: string): BOMNode[] {
  return nodes.flatMap((node) => {
    if (nodeMatches(node, q)) return [node]
    const filteredChildren = filterTree(node.children, q)
    if (filteredChildren.length > 0) return [{ ...node, children: filteredChildren }]
    return []
  })
}

function PartTreeNode({
  node,
  assignedPartNumbers,
  selectedPartNumber,
  onSelect,
  onAssign,
  forceExpanded,
  query,
}: {
  node: BOMNode
  assignedPartNumbers: Set<string>
  selectedPartNumber: string | null
  onSelect: (partNumber: string) => void
  onAssign: (partNumber: string) => void
  forceExpanded: boolean
  query: string
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const isOpen = forceExpanded || expanded
  const hasChildren = node.children.length > 0
  const isSelected = node.partNumber === selectedPartNumber
  const isMapped = assignedPartNumbers.has(node.partNumber)

  const highlightText = (text: string): React.JSX.Element => {
    if (!query) return <>{text}</>
    const idx = text.toLowerCase().indexOf(query)
    if (idx === -1) return <>{text}</>
    return (
      <>
        {text.slice(0, idx)}
        <mark className="tree-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

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
          {isOpen ? '▾' : '▸'}
        </span>

        <span
          className={`tree-dot ${isMapped ? 'mapped' : 'unmapped'}`}
          title={isMapped ? 'STL 연결됨' : 'STL 미연결'}
        />

        <span className="tree-name" title={`${node.partNumber} — ${node.partName}`}>
          {highlightText(node.partName)}
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

      {hasChildren && isOpen && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <PartTreeNode
              key={child.partNumber}
              node={child}
              assignedPartNumbers={assignedPartNumbers}
              selectedPartNumber={selectedPartNumber}
              onSelect={onSelect}
              onAssign={onAssign}
              forceExpanded={forceExpanded}
              query={query}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function PartTree({ tree, assignedPartNumbers, selectedPartNumber, onSelect, onAssign }: PartTreeProps): React.JSX.Element {
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim().toLowerCase()
  const displayTree = useMemo(
    () => trimmedQuery ? filterTree(tree, trimmedQuery) : tree,
    [tree, trimmedQuery]
  )

  if (tree.length === 0) {
    return (
      <div className="tree-empty">
        <p>BOM 파일을 불러오면<br />파트 트리가 표시됩니다</p>
      </div>
    )
  }

  const total    = countNodes(tree)
  const assigned = countAssigned(tree, assignedPartNumbers)

  return (
    <>
      <div className="tree-search">
        <input
          className="tree-search-input"
          type="text"
          placeholder="파트 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        {query && (
          <button className="tree-search-clear" onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      <div className="tree-progress">
        <div className="tree-progress-bar" style={{ width: `${(assigned / total) * 100}%` }} />
        <span className="tree-progress-label">{assigned} / {total} 연결됨</span>
      </div>

      {displayTree.length === 0 ? (
        <div className="tree-empty">
          <p>'{query}' 검색 결과 없음</p>
        </div>
      ) : (
        <ul className="tree-root">
          {displayTree.map((node) => (
            <PartTreeNode
              key={node.partNumber}
              node={node}
              assignedPartNumbers={assignedPartNumbers}
              selectedPartNumber={selectedPartNumber}
              onSelect={onSelect}
              onAssign={onAssign}
              forceExpanded={!!trimmedQuery}
              query={trimmedQuery}
            />
          ))}
        </ul>
      )}
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

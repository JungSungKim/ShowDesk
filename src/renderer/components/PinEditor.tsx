import React, { useState, useEffect } from 'react'
import type { AnnotationPin } from '@core/bom/project'

interface PinEditorProps {
  pin: AnnotationPin
  onUpdateLabel: (id: string, label: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function PinEditor({ pin, onUpdateLabel, onDelete, onClose }: PinEditorProps): React.JSX.Element {
  const [label, setLabel] = useState(pin.label)

  useEffect(() => {
    setLabel(pin.label)
  }, [pin.id, pin.label])

  const commit = (): void => {
    const trimmed = label.trim() || 'Pin'
    if (trimmed !== pin.label) onUpdateLabel(pin.id, trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); onClose() }
    if (e.key === 'Escape') { setLabel(pin.label); onClose() }
  }

  return (
    <div className="pin-editor">
      <span className="pin-editor-icon">📍</span>
      <input
        className="pin-editor-input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        spellCheck={false}
        placeholder="레이블 입력…"
      />
      <button
        className="pin-editor-btn delete"
        title="핀 삭제"
        onClick={() => { onDelete(pin.id); onClose() }}
      >✕</button>
      <button
        className="pin-editor-btn close"
        title="닫기 (Enter)"
        onClick={onClose}
      >✓</button>
    </div>
  )
}

export default PinEditor

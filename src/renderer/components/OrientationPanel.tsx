import React, { useState, useEffect } from 'react'
import type { Orientation } from '../store/useAppStore'

interface OrientationPanelProps {
  orientation: Orientation
  meshCount: number
  onChange: (o: Orientation) => void
  onClose: () => void
}

const PRESETS: { label: string; title: string; o: Orientation }[] = [
  { label: '기본',       title: '회전 없음 (0°, 0°, 0°)',            o: { x: 0,    y: 0,   z: 0   } },
  { label: 'Z→Y ↑',    title: 'CATIA/SolidWorks Z-up 수정 (X -90°)', o: { x: -90,  y: 0,   z: 0   } },
  { label: 'Z→Y ↓',    title: 'X +90°',                              o: { x:  90,  y: 0,   z: 0   } },
  { label: '↺ Y 90°',  title: 'Y축 +90° 회전',                       o: { x: 0,    y: 90,  z: 0   } },
  { label: '↺ Y -90°', title: 'Y축 -90° 회전',                       o: { x: 0,    y: -90, z: 0   } },
  { label: '뒤집기',    title: 'X 180° (상하 반전)',                  o: { x: 180,  y: 0,   z: 0   } },
]

function AxisInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }): React.JSX.Element {
  const [raw, setRaw] = useState(String(value))

  useEffect(() => { setRaw(String(value)) }, [value])

  return (
    <div className="orient-axis">
      <span className="orient-axis-label">{label}</span>
      <input
        className="orient-axis-input"
        type="number"
        value={raw}
        step={15}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => {
          const n = parseFloat(raw)
          if (!isNaN(n)) onChange(n)
          else setRaw(String(value))
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const n = parseFloat(raw)
            if (!isNaN(n)) onChange(n)
            else setRaw(String(value))
          }
        }}
      />
      <span className="orient-axis-unit">°</span>
    </div>
  )
}

function OrientationPanel({ orientation, meshCount, onChange, onClose }: OrientationPanelProps): React.JSX.Element {
  return (
    <div className="orient-panel">
      <div className="orient-header">
        <span className="orient-title">방향 수정</span>
        {meshCount > 0 && (
          <span className="orient-count">{meshCount}개 파트에 적용</span>
        )}
        <button className="orient-close" onClick={onClose}>✕</button>
      </div>

      <div className="orient-presets">
        {PRESETS.map(p => (
          <button
            key={p.label}
            className={`orient-preset${
              orientation.x === p.o.x && orientation.y === p.o.y && orientation.z === p.o.z ? ' active' : ''
            }`}
            title={p.title}
            onClick={() => onChange(p.o)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="orient-custom">
        <AxisInput label="X" value={orientation.x} onChange={v => onChange({ ...orientation, x: v })} />
        <AxisInput label="Y" value={orientation.y} onChange={v => onChange({ ...orientation, y: v })} />
        <AxisInput label="Z" value={orientation.z} onChange={v => onChange({ ...orientation, z: v })} />
      </div>

      <p className="orient-hint">모든 로드된 파트에 동시 적용됩니다.</p>
    </div>
  )
}

export default OrientationPanel

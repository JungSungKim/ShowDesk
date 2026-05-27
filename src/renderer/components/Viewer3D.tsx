import React, { useEffect, useRef, useState } from 'react'
import { SceneManager } from '@core/renderer/sceneManager'
import type { ViewMode } from '@core/renderer/sceneManager'
import { loadSTLFromBuffer } from '@core/loader/stlLoader'
import type { AssignedPart, RenderMode, AnnotationPin } from '../store/useAppStore'

interface Viewer3DProps {
  assignedParts: Record<string, AssignedPart>
  selectedPartNumber: string | null
  renderMode: RenderMode
  centerMesh?: boolean
  onPartClick?: (partNumber: string | null) => void
  // 핀 모드
  pinMode?: boolean
  selectedPinId?: string | null
  pins?: AnnotationPin[]
  onPinAdd?: (pin: AnnotationPin) => void
  onPinClick?: (id: string | null) => void
}

const VIEW_BTNS = [
  { key: 'front', label: 'Front', shortcut: '1' },
  { key: 'side',  label: 'Side',  shortcut: '2' },
  { key: 'top',   label: 'Top',   shortcut: '3' },
] as const

type RotateDir = 'cw' | 'ccw' | 'off'

function Viewer3D({
  assignedParts,
  selectedPartNumber,
  renderMode,
  centerMesh = false,
  onPartClick,
  pinMode = false,
  selectedPinId = null,
  pins = [],
  onPinAdd,
  onPinClick,
}: Viewer3DProps): React.JSX.Element {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const sceneRef      = useRef<SceneManager | null>(null)
  const loadedRef     = useRef<Set<string>>(new Set())
  const pinnedIdsRef  = useRef<Set<string>>(new Set())
  const pointerMoved  = useRef(false)
  const pointerOrigin = useRef({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [rotateDir, setRotateDir] = useState<RotateDir>('off')

  // ── SceneManager 초기화 ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const manager = new SceneManager(canvas, container)
    sceneRef.current = manager
    loadedRef.current = new Set()
    pinnedIdsRef.current = new Set()

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      manager.onResize(width, height)
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      manager.dispose()
      sceneRef.current = null
    }
  }, [])

  // ── assignedParts → SceneManager 동기화 ─────────────────────
  useEffect(() => {
    const manager = sceneRef.current
    if (!manager) return

    const currentKeys = new Set(Object.keys(assignedParts))

    for (const [partNumber, { buffer }] of Object.entries(assignedParts)) {
      if (!loadedRef.current.has(partNumber)) {
        const { mesh } = loadSTLFromBuffer(buffer, partNumber, { center: centerMesh })
        manager.addNamedMesh(partNumber, mesh)
        loadedRef.current.add(partNumber)
      }
    }

    for (const loaded of loadedRef.current) {
      if (!currentKeys.has(loaded)) {
        manager.removeNamedMesh(loaded)
        loadedRef.current.delete(loaded)
      }
    }

    manager.setViewMode(viewMode, selectedPartNumber)
  }, [assignedParts, centerMesh, viewMode, selectedPartNumber])

  // ── 뷰 모드 변경 ───────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.setViewMode(viewMode, selectedPartNumber)
  }, [viewMode, selectedPartNumber])

  // ── 렌더 모드 ──────────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.setRenderMode(renderMode)
  }, [renderMode])

  // ── 핀 동기화 ──────────────────────────────────────────────
  useEffect(() => {
    const manager = sceneRef.current
    if (!manager) return

    const newIds = new Set(pins.map(p => p.id))

    for (const id of pinnedIdsRef.current) {
      if (!newIds.has(id)) {
        manager.removePin(id)
        pinnedIdsRef.current.delete(id)
      }
    }

    for (const pin of pins) {
      if (!pinnedIdsRef.current.has(pin.id)) {
        manager.addPin(pin)
        pinnedIdsRef.current.add(pin.id)
      } else {
        manager.updatePinLabel(pin.id, pin.label)
      }
    }
  }, [pins])

  // ── 선택 핀 하이라이트 ──────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.highlightPin(selectedPinId)
  }, [selectedPinId])

  // ── 키보드 단축키 ──────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const manager = sceneRef.current
      if (!manager) return
      switch (e.key) {
        case 'f': case 'F': manager.fitCamera(); break
        case '1': manager.setView('front'); break
        case '2': manager.setView('side');  break
        case '3': manager.setView('top');   break
        case 'g': case 'G':
          setViewMode(prev => prev === 'ghost' ? 'normal' : 'ghost')
          break
        case 'i': case 'I':
          setViewMode(prev => prev === 'isolate' ? 'normal' : 'isolate')
          break
        case 's': case 'S':
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault()
            ;(async () => {
              const canvas = canvasRef.current
              if (!canvas) return
              const dataUrl = canvas.toDataURL('image/png')
              const base64 = dataUrl.split(',')[1]
              const binary = atob(base64)
              const buf = new ArrayBuffer(binary.length)
              const view = new Uint8Array(buf)
              for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
              const savePath = await window.api.saveFileDialog(
                [{ name: 'PNG Image', extensions: ['png'] }],
                'screenshot.png'
              )
              if (savePath) await window.api.writeFile(savePath, buf)
            })()
          }
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ── 회전 핸들러 ────────────────────────────────────────────
  const handleRotate = (dir: RotateDir): void => {
    setRotateDir(dir)
    sceneRef.current?.setAutoRotate(dir)
  }

  // ── 포인터 이벤트 ──────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent): void => {
    pointerOrigin.current = { x: e.clientX, y: e.clientY }
    pointerMoved.current = false
  }

  const handlePointerMove = (e: React.PointerEvent): void => {
    const dx = e.clientX - pointerOrigin.current.x
    const dy = e.clientY - pointerOrigin.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) pointerMoved.current = true
  }

  const handlePointerUp = (e: React.PointerEvent): void => {
    if (pointerMoved.current) return
    const manager = sceneRef.current

    if (pinMode) {
      // 기존 핀 클릭 확인
      const pinId = manager?.raycastPin(e.clientX, e.clientY) ?? null
      if (pinId) {
        onPinClick?.(pinId)
        return
      }
      // 메시 표면에 새 핀 배치
      const hit = manager?.raycastWithPoint(e.clientX, e.clientY) ?? null
      if (hit && onPinAdd) {
        onPinAdd({
          id: crypto.randomUUID(),
          position: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          label: 'Pin',
          partNumber: hit.name
        })
      } else {
        // 빈 공간 클릭 → 핀 선택 해제
        onPinClick?.(null)
      }
      return
    }

    if (!onPartClick) return
    const name = manager?.raycast(e.clientX, e.clientY) ?? null
    onPartClick(name)
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%', height: '100%', display: 'block', outline: 'none',
          cursor: pinMode ? 'crosshair' : 'default'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* 뷰 모드 배지 */}
      {viewMode !== 'normal' && (
        <div className={`view-mode-badge ${viewMode}`}>
          {viewMode === 'ghost' ? '◈ GHOST  G' : '◉ ISOLATE  I'}
        </div>
      )}

      {/* 핀 모드 배지 */}
      {pinMode && (
        <div className="view-mode-badge pin-mode">
          📍 PIN MODE
        </div>
      )}

      {/* ViewCube 오버레이 */}
      <div className="view-controls">
        {VIEW_BTNS.map(({ key, label, shortcut }) => (
          <button
            key={key}
            className="btn-view"
            title={`${label} view (${shortcut})`}
            onClick={() => sceneRef.current?.setView(key)}
          >
            {label}
          </button>
        ))}
        <button
          className="btn-view fit"
          title="Fit view (F)"
          onClick={() => sceneRef.current?.fitCamera()}
        >
          Fit
        </button>

        {/* 회전 버튼 */}
        <div className="rotate-controls">
          <button
            className={`btn-rotate ${rotateDir === 'ccw' ? 'active' : ''}`}
            title="시계 반대 방향 회전"
            onClick={() => handleRotate(rotateDir === 'ccw' ? 'off' : 'ccw')}
          >↺</button>
          <button
            className={`btn-rotate stop ${rotateDir !== 'off' ? '' : 'active'}`}
            title="회전 정지"
            onClick={() => handleRotate('off')}
          >◼</button>
          <button
            className={`btn-rotate ${rotateDir === 'cw' ? 'active' : ''}`}
            title="시계 방향 회전"
            onClick={() => handleRotate(rotateDir === 'cw' ? 'off' : 'cw')}
          >↻</button>
        </div>
      </div>
    </div>
  )
}

export default Viewer3D

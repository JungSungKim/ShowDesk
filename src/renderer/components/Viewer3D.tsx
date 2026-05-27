import React, { useEffect, useRef, useState } from 'react'
import { SceneManager } from '@core/renderer/sceneManager'
import type { ViewMode } from '@core/renderer/sceneManager'
import { loadSTLFromBuffer } from '@core/loader/stlLoader'
import type { AssignedPart, RenderMode } from '../store/useAppStore'

interface Viewer3DProps {
  assignedParts: Record<string, AssignedPart>
  selectedPartNumber: string | null
  renderMode: RenderMode
  centerMesh?: boolean
  onPartClick?: (partNumber: string | null) => void
}

const VIEW_BTNS = [
  { key: 'front', label: 'Front', shortcut: '1' },
  { key: 'side',  label: 'Side',  shortcut: '2' },
  { key: 'top',   label: 'Top',   shortcut: '3' },
] as const

function Viewer3D({
  assignedParts,
  selectedPartNumber,
  renderMode,
  centerMesh = false,
  onPartClick
}: Viewer3DProps): React.JSX.Element {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const sceneRef      = useRef<SceneManager | null>(null)
  const loadedRef     = useRef<Set<string>>(new Set())
  const pointerMoved  = useRef(false)
  const pointerOrigin = useRef({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState<ViewMode>('normal')

  // ── SceneManager 초기화 ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const manager = new SceneManager(canvas)
    sceneRef.current = manager
    loadedRef.current = new Set()

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

  // ── 뷰 모드 변경 → SceneManager 적용 ──────────────────────────
  useEffect(() => {
    sceneRef.current?.setViewMode(viewMode, selectedPartNumber)
  }, [viewMode, selectedPartNumber])

  // ── 렌더 모드 ──────────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.setRenderMode(renderMode)
  }, [renderMode])

  // ── 키보드 단축키 (F / 1 / 2 / 3 / G / I) ─────────────────
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
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ── 포인터 클릭 → 레이캐스트 ───────────────────────────────
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
    if (pointerMoved.current || !onPartClick) return
    const name = sceneRef.current?.raycast(e.clientX, e.clientY) ?? null
    onPartClick(name)
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
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
      </div>
    </div>
  )
}

export default Viewer3D

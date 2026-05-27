import React, { useEffect, useRef } from 'react'
import { SceneManager } from '@core/renderer/sceneManager'
import { loadSTLFromBuffer } from '@core/loader/stlLoader'
import type { AssignedPart, RenderMode } from '../store/useAppStore'

interface Viewer3DProps {
  assignedParts: Record<string, AssignedPart>
  selectedPartNumber: string | null
  renderMode: RenderMode
}

function Viewer3D({ assignedParts, selectedPartNumber, renderMode }: Viewer3DProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const loadedRef = useRef<Set<string>>(new Set())

  // SceneManager 초기화
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

  // assignedParts 변화 → SceneManager 동기화
  useEffect(() => {
    const manager = sceneRef.current
    if (!manager) return

    const currentKeys = new Set(Object.keys(assignedParts))

    // 추가된 파트
    for (const [partNumber, { buffer }] of Object.entries(assignedParts)) {
      if (!loadedRef.current.has(partNumber)) {
        const { mesh } = loadSTLFromBuffer(buffer, partNumber)
        manager.addNamedMesh(partNumber, mesh)
        loadedRef.current.add(partNumber)
      }
    }

    // 제거된 파트
    for (const loaded of loadedRef.current) {
      if (!currentKeys.has(loaded)) {
        manager.removeNamedMesh(loaded)
        loadedRef.current.delete(loaded)
      }
    }
  }, [assignedParts])

  // 선택 하이라이트
  useEffect(() => {
    sceneRef.current?.highlight(selectedPartNumber)
  }, [selectedPartNumber])

  // 렌더 모드
  useEffect(() => {
    sceneRef.current?.setRenderMode(renderMode)
  }, [renderMode])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />
    </div>
  )
}

export default Viewer3D

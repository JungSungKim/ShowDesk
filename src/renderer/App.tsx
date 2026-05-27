import React, { useMemo, useState } from 'react'
import Viewer3D from './components/Viewer3D'
import PartTree from './components/PartTree'
import PartInfoPanel from './components/PartInfoPanel'
import LandingScreen from './components/LandingScreen'
import { useAppStore } from './store/useAppStore'
import { parseBOM } from '@core/bom/bomParser'
import { serializeProject } from '@core/bom/project'
import './styles/app.css'

const RENDER_MODES = [
  { value: 'shaded',      label: 'Shaded' },
  { value: 'wireframe',   label: 'Wireframe' },
  { value: 'shaded+edge', label: 'Shaded+Edge' }
] as const

function App(): React.JSX.Element {
  const {
    mode, renderMode,
    bomTree, bomWarnings, bomFilePath,
    assignedParts, stlOnlyFileName,
    selectedPartNumber, projectPath, isDirty, isLoading,
    enterBomFirst, enterStlOnly, assignPart, selectPart,
    setRenderMode, setProjectPath, markClean, setLoading, reset
  } = useAppStore()

  const assignedPartNumbers = useMemo(
    () => new Set(Object.keys(assignedParts)),
    [assignedParts]
  )

  // ── 파트 STL 지정 ──────────────────────────────────────────
  const handleAssignPart = async (partNumber: string): Promise<void> => {
    const filePath = await window.api.openFileDialog([{ name: 'STL Files', extensions: ['stl'] }])
    if (!filePath) return
    const buffer = await window.api.readFile(filePath)
    assignPart(partNumber, buffer, filePath)
  }

  // ── 프로젝트 저장 ──────────────────────────────────────────
  const handleSaveProject = async (): Promise<void> => {
    let savePath = projectPath
    if (!savePath) {
      savePath = await window.api.saveFileDialog(
        [{ name: 'ShowDesk Project', extensions: ['showdesk'] }],
        'project.showdesk'
      )
      if (!savePath) return
    }
    const project = {
      version: '1.0' as const,
      bomFilePath: bomFilePath ?? '',
      parts: Object.entries(assignedParts).map(([partNumber, { filePath }]) => ({
        partNumber,
        stlFilePath: filePath
      }))
    }
    await window.api.writeFile(savePath, serializeProject(project))
    setProjectPath(savePath)
    markClean()
  }

  // ── BOM-first: BOM 재로드 ───────────────────────────────────
  const handleReloadBOM = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([{ name: 'BOM Files', extensions: ['csv'] }])
    if (!filePath) return
    setLoading(true)
    try {
      const buf = await window.api.readFile(filePath)
      const text = new TextDecoder().decode(buf)
      const { tree, warnings } = parseBOM(text)
      enterBomFirst(tree, warnings, filePath)
    } finally {
      setLoading(false)
    }
  }

  // ── 자동 매핑 ─────────────────────────────────────────────
  const [autoMapResult, setAutoMapResult] = useState<string | null>(null)

  const handleAutoMap = async (): Promise<void> => {
    const dirPath = await window.api.openDirectoryDialog()
    if (!dirPath) return
    setLoading(true)
    try {
      const entries = await window.api.readDir(dirPath)
      const stlMap = new Map<string, string>()
      for (const e of entries) {
        if (e.name.toLowerCase().endsWith('.stl')) {
          stlMap.set(e.name.replace(/\.stl$/i, '').toLowerCase(), e.fullPath)
        }
      }
      const flatten = (nodes: typeof bomTree): typeof bomTree => nodes.flatMap(n => [n, ...flatten(n.children)])
      let matched = 0
      for (const node of flatten(bomTree)) {
        const fp = stlMap.get(node.partNumber.toLowerCase())
        if (fp) {
          const buf = await window.api.readFile(fp)
          assignPart(node.partNumber, buf, fp)
          matched++
        }
      }
      setAutoMapResult(matched > 0 ? `${matched}개 파트 자동 매핑 완료` : '일치하는 파일 없음')
      setTimeout(() => setAutoMapResult(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  // ── STL-only: 새 파일 열기 ─────────────────────────────────
  const handleReopenSTL = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([{ name: 'STL Files', extensions: ['stl'] }])
    if (!filePath) return
    setLoading(true)
    try {
      const buf = await window.api.readFile(filePath)
      enterStlOnly(buf, filePath)
    } finally {
      setLoading(false)
    }
  }

  // ── 랜딩 화면 ─────────────────────────────────────────────
  if (mode === 'landing') return <LandingScreen />

  // ── 공통 툴바 ──────────────────────────────────────────────
  const toolbar = (
    <header className="toolbar">
      <button className="btn-ghost logo-btn" onClick={reset} title="홈으로">
        ShowDesk
      </button>

      {mode === 'bom-first' && (
        <>
          <button className="btn-secondary" onClick={handleReloadBOM} disabled={isLoading}>
            BOM 교체
          </button>
          <button className="btn-secondary" onClick={handleAutoMap} disabled={isLoading} title="파트번호와 파일명이 일치하는 STL 일괄 지정">
            Auto Map
          </button>
          {autoMapResult && <span className="automatch-toast">{autoMapResult}</span>}
        </>
      )}
      {mode === 'stl-only' && (
        <>
          {stlOnlyFileName && <span className="file-name">{stlOnlyFileName}</span>}
          <button className="btn-secondary" onClick={handleReopenSTL} disabled={isLoading}>
            STL 열기
          </button>
        </>
      )}

      <div className="spacer" />

      <div className="render-modes">
        {RENDER_MODES.map((m) => (
          <button
            key={m.value}
            className={`btn-mode ${renderMode === m.value ? 'active' : ''}`}
            onClick={() => setRenderMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'bom-first' && (
        <button
          className={`btn-save ${isDirty ? 'dirty' : ''}`}
          onClick={handleSaveProject}
          title={isDirty ? '저장되지 않은 변경사항 있음' : '저장됨'}
        >
          {isDirty ? '저장 *' : '저장'}
        </button>
      )}
    </header>
  )

  // ── STL-only 모드 ──────────────────────────────────────────
  if (mode === 'stl-only') {
    return (
      <div className="app-layout">
        {toolbar}
        <main className="viewer-area">
          <Viewer3D
            assignedParts={assignedParts}
            selectedPartNumber={null}
            renderMode={renderMode}
            centerMesh={true}
          />
        </main>
      </div>
    )
  }

  // ── BOM-first 모드 ─────────────────────────────────────────
  return (
    <div className="app-layout">
      {toolbar}
      <div className="viewer-area">

        {/* 3D 뷰어 (베이스 레이어) */}
        {Object.keys(assignedParts).length === 0 && (
          <div className="empty-state">
            <p>Click <strong>+</strong> on a part to assign an STL file</p>
          </div>
        )}
        <Viewer3D
          assignedParts={assignedParts}
          selectedPartNumber={selectedPartNumber}
          renderMode={renderMode}
          onPartClick={selectPart}
        />

        {/* HUD 왼쪽: 파트 트리 */}
        <aside className="hud-panel hud-left">
          <div className="sidebar-header">
            <span>Part Tree</span>
          </div>
          {bomWarnings.length > 0 && (
            <div className="bom-warnings">
              {bomWarnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}
          <div className="sidebar-body">
            <PartTree
              tree={bomTree}
              assignedPartNumbers={assignedPartNumbers}
              selectedPartNumber={selectedPartNumber}
              onSelect={selectPart}
              onAssign={handleAssignPart}
            />
          </div>
        </aside>

        {/* HUD 오른쪽: 파트 정보 */}
        <PartInfoPanel
          tree={bomTree}
          selectedPartNumber={selectedPartNumber}
          isAssigned={selectedPartNumber ? !!assignedParts[selectedPartNumber] : false}
        />

      </div>
    </div>
  )
}

export default App

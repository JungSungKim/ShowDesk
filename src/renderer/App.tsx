import React, { useMemo } from 'react'
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
        <button className="btn-secondary" onClick={handleReloadBOM} disabled={isLoading}>
          BOM 교체
        </button>
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
      <div className="workspace">

        {/* 왼쪽: 파트 트리 */}
        <aside className="sidebar">
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

        {/* 중앙: 3D 뷰어 */}
        <main className="viewer-area">
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
        </main>

        {/* 오른쪽: 파트 정보 패널 */}
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

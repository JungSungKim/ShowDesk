import React from 'react'
import { parseBOMFromFile } from '@core/bom/bomParser'
import { deserializeProject } from '@core/bom/project'
import { useAppStore } from '../store/useAppStore'
import '../styles/landing.css'

function LandingScreen(): React.JSX.Element {
  const { enterBomFirst, enterStlOnly, setLoading } = useAppStore()

  const handleOpenProject = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: 'ShowDesk Project', extensions: ['showdesk'] }
    ])
    if (!filePath) return
    setLoading(true)
    try {
      const buf = await window.api.readFile(filePath)
      const json = new TextDecoder().decode(buf)
      const project = deserializeProject(json)

      // BOM 읽기
      const bomBuf = await window.api.readFile(project.bomFilePath)
      const { tree, warnings } = await parseBOMFromFile(bomBuf, project.bomFilePath)

      enterBomFirst(tree, warnings, project.bomFilePath)

      // 저장된 파트별 STL 순차 로드
      const store = useAppStore.getState()
      for (const { partNumber, stlFilePath } of project.parts) {
        try {
          const { buffer, decimated, originalTriangles } = await window.api.loadSTL(stlFilePath)
          store.assignPart(partNumber, buffer, stlFilePath, decimated, originalTriangles)
        } catch {
          // 파일이 없으면 미매핑 상태로 남김
        }
      }
      store.setPins(project.pins ?? [])
      store.setProjectPath(filePath)
      store.markClean()
    } catch (e) {
      alert(`프로젝트를 열 수 없습니다.\n${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenBOM = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: 'BOM Files', extensions: ['csv', 'xlsx', 'html', 'htm'] }
    ])
    if (!filePath) return
    setLoading(true)
    try {
      const buf = await window.api.readFile(filePath)
      const { tree, warnings } = await parseBOMFromFile(buf, filePath)
      enterBomFirst(tree, warnings, filePath)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenSTL = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: '3D Model Files', extensions: ['stl', 'wrl', 'vrml', 'step', 'stp', 'igs', 'iges'] }
    ])
    if (!filePath) return
    setLoading(true)
    try {
      const { buffer, decimated, originalTriangles } = await window.api.loadSTL(filePath)
      enterStlOnly(buffer, filePath, decimated, originalTriangles)
    } catch (e) {
      alert(`STL 파일을 열 수 없습니다.\n${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      <div className="landing-logo">ShowDesk</div>
      <p className="landing-sub">3D 파트 브라우저 & 쇼잉 툴</p>

      <div className="landing-cards">
        <button className="landing-card" onClick={handleOpenProject}>
          <span className="card-icon">📂</span>
          <span className="card-title">프로젝트 열기</span>
          <span className="card-desc">.showdesk 파일 불러오기</span>
        </button>

        <button className="landing-card primary" onClick={handleOpenBOM}>
          <span className="card-icon">📋</span>
          <span className="card-title">BOM으로 시작</span>
          <span className="card-desc">CSV / Excel / HTML 불러온 후 파트별 STL 지정</span>
        </button>

        <button className="landing-card" onClick={handleOpenSTL}>
          <span className="card-icon">🧊</span>
          <span className="card-title">STL만 열기</span>
          <span className="card-desc">단일 3D 파일 빠른 뷰</span>
        </button>
      </div>
    </div>
  )
}

export default LandingScreen

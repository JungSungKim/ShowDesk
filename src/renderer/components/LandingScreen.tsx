import React from 'react'
import { parseBOM } from '@core/bom/bomParser'
import { xlsxToCsv } from '@core/bom/xlsxLoader'
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
      const bomText = new TextDecoder().decode(bomBuf)
      const { tree, warnings } = parseBOM(bomText)

      enterBomFirst(tree, warnings, project.bomFilePath)

      // 저장된 파트별 STL 순차 로드
      const store = useAppStore.getState()
      for (const { partNumber, stlFilePath } of project.parts) {
        try {
          const stlBuf = await window.api.readFile(stlFilePath)
          store.assignPart(partNumber, stlBuf, stlFilePath)
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
      { name: 'BOM Files', extensions: ['csv', 'xlsx'] }
    ])
    if (!filePath) return
    setLoading(true)
    try {
      const buf = await window.api.readFile(filePath)
      const text = filePath.toLowerCase().endsWith('.xlsx')
        ? xlsxToCsv(buf)
        : new TextDecoder().decode(buf)
      const { tree, warnings } = parseBOM(text)
      enterBomFirst(tree, warnings, filePath)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenSTL = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: 'STL Files', extensions: ['stl'] }
    ])
    if (!filePath) return
    setLoading(true)
    try {
      const buf = await window.api.readFile(filePath)
      enterStlOnly(buf, filePath)
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
          <span className="card-desc">CSV / Excel 불러온 후 파트별 STL 지정</span>
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

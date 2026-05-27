# ShowDesk — DEV_LOG

## 현재 세션 컨텍스트

| 항목 | 내용 |
|------|------|
| 최종 갱신 | 2026-05-27 |
| 브랜치 | master |
| 최신 커밋 | 95417b3 |
| 미커밋 변경 | 있음 (STL 로더 + 뷰어 구현) |

### 완료된 작업
- 프로젝트 폴더 구조, 기획 문서, 메타 문서 세팅
- Git 초기화 및 GitHub 연결
- **Electron + electron-vite + React + Three.js 개발 환경 세팅** (Phase 0 완료)
- **STL 로더 + 기본 3D 뷰어 구현** (Phase 1 진행 중)
  - `src/core/loader/stlLoader.ts` — ASCII/Binary STL 파싱 (Three.js STLLoader 래핑)
  - `src/core/renderer/sceneManager.ts` — Three.js 씬, 카메라, OrbitControls, 조명, 그리드
  - `src/renderer/components/Viewer3D.tsx` — React 캔버스 컴포넌트, ResizeObserver 연동
  - `src/renderer/store/useAppStore.ts` — Zustand 전역 상태 (STL 버퍼, 렌더 모드)
  - `src/renderer/App.tsx` — 툴바 + 뷰어 레이아웃, 파일 열기, 렌더 모드 전환
  - `src/main/index.ts` — IPC 핸들러 (파일 다이얼로그, fs 읽기/쓰기)
  - `npm run dev` / `npm run build` 정상 동작 확인 ✅

  - **BOM CSV 파서 + 파트 트리 UI** 구현
    - `src/core/bom/types.ts` — BOMRow, BOMNode, BOMParseResult 타입
    - `src/core/bom/bomParser.ts` — CSV 파싱, 컬럼 자동 감지, 트리 구성
    - `src/renderer/components/PartTree.tsx` — 계층 트리 UI (매핑 상태 표시)
    - `src/renderer/App.tsx` — 왼쪽 사이드바 레이아웃 + BOM 열기 버튼
    - `assets/samples/bom/sample.csv` — 테스트용 샘플 BOM
    - `npm run build` 정상 동작 확인 ✅

### 다음 추천 작업
1. **BOM-3D 하이라이트 연동** — 파트 트리 클릭 시 해당 메시 하이라이트 (다중 STL 로드 필요)
2. **드래그&드롭 STL 로드** — Viewer3D에 dragover/drop 이벤트 추가
3. **뷰 큐브** — 정면/측면/상면 원클릭 이동

### 알려진 이슈
- 없음

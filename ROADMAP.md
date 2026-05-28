# ShowDesk — ROADMAP

## Phase 0 — 환경 세팅 ✅
- [x] 프로젝트 폴더 구조 생성
- [x] 기획 문서 작성 (PRD, 기능 명세, UX 흐름)
- [x] CLAUDE.md / 커맨드 파일 세팅
- [x] Git 저장소 초기화 및 GitHub 연결
- [x] Electron + Vite + React + Three.js 환경 구성

## Phase 1 — MVP (3D 뷰어 + BOM 연동) ✅

### 핵심 뷰어
- [x] STL 파일 로드 (파일 열기, ASCII + Binary 지원)
- [x] 기본 3D 뷰어 (회전/줌/팬, OrbitControls)
- [x] 렌더링 모드 전환 (Shaded / Wireframe / Shaded+Edge)
- [x] 뷰 큐브 (정면/측면/상면 단축키 1/2/3)
- [x] F키 Fit 뷰
- [x] 스크린샷 저장 (Ctrl+Shift+S → PNG)

### BOM 연동
- [x] BOM CSV 파싱 및 파트 트리 UI
- [x] Excel(.xlsx) BOM 지원 (SheetJS)
- [x] BOM-first 워크플로우 (파트별 STL 수동 지정)
- [x] 파일명 자동 매핑 (Auto Map — 폴더 선택 후 일괄 연결)
- [x] 파트 트리 클릭 → 3D 하이라이트
- [x] 3D 오브젝트 클릭 → 파트 트리 동기화
- [x] 파트 정보 패널 (BOM 데이터 HUD 표시)
- [x] 프로젝트 파일 저장/열기 (.showdesk)

### 시각화 모드
- [x] Ghost 모드 (단축키 G — 비선택 파트 반투명)
- [x] Isolate 모드 (단축키 I — 선택 파트만 표시)
- [x] HUD 오버레이 레이아웃 (파트 트리 · 인포 패널이 3D 뷰 위에 부유)
- [x] 스테이지 조명 (SpotLight 핀 조명 + 그림자, 무대 연출)

## Phase 2 — 핵심 기능 강화 (진행 중)

### 완료
- [x] 파트 트리 검색 필터 (실시간 하이라이트)
- [x] 어노테이션 핀 삽입 및 저장 (CSS2DRenderer 레이블, .showdesk 직렬화)
- [x] 오브젝트 자동 회전 (시계/반시계/정지)
- [x] STEP/IGES CAD 파일 로드 (occt-import-js, CATIA 다중 파트 자동 배치)

### 미완료
- [ ] 수동 BOM-3D 매핑 UI (드래그 또는 우클릭)
- [ ] Exploded View 자동 생성
- [ ] 단면도 슬라이싱

## Phase 3 — 배포 및 협업
- [ ] electron-builder 패키징 (Windows 인스톨러)
- [ ] 자동 업데이트 (electron-updater)
- [ ] 원격 공유 세션 (WebSocket)
- [ ] 버전 비교 모드

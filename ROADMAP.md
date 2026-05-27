# ShowDesk — ROADMAP

## Phase 0 — 환경 세팅 ✅
- [x] 프로젝트 폴더 구조 생성
- [x] 기획 문서 작성 (PRD, 기능 명세, UX 흐름)
- [x] CLAUDE.md / 커맨드 파일 세팅
- [x] Git 저장소 초기화 및 GitHub 연결
- [x] Electron + Vite + React + Three.js 환경 구성

## Phase 1 — MVP (3D 뷰어 + BOM 연동)
- [x] STL 파일 로드 (파일 열기)
- [x] 기본 3D 뷰어 (회전/줌/팬)
- [x] 렌더링 모드 전환 (Shaded / Wireframe / Shaded+Edge)
- [x] BOM CSV 파싱 및 파트 트리 UI
- [x] BOM-first 워크플로우 (파트별 STL 수동 지정)
- [x] 프로젝트 파일 저장/열기 (.showdesk)
- [x] 파트 트리 클릭 → 3D 하이라이트 (기본)
- [ ] 파트 정보 패널 (BOM 데이터 표시)
- [ ] 3D 오브젝트 클릭 → 파트 트리 동기화
- [ ] 파일명 자동 매핑 버튼 (BOM-STL 빠른 연결)
- [ ] 뷰 큐브 (정면/측면/상면 단축키 1/2/3)
- [ ] F키 Fit 뷰
- [ ] Ghost 모드 (단축키 G)
- [ ] Isolate 모드 (단축키 I)
- [ ] 스크린샷 저장 (단축키 Ctrl+Shift+S)

## Phase 2 — 핵심 기능 강화
- [ ] 파트 트리 검색 필터
- [ ] 수동 BOM-3D 매핑 UI (드래그 또는 우클릭)
- [ ] 어노테이션 핀 삽입 및 저장
- [ ] Exploded View 자동 생성
- [ ] 단면도 슬라이싱
- [ ] Excel(.xlsx) BOM 지원

## Phase 3 — 배포 및 협업
- [ ] electron-builder 패키징 (Windows 인스톨러)
- [ ] 자동 업데이트 (electron-updater)
- [ ] 원격 공유 세션 (WebSocket)
- [ ] 버전 비교 모드

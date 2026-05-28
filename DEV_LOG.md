# ShowDesk — DEV_LOG

## 현재 세션 컨텍스트

| 항목 | 내용 |
|------|------|
| 최종 갱신 | 2026-05-28 |
| 브랜치 | master |
| 최신 커밋 | 1eaeb06 |
| 미커밋 변경 | 없음 |

---

## 2026-05-28

### 완료 작업

**STEP/IGES CAD 파일 지원 (`src/main/cadLoader.ts`)**
- `occt-import-js` 기반 STEP/IGES → binary STL 변환 구현
- `opencascade.js` 시도 후 ESM/CJS 혼합 + Emscripten 바인딩 문제로 포기
- WASM 경로 `locateFile` 콜백으로 직접 지정 (런타임 require.resolve 사용)
- 파일 선택 다이얼로그에 `.step/.stp/.igs/.iges` 확장자 추가 (LandingScreen, App.tsx)

**조명 및 스테이지 조정 (`src/core/renderer/sceneManager.ts`)**
- 스팟 조명 앙각 45° → 30° (Z 오프셋 `h` → `h * 1.732`)
- 모델 부유 높이 `maxDim * 0.12` → `maxDim * 0.36` (3배)

**다중 파일 겹침 자동 배치 (`src/core/renderer/sceneManager.ts`)**
- CATIA 독립 part export 시 두 파일이 동일 원점(0,0,0)에 겹쳐 한 파일이 안 보이는 버그
- `SceneManager.addNamedMesh`에서 bounding box 겹침 감지 시 X축 자동 오프셋
- 어셈블리 export(상대 좌표 유지)는 겹침 없으므로 오프셋 미적용

**CLAUDE.md 개선**
- 지원 파일 형식 명시, `cadLoader.ts` 디렉토리 구조 추가
- `stl:load` IPC 채널, STEP/IGES Gotcha 섹션 추가
- `meshesToSTLBuffer` centroid 빼기 금지 규칙 문서화

### 완료된 작업

**Phase 0** ✅
- Electron + electron-vite + React + Three.js 개발 환경 세팅
- IPC 핸들러, contextBridge, 기획 문서 3종, 메타 문서 세팅

**Phase 1** ✅ (전체 완료)
- STL 로더 + 기본 3D 뷰어 (회전/줌/팬, OrbitControls)
- 렌더링 모드 전환 (Shaded / Wireframe / Shaded+Edge)
- 와이어프레임: EdgesGeometry(5°) + CRT 형광 녹색(#39FF14), 후면 엣지 표시
- 스테이지 조명 (SpotLight 핀 조명 + 그림자, 어두운 무대 연출)
- BOM CSV 파싱 + 파트 트리 UI + BOM-first 워크플로우
- Excel(.xlsx) BOM 지원 (SheetJS)
- 파트별 STL 수동 지정 + 프로젝트 저장/열기 (.showdesk)
- Auto Map (폴더 선택 → 파일명 일괄 매핑)
- 파트 트리 클릭 → 3D 하이라이트, 3D 클릭 → 트리 동기화
- 파트 정보 패널 (게임 스테이터스 스타일 HUD)
- Ghost 모드(G) + Isolate 모드(I)
- HUD 오버레이 레이아웃 (파트 트리·인포 패널이 3D 뷰 위에 부유)
- 뷰 큐브(1/2/3), Fit(F), 스크린샷(Ctrl+Shift+S)
- 랜딩 스크린 (프로젝트 열기 / BOM으로 시작 / STL만 열기)

**Phase 2** (진행 중)
- 파트 트리 검색 필터 (실시간 하이라이트) ✅
- 어노테이션 핀 (CSS2DRenderer 레이블, .showdesk 직렬화) ✅
- 오브젝트 자동 회전 (시계/반시계/정지 버튼) ✅
- STEP/IGES CAD 파일 로드 지원 (occt-import-js) ✅

### 다음 추천 작업
1. **Exploded View** — 파트별 방향 벡터로 분해 애니메이션
2. **단면도 슬라이싱** — 평면 클리핑으로 내부 구조 확인
3. **수동 BOM-3D 매핑 UI** — 드래그 또는 우클릭 컨텍스트 메뉴

### 알려진 이슈
- 없음

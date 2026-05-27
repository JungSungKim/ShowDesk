# CLAUDE.md — ShowDesk 프로젝트 AI 에이전트 진입점

이 문서는 이 저장소에서 작업하는 모든 AI 에이전트가 **가장 먼저** 읽어야 한다.

---

## 작업 시작 전 필독 순서

1. **`ROADMAP.md`** — 개발 단계와 현재 위치
2. **`DECISIONS.md`** — 확정/미결 결정사항 (작업 전 반드시 확인)
3. **`DEV_LOG.md`** — 최근 세션 컨텍스트 및 다음 작업
4. **`작업실록.md`** — 최근 2~3개 날짜 항목 (작업 흐름 파악)

---

## 프로젝트 핵심 컨셉

> **ShowDesk**: STL 3D 파일과 BOM을 연동하여, CAD 전문가 없이도 회의 자리에서 3D 모델을 직관적으로 탐색하고 쇼잉할 수 있는 PC 데스크탑 툴.

### 핵심 사용 흐름
```
STL 파일 로드
    ↓
BOM(CSV/Excel) 로드 → 파트 트리 자동 구성
    ↓
파트 트리 클릭 → 3D 하이라이트 / Ghost / Isolate
    ↓
어노테이션 핀 배치 → 레이블 편집
    ↓
스크린샷 저장 / 쇼잉 진행
```

### 기술 스택
- **Electron** — PC 데스크탑 앱 (Windows)
- **React** — UI 렌더러
- **Three.js** — 3D 뷰어 (STL 파싱 + 렌더링)
- **Zustand** — 전역 상태 관리
- **electron-vite** — 빌드 도구

---

## 디렉토리 구조

```
ShowDesk/
├── CLAUDE.md               ← 지금 이 파일
├── ROADMAP.md              ← 개발 단계
├── DECISIONS.md            ← 설계 결정 로그
├── DEV_LOG.md              ← 개발 일지 (세션 컨텍스트)
├── 작업실록.md              ← 날짜별 작업 이력
│
├── docs/
│   ├── planning/PRD.md     ← 제품 요구사항
│   ├── design/ux-flow.md   ← UX 흐름 설계
│   └── specs/feature-spec.md ← 기능 명세
│
├── src/
│   ├── main/               ← Electron 메인 프로세스
│   ├── preload/            ← Electron preload 스크립트
│   ├── renderer/           ← React UI
│   │   ├── components/     ← LandingScreen, Viewer3D, PartTree, PartInfoPanel, PinEditor
│   │   ├── pages/          ← (예약 — 현재 미사용)
│   │   ├── store/          ← useAppStore.ts (Zustand)
│   │   └── hooks/          ← (예약 — 현재 미사용)
│   ├── core/               ← 핵심 비즈니스 로직
│   │   ├── loader/         ← STL 파서
│   │   ├── renderer/       ← Three.js 씬 관리 (SceneManager)
│   │   ├── bom/            ← BOM 파싱, 매핑, 프로젝트 직렬화, AnnotationPin 타입
│   │   └── annotation/     ← (예약 — 현재 미사용)
│
├── assets/
│   ├── icons/
│   └── samples/            ← 테스트용 STL / BOM 샘플
│       ├── stl/
│       └── bom/
│
└── tests/
    ├── unit/
    └── integration/
```

---

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 린트
npm run lint

# 타입 체크
npm run typecheck

# 테스트
npm test
```

---

## 현재 개발 상태

→ `ROADMAP.md` 참조

---

## IPC 채널 (main ↔ renderer)

| 채널 | 설명 | 반환 |
|------|------|------|
| `dialog:openFile` | 파일 열기 다이얼로그 | `string \| null` |
| `dialog:saveFile` | 파일 저장 다이얼로그 | `string \| null` |
| `dialog:openDirectory` | 폴더 선택 다이얼로그 | `string \| null` |
| `fs:readFile` | 파일 읽기 | `ArrayBuffer` |
| `fs:writeFile` | 파일 쓰기 (`string \| ArrayBuffer`) | `void` |
| `fs:readDir` | 폴더 목록 | `{ name, fullPath }[]` |

`src/preload/index.ts`가 `window.api.*`로 노출. renderer에서 `ipcRenderer` 직접 사용 금지.

---

## 커밋 컨벤션

| 접두사 | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `docs:` | 문서 |
| `chore:` | 설정/의존성 |
| `design:` | UI/디자인 변경 |
| `3d:` | 3D 렌더러/뷰어 변경 |
| `bom:` | BOM 파싱/매핑 변경 |
| `ann:` | 어노테이션 핀 관련 |

---

## Gotchas

### STL 파일 처리
- ASCII STL과 Binary STL 둘 다 지원해야 함 — Three.js STLLoader는 기본 지원
- 대형 파일(100MB+)은 메인 스레드 블로킹 주의 → Worker 스레드 처리 고려

### Electron IPC
- 파일 시스템 접근은 반드시 main 프로세스에서 — renderer에서 직접 fs 접근 금지
- preload에서 contextBridge로 안전하게 노출

### Three.js 씬
- 오브젝트 이름(`.name`)이 BOM 매핑 키 — STL 로드 시 파일명을 오브젝트명으로 설정
- 다중 STL 로드 시 씬에 누적되므로 clear 로직 명확히 관리

### CSS2DRenderer (핀 레이블)
- `SceneManager` 생성자가 `(canvas, container: HTMLElement)` 2인자 필요 — container에 labelRenderer DOM 삽입
- labelRenderer는 `position:absolute`, `pointerEvents:none`으로 canvas 위에 중첩
- `AnnotationPin` 타입은 `src/core/bom/project.ts`에 정의 (store가 re-export)

### Wireframe 모드
- 후면 와이어 표시: `mat.colorWrite = false; mat.depthWrite = false` — shadowMap은 정상 작동
- 곡면 엣지: `EdgesGeometry(geo, 5°)` — threshold 20°로는 실린더 심 미검출

### Ghost 모드 밝기 변동
- 대형 반투명 메시가 shadow map에 기여하면 scene 밝기가 오브젝트 크기에 따라 변동
- 해결: ghost 메시는 `mesh.castShadow = false`, 선택/불투명 메시만 `castShadow = true`

---

## 에이전트 작업 규칙

1. **설계 변경** → `DECISIONS.md` 관련 항목 먼저 확인
2. **새 설계 결정** → 즉시 `DECISIONS.md`에 기록
3. **주요 진행** → `DEV_LOG.md`에 날짜와 함께 기록
4. **BOM-3D 매핑 로직** → `src/core/bom/` 에서만 처리
5. **3D 씬 조작** → `src/core/renderer/` 에서만 처리, React 컴포넌트에 Three.js 직접 사용 금지
6. **파일 I/O** → 반드시 main 프로세스 경유 (IPC)

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
│   │   ├── components/     ← 공통 UI 컴포넌트
│   │   ├── pages/          ← 페이지 컴포넌트
│   │   ├── store/          ← Zustand 전역 상태
│   │   └── hooks/          ← 커스텀 React Hooks
│   ├── core/               ← 핵심 비즈니스 로직
│   │   ├── loader/         ← STL 파서
│   │   ├── renderer/       ← Three.js 씬 관리
│   │   ├── bom/            ← BOM 파싱 및 매핑
│   │   └── annotation/     ← 어노테이션 (Phase 2)
│   └── utils/
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

---

## 에이전트 작업 규칙

1. **설계 변경** → `DECISIONS.md` 관련 항목 먼저 확인
2. **새 설계 결정** → 즉시 `DECISIONS.md`에 기록
3. **주요 진행** → `DEV_LOG.md`에 날짜와 함께 기록
4. **BOM-3D 매핑 로직** → `src/core/bom/` 에서만 처리
5. **3D 씬 조작** → `src/core/renderer/` 에서만 처리, React 컴포넌트에 Three.js 직접 사용 금지
6. **파일 I/O** → 반드시 main 프로세스 경유 (IPC)

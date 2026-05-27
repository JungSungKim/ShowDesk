---
description: ShowDesk 세션 시작 — git pull, 이전 작업 컨텍스트 복원, 환경 점검
---

# 세션 시작 — 컨텍스트 복원 및 환경 점검

새 대화 세션에서 이전 작업 맥락을 복원하고 현재 개발 환경 상태를 점검한다.

## 실행 순서

### 1. 최신 코드 동기화

```bash
git -C /c/dev/ShowDesk pull 2>/dev/null || echo "⚠️ git pull 실패 (원격 없거나 네트워크 오류)"
git -C /c/dev/ShowDesk status
```

충돌이 있으면 사용자에게 알리고 중단한다.

### 2. 작업 컨텍스트 복원

다음 파일을 순서대로 읽어 현재 상태를 파악한다:

1. `DEV_LOG.md` — 현재 세션 컨텍스트 (완료 기능, 다음 작업, 알려진 이슈)
2. `작업실록.md` — 최근 2~3개 날짜 항목 (가장 최근 작업 흐름)
3. `DECISIONS.md` — 미결 사항(D-*) 확인
4. `ROADMAP.md` — 현재 Phase 위치

### 3. 로컬 환경 점검

```bash
# Node.js / npm 버전 확인
node --version && npm --version

# node_modules 존재 여부
ls /c/dev/ShowDesk/node_modules 2>/dev/null | head -1 && echo "✅ node_modules 있음" || echo "❌ node_modules 없음 — npm install 필요"

# package.json 존재 여부
ls /c/dev/ShowDesk/package.json 2>/dev/null && echo "✅ package.json 있음" || echo "❌ package.json 없음 — 환경 세팅 필요"
```

### 4. 누락 항목 안내

| 상황 | 안내 |
|------|------|
| `node_modules` 없음 | `npm install` 실행 제안 |
| `package.json` 없음 | 개발 환경 세팅 필요 — ROADMAP.md Phase 0 참조 |

### 5. 세션 시작 브리핑

다음 내용을 정리해서 보고한다:

**현재 상태**
- 마지막 작업 날짜 및 완료 항목 요약
- 알려진 미완료 작업 또는 버그
- 미결 설계 결정사항 (D-* 목록)

**이번 세션 추천 작업**
- DEV_LOG.md의 "다음 추천 작업" 목록에서 우선도 순으로 1~3개

**환경 준비 상태**
- 점검 결과 요약 (✅/❌/⚠️)
- 개발 서버 시작 명령어: `npm run dev`

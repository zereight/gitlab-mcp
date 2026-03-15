# PR #358 리뷰 요약

- **PR**: [#358](https://github.com/zereight/gitlab-mcp/pull/358)
- **제목**: `feat: add code search tools (search_code, search_project_code, search_group_code)`
- **상태**: Open
- **작성일 기준**: 2026-03-14

## 최종 판정

- **Verdict**: **REQUEST CHANGES**
- **Confidence**: **HIGH**

## 코드 리뷰 주요 이슈

| 우선순위 | 이슈 | 위치 |
|---|---|---|
| P1 | URL-encoded `group_id`가 그룹 검색 경로에서 이중 인코딩될 수 있음 | `index.ts` `searchBlobs()` |
| P2 | URL-encoded group path 케이스에 대한 회귀 테스트 부재 | `test/test-search-code.ts` |

### P1 상세 — `group_id` 정규화 문제

`SearchGroupCodeSchema` 설명은 `group_id`를 "Group ID 또는 URL-encoded path"로 받는다고 되어 있습니다.  
하지만 런타임 `searchBlobs()`에서는 아래처럼 바로 인코딩합니다.

- `const groupId = encodeURIComponent(params.group_id)`

호출자가 이미 인코딩된 값(예: `mygroup%2Fsubgroup`)을 전달하면 `%252F` 형태로 이중 인코딩되어 조회 실패를 유발할 수 있습니다.

**권장 수정안**

인코딩 전에 정규화:

- 먼저 decode 후, 1회만 encode
- URL-encoded group path 입력에 대한 테스트 추가

## PR 댓글 스레드 요약

### 1) 작성자 초기 설명 (`@pacifical`)

- GitLab Search API `scope=blobs` 기반 3개 도구 추가
  - `search_code` (글로벌)
  - `search_project_code` (프로젝트)
  - `search_group_code` (그룹)
- 필터/페이지네이션 지원
- opt-in `search` toolset(`isDefault: false`) 도입

### 2) 커뮤니티 피드백 (`@DarkByteZero`)

핵심 제안:

1. **REST vs GraphQL 검색 경로**
   - REST `search?scope=blobs`와 GraphQL `blobSearch` 비교
   - 인스턴스 기능(예: Zoekt)에 따라 `rest|graphql` 선택 가능성 제안

2. **Zoekt 문법 문서화 보강**
   - `file:`, `lang:`, `sym:`, `case:` 같은 exact code search 문법을 툴 설명에 더 명확히 안내 제안

### 3) 작성자 응답 (`@pacifical`)

- Zoekt 관련 설명 보강은 반영
- GraphQL 경로는 이번 PR 범위에서는 미포함

### 4) 스레드 상태

- 전반적으로 건설적인 논의
- 참여자 간 강한 블로킹 의견은 없음
- Copilot 리뷰 요청 상태

## 머지 권고

### 현재 권고

- **P1 수정 전까지 즉시 머지는 비권장**

### 머지 가능 조건

- [ ] `searchBlobs()`의 `group_id` 정규화 수정
- [ ] URL-encoded group path 회귀 테스트 추가 (`search_group_code`)
- [ ] 빌드/테스트 재실행

## 비고

- 본 리뷰는 현 구현의 정확성/호환성 리스크 중심으로 작성되었습니다.
- REST/GraphQL 전략 스위칭 같은 확장 아이디어는 후속 PR로 분리 권장합니다.

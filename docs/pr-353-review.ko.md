# PR #353 리뷰 리포트 (한글)

- **PR**: [#353](https://github.com/zereight/gitlab-mcp/pull/353)
- **제목**: `feat: add artifacts and deployment visibility for pipelines and merge requests`
- **상태**: Open
- **변경 규모**: **+1983 / -13** (대형 PR)
- **기준일**: 2026-03-14

## 1) 개요

이 PR은 파이프라인/배포/머지리퀘스트 가시성을 한 번에 확장하는 대형 기능 PR입니다.

핵심 축은 다음 3가지입니다.

1. **Job Artifacts 도구 추가**
   - `list_job_artifacts`
   - `download_job_artifacts`
   - `get_job_artifact_file`

2. **Deployment / Environment 도구 추가**
   - `list_deployments`, `get_deployment`
   - `list_environments`, `get_environment`

3. **`get_merge_request` 응답 보강**
   - `diverged_commits_count`(behind-count)
   - `commit_addition_summary`
   - `approval_summary`
   - compact deployment summary

## 2) 코드 변경 핵심

- `index.ts`
  - 신규 도구 등록 및 toolset/readOnly 목록 확장
  - 배포/환경 조회 함수 추가
  - 아티팩트 조회/다운로드 함수 추가
  - MR 요약 계산 로직(커밋 수/머지 방식/승인 요약/배포 요약) 추가
  - 승인 상태 조회 시 `approval_state` 실패(404) 시 `approvals` fallback 추가

- `schemas.ts`
  - 배포/환경/아티팩트 관련 스키마 다수 추가
  - MR 승인 상태 스키마 확장(`approved_by`, `source_endpoint` 등)
  - MR 스키마 확장(`diverged_commits_count`, `rebase_in_progress`)

- 테스트
  - `test/test-job-artifacts.ts`
  - `test/test-deployment-tools.ts`
  - `test/test-merge-request-approval-state-tools.ts`

## 3) 댓글/리뷰 타임라인 요약

자동 리뷰에서 초기 지적사항이 있었습니다.

### 초기 지적

1. **P1** 플랫폼 종속 의존성 직접 추가 이슈
   - `@esbuild/darwin-arm64`를 직접 dependency에 추가하면 Linux/Windows 설치 실패 위험

2. **P2** artifact path URL 인코딩 이슈
   - `#`, `?` 등 예약 문자가 포함된 경로에서 조회 실패 가능

3. **P2** 다운로드 시 디렉터리 생성 누락
   - 대상 디렉터리가 없으면 `ENOENT` 가능

### 작성자 후속 조치(코멘트/커밋 기준)

- darwin-only 직접 의존성 제거
- artifact path 세그먼트 인코딩 적용
- 저장 전 디렉터리 생성 로직 추가
- 관련 테스트 추가

수집된 diff에도 위 보완 코드가 반영되어 있습니다.

## 4) 현재 리스크 평가

## ✅ 해결된 것으로 보이는 항목

- 설치 호환성(P1) 이슈 대응 완료
- artifact path/디렉터리 생성 안정성 보완 및 테스트 보강
- 승인 상태 fallback 로직 추가로 구버전/엔드포인트 차이 대응 강화

## ⚠️ 남은 우려(비차단 또는 운영 관점)

- `get_merge_request`가 추가 API 호출을 수행하므로, 대규모 프로젝트에서 응답 지연 가능성
- 기능 범위가 매우 넓어 회귀 범위도 큼(머지 전 CI 신뢰도 중요)

## 5) 머지 권고

### 결론

- **초기 블로커(P1/P2 핵심)는 대부분 해소된 상태로 보임**
- 다만 PR 크기가 크므로, 머지 전 아래 체크 권장

### 머지 전 체크리스트

- [ ] 남은 CI 체크(필수 체크) 모두 통과 확인
- [ ] `get_merge_request` 응답 시간(대표 MR 1~2건) 샘플 확인
- [ ] 문서/툴 설명이 실제 응답 필드와 일치하는지 최종 확인

## 6) 최종 코멘트 (요약)

이 PR은 단순 기능 추가를 넘어 파이프라인-배포-MR 관측성을 유의미하게 끌어올립니다.  
수정 이력상 초기 치명 이슈는 잘 반영되어 안정성이 개선되었고, 현재는 **운영 성능 확인 후 머지 가능한 상태에 가까운 대형 PR**로 판단됩니다.

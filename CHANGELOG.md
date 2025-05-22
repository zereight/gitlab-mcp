## [1.0.42] - 2025-05-22

### Added

- 이슈(issues)에 노트(note)를 생성하고 수정할 수 있는 기능이 추가되었습니다.
- 이제 버그나 할 일 같은 이슈에도 댓글(메모)을 달거나, 이미 단 댓글을 고칠 수 있습니다.
- 예시: "버그를 고쳤어요!"라는 댓글을 이슈에 달 수 있고, 필요하면 "버그를 완전히 고쳤어요!"로 바꿀 수 있습니다.
- 함수형 프로그래밍 원칙과 SOLID 원칙을 준수하여, 코드의 재사용성과 유지보수성이 높아졌습니다.
- 출처: [PR #47](https://github.com/zereight/gitlab-mcp/pull/47)

---

## [1.0.38] - 2025-05-17

### Fixed

- Added `expanded` property to `start` and `end` in `GitLabDiscussionNoteSchema`  
  Now you can expand or collapse more information at the start and end of discussion notes.  
  Example: In code review, you can choose to show or hide specific parts of the discussion.  
  (See: [PR #40](https://github.com/zereight/gitlab-mcp/pull/40))

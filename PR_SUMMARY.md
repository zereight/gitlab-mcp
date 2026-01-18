# Pull Request Summary: Add Resolve Support to update_issue_note

## Overview
This PR implements support for resolving issue discussion threads via the `update_issue_note` tool, addressing the feature request in issue #[issue-number].

## Changes

### Modified Files
1. **schemas.ts** (11 lines changed)
   - Updated `UpdateIssueNoteSchema` to include optional `resolved: boolean` field
   - Added validation rules to ensure API compliance

2. **index.ts** (15 lines changed)
   - Updated `updateIssueNote` function to accept optional `body` and `resolved` parameters
   - Modified payload construction to handle the new parameter
   - Updated tool handler to pass the `resolved` parameter

### New Files
3. **docs/resolve-issue-thread.md** (195 lines)
   - Comprehensive documentation with usage examples
   - Parameter reference and validation rules
   - Use cases and workflow examples

4. **test-resolve-issue-note.ts** (153 lines)
   - Test demonstrations for resolve functionality
   - Test demonstrations for unresolve functionality
   - Backward compatibility test for body updates

## Implementation Details

### API Compliance
- Implements GitLab API: `PUT /projects/:id/issues/:issue_iid/discussions/:discussion_id/notes/:note_id`
- Supports the `resolved` parameter as documented at https://docs.gitlab.com/api/discussions/#resolve-an-issue-thread
- Enforces GitLab API requirement that only one of `body` or `resolved` can be provided per request

### Validation Rules
1. At least one of `body` or `resolved` must be provided
2. Both parameters cannot be provided simultaneously (per GitLab API)

### Consistency
- Follows the exact same pattern as `update_merge_request_discussion_note`
- Maintains backward compatibility with existing functionality
- Consistent parameter naming and error messages

## Testing & Quality Assurance

✅ **TypeScript Compilation**: Build successful with no errors
✅ **Code Review**: Passed with no comments
✅ **Security Scan**: 0 vulnerabilities found (CodeQL)
✅ **Documentation**: Comprehensive docs and examples provided
✅ **Test Examples**: Demonstration tests included

## Usage Example

### Resolve an Issue Thread
```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "mygroup/myproject",
    "issue_iid": "123",
    "discussion_id": "abc123",
    "note_id": "456",
    "resolved": true
  }
}
```

### Unresolve an Issue Thread
```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "mygroup/myproject",
    "issue_iid": "123",
    "discussion_id": "abc123",
    "note_id": "456",
    "resolved": false
  }
}
```

### Update Note Body (Existing Functionality)
```json
{
  "name": "update_issue_note",
  "arguments": {
    "project_id": "mygroup/myproject",
    "issue_iid": "123",
    "discussion_id": "abc123",
    "note_id": "456",
    "body": "Updated content"
  }
}
```

## Impact Assessment

### Breaking Changes
None. The implementation is fully backward compatible.

### New Functionality
- Users can now mark issue discussion threads as resolved or unresolved
- Matches functionality already available for merge request discussions

### Benefits
- Improved issue management workflow
- Better tracking of discussion status
- Consistency with merge request discussion handling
- Enables automation of issue thread resolution

## Files Modified
- `schemas.ts`: Schema updates and validation
- `index.ts`: Function implementation and tool handler

## Files Added
- `docs/resolve-issue-thread.md`: Feature documentation
- `test-resolve-issue-note.ts`: Test demonstrations

## Total Changes
- **4 files changed**
- **369 insertions** (+), **5 deletions** (-)
- Net: **+364 lines**

## Checklist
- [x] Code follows existing patterns
- [x] TypeScript compilation successful
- [x] Code review passed
- [x] Security scan passed
- [x] Documentation complete
- [x] Test examples provided
- [x] Backward compatibility maintained
- [x] API compliance verified

## Related Issues
Implements: [Issue tracking request for resolve support on issue threads]

## GitLab API Reference
https://docs.gitlab.com/api/discussions/#resolve-an-issue-thread

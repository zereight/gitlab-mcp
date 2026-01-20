## [6.12.0](https://github.com/structured-world/gitlab-mcp/compare/v6.11.0...v6.12.0) (2026-01-20)

### Features

* **cli:** add --env-gates flag to list-tools for USE_* documentation ([#59](https://github.com/structured-world/gitlab-mcp/issues/59)) ([579c682](https://github.com/structured-world/gitlab-mcp/commit/579c682e1276cc7034c38b00b2043d7bdc86920b)), closes [#53](https://github.com/structured-world/gitlab-mcp/issues/53)

## [6.11.0](https://github.com/structured-world/gitlab-mcp/compare/v6.10.0...v6.11.0) (2026-01-20)

### Features

* **schema:** add auto-detection schema mode from clientInfo ([#52](https://github.com/structured-world/gitlab-mcp/issues/52)) ([9ec6368](https://github.com/structured-world/gitlab-mcp/commit/9ec6368c7431e95b0d83851462e267575d3118af)), closes [#49](https://github.com/structured-world/gitlab-mcp/issues/49)

## [6.10.0](https://github.com/structured-world/gitlab-mcp/compare/v6.9.0...v6.10.0) (2026-01-20)

### Features

* **docs:** add --export flag to list-tools for TOOLS.md generation ([#51](https://github.com/structured-world/gitlab-mcp/issues/51)) ([25f5393](https://github.com/structured-world/gitlab-mcp/commit/25f53933240a11111e89247ea39e5acdd598f899)), closes [#47](https://github.com/structured-world/gitlab-mcp/issues/47) [#49](https://github.com/structured-world/gitlab-mcp/issues/49)

## [6.9.0](https://github.com/structured-world/gitlab-mcp/compare/v6.8.0...v6.9.0) (2026-01-19)

### Features

* **schema:** add dynamic action filtering with schema transformation pipeline ([#44](https://github.com/structured-world/gitlab-mcp/issues/44)) ([10069c9](https://github.com/structured-world/gitlab-mcp/commit/10069c9398d46e566a8788ece883ecc32098510e)), closes [#32](https://github.com/structured-world/gitlab-mcp/issues/32) [#32](https://github.com/structured-world/gitlab-mcp/issues/32)

## [6.8.0](https://github.com/structured-world/gitlab-mcp/compare/v6.7.0...v6.8.0) (2026-01-19)

### Features

* **integrations:** Add project integrations management entity ([#38](https://github.com/structured-world/gitlab-mcp/issues/38)) ([7e68150](https://github.com/structured-world/gitlab-mcp/commit/7e681505973ad10e50bfe68b4c857a491c363cc8)), closes [#7](https://github.com/structured-world/gitlab-mcp/issues/7)

## [6.7.0](https://github.com/structured-world/gitlab-mcp/compare/v6.6.0...v6.7.0) (2026-01-19)

### Features

* **snippets:** Add snippets management entity with consolidated tools ([#39](https://github.com/structured-world/gitlab-mcp/issues/39)) ([6ebbbe1](https://github.com/structured-world/gitlab-mcp/commit/6ebbbe1a0ab26e961fbecbdddf20ec109b9c620e))

## [6.6.0](https://github.com/structured-world/gitlab-mcp/compare/v6.5.0...v6.6.0) (2026-01-19)

### Features

* **variables:** consolidate 5 CI/CD variable tools into 2 CQRS tools ([#43](https://github.com/structured-world/gitlab-mcp/issues/43)) ([4b6b82a](https://github.com/structured-world/gitlab-mcp/commit/4b6b82a79d2388ffde045db1f9dcc106cc16ac4d)), closes [#9](https://github.com/structured-world/gitlab-mcp/issues/9)

## [6.5.0](https://github.com/structured-world/gitlab-mcp/compare/v6.4.1...v6.5.0) (2026-01-19)

### Features

* **labels:** consolidate 5 label tools into 2 CQRS tools ([fc18e60](https://github.com/structured-world/gitlab-mcp/commit/fc18e60cac2bdaedf88710bf2308b0cbbc8e2664)), closes [#8](https://github.com/structured-world/gitlab-mcp/issues/8)
* **webhooks:** Add webhooks management entity with action-based CRUD ([#35](https://github.com/structured-world/gitlab-mcp/issues/35)) ([2b7761d](https://github.com/structured-world/gitlab-mcp/commit/2b7761d2845b4415d09100e8c437d79048a9e4ff))

## [6.4.1](https://github.com/structured-world/gitlab-mcp/compare/v6.4.0...v6.4.1) (2026-01-19)

### Bug Fixes

* **ci:** handle null values from jq in coverage report formatting ([5621352](https://github.com/structured-world/gitlab-mcp/commit/56213521b541e17baa5d845312a8d7527c25515c))
* conditionally append % to coverage metrics, avoiding N/A% ([b984c75](https://github.com/structured-world/gitlab-mcp/commit/b984c756e78fbac1fd5f23cbc0cf5f76a829aac6))

## [6.4.0](https://github.com/structured-world/gitlab-mcp/compare/v6.3.1...v6.4.0) (2026-01-19)

### Features

* **wiki:** consolidate 5 wiki tools into 2 CQRS tools ([9185496](https://github.com/structured-world/gitlab-mcp/commit/918549658d75b53553c39b164a47edac336ecfd8)), closes [#10](https://github.com/structured-world/gitlab-mcp/issues/10)

## [6.3.1](https://github.com/structured-world/gitlab-mcp/compare/v6.3.0...v6.3.1) (2026-01-19)

### Bug Fixes

* **ci:** use JSON summary for coverage report percentages ([07f05ca](https://github.com/structured-world/gitlab-mcp/commit/07f05caf842c406bf88039147378f79a586b3c32))

## [6.3.0](https://github.com/structured-world/gitlab-mcp/compare/v6.2.3...v6.3.0) (2026-01-19)

### Features

* **milestones:** consolidate 9 milestone tools into 2 CQRS tools ([2d054dd](https://github.com/structured-world/gitlab-mcp/commit/2d054ddf86842dd845cebe11096e6e460f6f708c)), closes [#13](https://github.com/structured-world/gitlab-mcp/issues/13)

## [6.2.3](https://github.com/structured-world/gitlab-mcp/compare/v6.2.2...v6.2.3) (2026-01-19)

### Refactoring

* **core:** convert remaining discriminated unions to flat schemas ([32efcdc](https://github.com/structured-world/gitlab-mcp/commit/32efcdc52a1cf5e4792f2dbb8086ad88181c2d32))
* **files:** remove unnecessary Uint8Array wrapper ([322bc4b](https://github.com/structured-world/gitlab-mcp/commit/322bc4b927e0823954f864d2396b8fb713c76366))
* **schemas:** convert CQRS schemas from discriminated unions to flat schemas ([f934cfd](https://github.com/structured-world/gitlab-mcp/commit/f934cfdfb10be98a3c8db790c940c1ba8c781077)), closes [#29](https://github.com/structured-world/gitlab-mcp/issues/29)

## [6.2.2](https://github.com/structured-world/gitlab-mcp/compare/v6.2.1...v6.2.2) (2026-01-19)

### Refactoring

* **schemas:** replace z.coerce.string() with requiredId for all required ID fields ([3461cfb](https://github.com/structured-world/gitlab-mcp/commit/3461cfbc3fba458d1e1fc03ea2b33ea7c4e20c6b)), closes [#27](https://github.com/structured-world/gitlab-mcp/issues/27)

## [6.2.1](https://github.com/structured-world/gitlab-mcp/compare/v6.2.0...v6.2.1) (2026-01-19)

### Bug Fixes

* **pipelines:** add proper validation for required ID fields ([bd8f431](https://github.com/structured-world/gitlab-mcp/commit/bd8f43140c7cd7b15665d00d19bec5a170aea153))
* **utils:** use nullish coalescing for requiredId helper ([9a7c395](https://github.com/structured-world/gitlab-mcp/commit/9a7c3950e2bf5db35231739e6a656b8133c0a359))

### Refactoring

* **pipelines:** consolidate 12 tools into 3 CQRS tools ([85de70f](https://github.com/structured-world/gitlab-mcp/commit/85de70ffd444be036ac795ba1d8774235ecc4e8d)), closes [#14](https://github.com/structured-world/gitlab-mcp/issues/14)

## [6.2.0](https://github.com/structured-world/gitlab-mcp/compare/v6.1.0...v6.2.0) (2026-01-19)

### Features

* **workitems:** consolidate 5 work item tools into 2 CQRS tools ([#11](https://github.com/structured-world/gitlab-mcp/issues/11)) ([cd12ffc](https://github.com/structured-world/gitlab-mcp/commit/cd12ffc25911d7f761515089bf1746d72719f931))

### Bug Fixes

* **tests:** make Todos tests resilient to GitLab API variations ([c51f997](https://github.com/structured-world/gitlab-mcp/commit/c51f997ac31a3198573cb77dba9c64c37d836d46))
* **tests:** update integration tests to use CQRS tool names ([32b88fb](https://github.com/structured-world/gitlab-mcp/commit/32b88fbd0693757acc176e2f5b4488ffce4e5aea))
* **workitems:** remove unused 'active' parameter from work items schema ([99a91f3](https://github.com/structured-world/gitlab-mcp/commit/99a91f3435cd544496659753161e5955fcaabd05))
* **workitems:** update comment to reflect CQRS tool name ([f9dc19b](https://github.com/structured-world/gitlab-mcp/commit/f9dc19be4e0f9c07f9641ef03af1601e75f5390d))

## [6.1.0](https://github.com/structured-world/gitlab-mcp/compare/v6.0.0...v6.1.0) (2026-01-19)

### ⚠ BREAKING CHANGES

* **mrs:** Individual MR tools replaced with action-based CQRS tools

### Features

* **mrs:** consolidate 20 MR tools into 5 CQRS tools ([#15](https://github.com/structured-world/gitlab-mcp/issues/15)) ([ec06fae](https://github.com/structured-world/gitlab-mcp/commit/ec06faefd5f59b9577dc4fc48045cf0e0205ea0d))

### Bug Fixes

* **mrs:** address PR [#23](https://github.com/structured-world/gitlab-mcp/issues/23) review comments and increase coverage ([0e6410b](https://github.com/structured-world/gitlab-mcp/commit/0e6410b045fca8b7c54ebf1de9471849e33b4ff4)), closes [#12](https://github.com/structured-world/gitlab-mcp/issues/12) [#19](https://github.com/structured-world/gitlab-mcp/issues/19) [#20](https://github.com/structured-world/gitlab-mcp/issues/20)
* **mrs:** address PR review comments from Copilot ([#23](https://github.com/structured-world/gitlab-mcp/issues/23)) ([1905ac4](https://github.com/structured-world/gitlab-mcp/commit/1905ac46ab2161d6c961429dd1a557ee1964f752))

# [6.0.0](https://github.com/structured-world/gitlab-mcp/compare/v5.8.0...v6.0.0) (2026-01-19)


* feat(files)!: CQRS consolidation - 5 tools to 2 tools ([b29c0c8](https://github.com/structured-world/gitlab-mcp/commit/b29c0c8c6b6c247401c7f45bb0c1cfe51a6c297c)), closes [#12](https://github.com/structured-world/gitlab-mcp/issues/12)


### Bug Fixes

* address additional Copilot review comments ([8759662](https://github.com/structured-world/gitlab-mcp/commit/8759662e99976402b2b94b38b59d9c2b75a2289e))
* address Copilot review comments and lockfile bin path ([ca376c1](https://github.com/structured-world/gitlab-mcp/commit/ca376c1adbbfabc1af144996a5851c16825061ef))
* **build:** include prisma generate in build script for Docker compatibility ([3a094be](https://github.com/structured-world/gitlab-mcp/commit/3a094be9793b82fa83ce591032f78039880d9820))
* **ci:** add Prisma client generation to ci-cd workflow ([7f11e80](https://github.com/structured-world/gitlab-mcp/commit/7f11e80f0d30f7c11af4128143492ecfd79a9894))
* **ci:** add Prisma dependencies and generate step to workflows ([76e2233](https://github.com/structured-world/gitlab-mcp/commit/76e22335dccf19162ad6dc7f94778c362a36c4d4))
* **ci:** use GitHub App token for semantic-release to bypass branch protection ([c8a6e1a](https://github.com/structured-world/gitlab-mcp/commit/c8a6e1acdee1c5a69b19cc535d135fb1e16b5a46))
* **core:** address PR review feedback from Copilot ([b664354](https://github.com/structured-world/gitlab-mcp/commit/b664354ee7329e6d2bfd892456eb3a211580966e))
* **deps:** add prisma generate to postinstall script ([1c41931](https://github.com/structured-world/gitlab-mcp/commit/1c41931edb2686e7313e27431d7e03d8f1f36746))
* **deps:** make postinstall conditional for Docker compatibility ([185a9a3](https://github.com/structured-world/gitlab-mcp/commit/185a9a3137a49704fcdc09f4571c794cbab77687))
* **docker:** copy prisma schema to builder stage ([42200fd](https://github.com/structured-world/gitlab-mcp/commit/42200fde71acae5c534ef940f3bd430399d031f8))
* **files:** make batch file content required per API spec ([7a0ff07](https://github.com/structured-world/gitlab-mcp/commit/7a0ff07b7e26e04e05cc12e0cd8a5ba6fe087c84))
* restore STDIO transport mode and use yarn for prisma ([0fadedf](https://github.com/structured-world/gitlab-mcp/commit/0fadedf284eb2e4c735284220332bfe0d5627f5a))
* **security:** add CodeQL suppression for rate limiting false positives ([a1be5c4](https://github.com/structured-world/gitlab-mcp/commit/a1be5c455bdfa2b9659e9456a74df3018fe2ca84))
* **tests:** add todos to TestDataState and remove unused import ([f170a95](https://github.com/structured-world/gitlab-mcp/commit/f170a95eb0c7b74c478451e720ef3a3c0b0fdd12))
* **types:** resolve TypeScript errors in server-launcher.ts ([c06a097](https://github.com/structured-world/gitlab-mcp/commit/c06a09739aacaed3424bcd9f49ddffe2b0f93292))


### Features

* **core:** add todos data lifecycle tests and address Copilot review feedback ([b909916](https://github.com/structured-world/gitlab-mcp/commit/b9099168389e75c531f42066be97788754d3a8cb))
* **core:** add todos tools and CQRS consolidation ([#4](https://github.com/structured-world/gitlab-mcp/issues/4), [#16](https://github.com/structured-world/gitlab-mcp/issues/16)) ([d6fc3ee](https://github.com/structured-world/gitlab-mcp/commit/d6fc3eebc266742f07cb5e52bec5a5b324b892f3))
* **security:** add rate limiting middleware for anonymous requests ([234a412](https://github.com/structured-world/gitlab-mcp/commit/234a4122200ae3243dbca6494d38979704eac391)), closes [#6](https://github.com/structured-world/gitlab-mcp/issues/6) [#6](https://github.com/structured-world/gitlab-mcp/issues/6)


### Reverts

* remove custom CodeQL workflow due to SARIF upload conflict ([aa47e12](https://github.com/structured-world/gitlab-mcp/commit/aa47e12eb0ebb61d71980efbb6b075834819d139))


### BREAKING CHANGES

* Replace 5 individual file tools with 2 CQRS-aligned tools

Migration guide:
- get_repository_tree → browse_files with action: "tree"
- get_file_contents → browse_files with action: "content"
- create_or_update_file → manage_files with action: "single"
- push_files → manage_files with action: "batch"
- upload_markdown → manage_files with action: "upload"

Changes:
- Add BrowseFilesSchema with discriminated union (tree/content actions)
- Add ManageFilesSchema with discriminated union (single/batch/upload actions)
- Replace filesToolRegistry with 2 consolidated tools
- Update read-only tools list to only include browse_files
- Update unit tests for new tool structure

# [5.8.0](https://github.com/structured-world/gitlab-mcp/compare/v5.7.0...v5.8.0) (2025-11-26)


### Bug Fixes

* **handlers:** handle 204 No Content responses and FormData uploads ([8ecc3ef](https://github.com/structured-world/gitlab-mcp/commit/8ecc3ef86873661e8fcc4ae04c2c27b7174b784b))


### Features

* **deps:** upgrade Zod from v3 to v4 with native JSON Schema generation ([e605eef](https://github.com/structured-world/gitlab-mcp/commit/e605eefedd87d0861ade2e1e58c1a251ef86edeb))
* **fetch:** add Node.js v24 compatibility with Undici dispatcher pattern ([da74392](https://github.com/structured-world/gitlab-mcp/commit/da74392e216a2641197bf39a4f1d848fa6d2fe7e))
* **oauth:** add OAuth 2.1 authentication with GitLab Device Flow ([3d6d34d](https://github.com/structured-world/gitlab-mcp/commit/3d6d34d729de1e448fbe27816c30efbe58fb22fa))
* **server:** add TLS/HTTPS support with reverse proxy configuration ([4203e17](https://github.com/structured-world/gitlab-mcp/commit/4203e170479348e13556143ff37cd308fa21c5d7))

# [5.7.0](https://github.com/structured-world/gitlab-mcp/compare/v5.6.1...v5.7.0) (2025-09-23)


### Bug Fixes

* **files:** correct get_file_contents API endpoint and response handling ([62fb9f8](https://github.com/structured-world/gitlab-mcp/commit/62fb9f8f5bc0fabab2982382309449c6c975c6fa))


### Features

* **tests:** improve unit test coverage from 88.48% to 90.34% ([62d0f5b](https://github.com/structured-world/gitlab-mcp/commit/62d0f5b5a88143e397ebcc62139efea2a584d57c))

## [5.6.1](https://github.com/structured-world/gitlab-mcp/compare/v5.6.0...v5.6.1) (2025-09-23)


### Bug Fixes

* **core:** clarify verify_namespace tool description for agentic usage ([2871398](https://github.com/structured-world/gitlab-mcp/commit/2871398b177875a6ca70128dcc2eca0c87fed94a))

# [5.6.0](https://github.com/structured-world/gitlab-mcp/compare/v5.5.0...v5.6.0) (2025-09-21)


### Features

* **variables:** enhance error handling and improve masking documentation ([e39dc51](https://github.com/structured-world/gitlab-mcp/commit/e39dc51909b31a69bd332a1e389824a00524d17e))

# [5.5.0](https://github.com/structured-world/gitlab-mcp/compare/v5.4.0...v5.5.0) (2025-09-21)


### Features

* **test:** improve unit test coverage and pipeline job output limits ([cf5dd75](https://github.com/structured-world/gitlab-mcp/commit/cf5dd755b1b57ceaa896d5f2ba80aad971066501))

# [5.4.0](https://github.com/structured-world/gitlab-mcp/compare/v5.3.0...v5.4.0) (2025-09-21)


### Features

* enhance pipeline job output handling and improve test coverage ([86be293](https://github.com/structured-world/gitlab-mcp/commit/86be293043e4ab30fc327c933fc31a87065806ec))

# [5.3.0](https://github.com/structured-world/gitlab-mcp/compare/v5.2.0...v5.3.0) (2025-09-21)


### Features

* fix double URL encoding issue and improve pipeline API compliance ([dc886d9](https://github.com/structured-world/gitlab-mcp/commit/dc886d946119a8de5324bd32c0ae95a5a241b1ee))

# [5.2.0](https://github.com/structured-world/gitlab-mcp/compare/v5.1.0...v5.2.0) (2025-09-19)


### Features

* comprehensive project cleanup and test verification ([5815eb8](https://github.com/structured-world/gitlab-mcp/commit/5815eb8888affe1e9412e11229bd9ed5902b4077))
* move test_mcp.sh to scripts directory and update documentation ([71a24d5](https://github.com/structured-world/gitlab-mcp/commit/71a24d54e3e768f720851a05125c5659ef22a1de))

# [5.1.0](https://github.com/structured-world/gitlab-mcp/compare/v5.0.0...v5.1.0) (2025-09-19)


### Features

* establish v5.0.0 baseline for semantic versioning ([f5ac7a5](https://github.com/structured-world/gitlab-mcp/commit/f5ac7a50df9c6f8bff723824ab0e7bdf392fea6b))

# 1.0.0 (2025-09-19)


### Bug Fixes

* add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema ([5024a2a](https://github.com/structured-world/gitlab-mcp/commit/5024a2a5afb138b2fcd76407edf414bdec6a76f2))
* add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema ([d99c483](https://github.com/structured-world/gitlab-mcp/commit/d99c483ab33bdbd368d804cf68e79f008f026c41))
* add package-lock.json to .gitignore ([067586c](https://github.com/structured-world/gitlab-mcp/commit/067586c665bd81ad4695c2fbbab5582b67e77cb2))
* add package-lock.json to .gitignore ([e7e49f0](https://github.com/structured-world/gitlab-mcp/commit/e7e49f0a93c8c0d542843f4a7c2d0a7d8481b674))
* avoid error caused by line_range: null in discussion ([d50b7fd](https://github.com/structured-world/gitlab-mcp/commit/d50b7fd1ac01802889bd383e39d767378204aa66))
* avoid error caused by line_range: null in discussion ([ac2cee2](https://github.com/structured-world/gitlab-mcp/commit/ac2cee27629f5833d1251dc097742c8576e44b5a))
* Correct formatting of GITLAB_API_URL environment variable in README ([06598d7](https://github.com/structured-world/gitlab-mcp/commit/06598d7adb98b146ae2a36a2cf8bcf807f59b465))
* Correct formatting of GITLAB_API_URL environment variable in README ([83f395d](https://github.com/structured-world/gitlab-mcp/commit/83f395df0547875381da5f0ab5892e34d1ef7bf0))
* fix README ([f4b265b](https://github.com/structured-world/gitlab-mcp/commit/f4b265bf2eaca6960e28aa6b444dda25b0ed596e))
* fix README ([7323405](https://github.com/structured-world/gitlab-mcp/commit/73234055d2c3785eec03ee0f2b3c835ed741eca8))
* GitHub Actions workflow syntax errors ([6d6110c](https://github.com/structured-world/gitlab-mcp/commit/6d6110c78bcef3987799c98a9fd48241236e7cf7))
* GitHub Actions workflow syntax errors ([55d9a5e](https://github.com/structured-world/gitlab-mcp/commit/55d9a5e3103f2b9f1ff17c7c56f17c52ad3ffea4))
* improve error handling for GitLab API rate limit exceeded ([11685d7](https://github.com/structured-world/gitlab-mcp/commit/11685d7a906eade7f586af1fcd08eaf270972b5e))
* improve error handling for GitLab API rate limit exceeded ([1a30d2c](https://github.com/structured-world/gitlab-mcp/commit/1a30d2ccc3abf4a7f22b07268ec207253144815c))
* **list_issues:** add hint for scope all ([478df19](https://github.com/structured-world/gitlab-mcp/commit/478df197615ce60b475bf9f27ab6ba415e3d2f04))
* **list_issues:** add hint for scope all ([aa3b2ab](https://github.com/structured-world/gitlab-mcp/commit/aa3b2ab267da609ce0e64d67a2a0282742c3848c))
* **list_issues:** make project_id optional ([b242522](https://github.com/structured-world/gitlab-mcp/commit/b2425221a6077c7fdba343e8681d1938a24d3a39))
* **list_issues:** make project_id optional ([7cd4731](https://github.com/structured-world/gitlab-mcp/commit/7cd4731cb21b5b94161ad59264b4e0b85d641eb7))
* merge_requests_template can be null ([#79](https://github.com/structured-world/gitlab-mcp/issues/79)) ([cd8f0e5](https://github.com/structured-world/gitlab-mcp/commit/cd8f0e5525a2f570d2fcb825181ca61c2ba113af))
* merge_requests_template can be null ([#79](https://github.com/structured-world/gitlab-mcp/issues/79)) ([73fdd8f](https://github.com/structured-world/gitlab-mcp/commit/73fdd8fee70e7479bfbd8ab071119bfe07884ad6))
* remove duplicate entry for get_branch_diffs in tools list ([6bc1379](https://github.com/structured-world/gitlab-mcp/commit/6bc13794c8cfe09dafa2fddeae2d05589700cac6))
* remove duplicate entry for get_branch_diffs in tools list ([8398109](https://github.com/structured-world/gitlab-mcp/commit/839810934e8ecde7a85580405b7512074a95cb81))
* rename to source branch ([7b8cbc0](https://github.com/structured-world/gitlab-mcp/commit/7b8cbc0806ed9123e033d98f4965fd6fbc532c07))
* rename to source branch ([5baa2d1](https://github.com/structured-world/gitlab-mcp/commit/5baa2d14742372571bb857c9c3cbf8299862beff))
* **schemas:** make avatar_url nullable in GitLabUserSchema ([ab571d2](https://github.com/structured-world/gitlab-mcp/commit/ab571d211de494f116a74bb403267b10e75460a8))
* **schemas:** make avatar_url nullable in GitLabUserSchema ([3f630ca](https://github.com/structured-world/gitlab-mcp/commit/3f630cac3407de2918d58fd6202dca0b61ee44fc))
* **schemas:** make illustration nullable in GitLabPipelineSchema ([40e39d7](https://github.com/structured-world/gitlab-mcp/commit/40e39d7b36362cdadcfc8315861b08484743c5d7))
* **schemas:** make illustration nullable in GitLabPipelineSchema ([87efa04](https://github.com/structured-world/gitlab-mcp/commit/87efa045868f5344699f95bb006cd6ebf86d7f65))
* Update Docker image repository name in workflow ([b97b264](https://github.com/structured-world/gitlab-mcp/commit/b97b2642c954e6cea8d3ce0c1092d04229cfd1f9))
* Update Docker image repository name in workflow ([29ac699](https://github.com/structured-world/gitlab-mcp/commit/29ac699a4c65c0c7a707c46951fa43e633d8651f))
* Update README title and remove duplicate star history chart ([92a3e95](https://github.com/structured-world/gitlab-mcp/commit/92a3e95d38048d0f4fb26a74b2bf19d95021f0a6))
* Update README title and remove duplicate star history chart ([126fa8c](https://github.com/structured-world/gitlab-mcp/commit/126fa8c2b3d79bea63748b960d8b9f6148216017))


### Features

* add branch comparison functionality and update related schemas ([c834ebc](https://github.com/structured-world/gitlab-mcp/commit/c834ebc135bf5896ab4f7982ae417f0c32d8ea42))
* add branch comparison functionality and update related schemas ([af81bd4](https://github.com/structured-world/gitlab-mcp/commit/af81bd402aeff1a6f03afcf7853d83d89231a8fe))
* add configuration files and scripts for project setup ✨ ([5b35bc1](https://github.com/structured-world/gitlab-mcp/commit/5b35bc163c3277523fbf264523601f55103d714b))
* add configuration files and scripts for project setup ✨ ([4aac7f5](https://github.com/structured-world/gitlab-mcp/commit/4aac7f576a91b14fcf7d379c5baa13df3762ef86))
* add cookie-based authentication support for enterprise GitLab  ([#101](https://github.com/structured-world/gitlab-mcp/issues/101)) ([402f068](https://github.com/structured-world/gitlab-mcp/commit/402f06847056903058a5bf5bed0b65d81e0c5757)), closes [#100](https://github.com/structured-world/gitlab-mcp/issues/100)
* add cookie-based authentication support for enterprise GitLab  ([#101](https://github.com/structured-world/gitlab-mcp/issues/101)) ([17b8574](https://github.com/structured-world/gitlab-mcp/commit/17b85746b5c3d9fa64f7c912dbefc7fa1184c59d)), closes [#100](https://github.com/structured-world/gitlab-mcp/issues/100)
* Add create_merge_request_thread tool for diff notes ([026dd58](https://github.com/structured-world/gitlab-mcp/commit/026dd58887079bb60187d6acacaafc6fa28d0c3d))
* Add create_merge_request_thread tool for diff notes ([23b0348](https://github.com/structured-world/gitlab-mcp/commit/23b03481eacc2b32a1f4afdf5a125ca23f87bdcf))
* Add createDraftNote api support, useful for bulk code review ([5f08153](https://github.com/structured-world/gitlab-mcp/commit/5f08153da675a6fbec780329c82c6a3395f3f691))
* Add createDraftNote api support, useful for bulk code review ([73f0c48](https://github.com/structured-world/gitlab-mcp/commit/73f0c484176796e706635f4357efc24d7c5af292))
* add docker image and push to dockerhub ([6f78969](https://github.com/structured-world/gitlab-mcp/commit/6f789692be12cf9623bd5b0d1698713385f37b88))
* add docker image and push to dockerhub ([4fd7124](https://github.com/structured-world/gitlab-mcp/commit/4fd7124ef112bdc5a6eeb41ee8af891adfa322ad))
* add GITLAB_LOCK_PROJECT environment variable ([c899a7d](https://github.com/structured-world/gitlab-mcp/commit/c899a7dc3be63bbfce25a715cd3d910255604c0b))
* add GITLAB_LOCK_PROJECT environment variable ([a102e94](https://github.com/structured-world/gitlab-mcp/commit/a102e94e4020efc9f96f3fa472e0b2cc50a87615))
* add issue discussions support ([4c57c37](https://github.com/structured-world/gitlab-mcp/commit/4c57c378886bf6e3eda8f815c654fda0d29dcd44))
* add issue discussions support ([3d06892](https://github.com/structured-world/gitlab-mcp/commit/3d06892a860e8918d4a1dad56f77ee16bdd33409))
* add milestone management commands to README ([5762b32](https://github.com/structured-world/gitlab-mcp/commit/5762b32a69c3aa13ae819335ba7549be6f36722e))
* add milestone management commands to README ([bd75140](https://github.com/structured-world/gitlab-mcp/commit/bd75140e77988cbfdef628233bbe437847b22680))
* add my_issues and list_project_members tools ([a519a56](https://github.com/structured-world/gitlab-mcp/commit/a519a56493ac40b2b6ae06e3d639cacf864b53dd))
* add my_issues and list_project_members tools ([f33f330](https://github.com/structured-world/gitlab-mcp/commit/f33f330f2b5f928feb91db78adecc6bfdc2cf5ff))
* Add NPM publish workflow for automated package publishing ([#208](https://github.com/structured-world/gitlab-mcp/issues/208)) ([7e985af](https://github.com/structured-world/gitlab-mcp/commit/7e985afadf3d99fe8596d89d2ffb1c92dda6276d))
* Add NPM publish workflow for automated package publishing ([#208](https://github.com/structured-world/gitlab-mcp/issues/208)) ([5a4d416](https://github.com/structured-world/gitlab-mcp/commit/5a4d416bd73bf79e12d4d898a16da1f2fb598d1d))
* add pagination support for CI job logs to prevent context window flooding ([2905f30](https://github.com/structured-world/gitlab-mcp/commit/2905f30af7bea788be340a3b74792dcd1e305aef))
* add pagination support for CI job logs to prevent context window flooding ([f05d8bf](https://github.com/structured-world/gitlab-mcp/commit/f05d8bf75e124ccdd3263c2d6fefe56f00c3213d))
* add read-only mode support via GITLAB_READ_ONLY_MODE environment variable ([7be17b7](https://github.com/structured-world/gitlab-mcp/commit/7be17b7afcaa407e0e0cd264e887b84b2a8bb688))
* add read-only mode support via GITLAB_READ_ONLY_MODE environment variable ([916a65a](https://github.com/structured-world/gitlab-mcp/commit/916a65ae5253f8a8f83f84edf73deafe18d4960d))
* add support for creating and updating issue notes ([dc6cc59](https://github.com/structured-world/gitlab-mcp/commit/dc6cc59434a14d102a8357034cbce719142c3b0f))
* add support for creating and updating issue notes ([96d5e49](https://github.com/structured-world/gitlab-mcp/commit/96d5e49b71bad624be8c4fb3733f066f936ff6e8))
* add support for ignoring files in branch diff results using regex patterns ([75fd5e8](https://github.com/structured-world/gitlab-mcp/commit/75fd5e83e095b218cd9230e7133d4716c51ffc9a))
* add support for ignoring files in branch diff results using regex patterns ([946c49a](https://github.com/structured-world/gitlab-mcp/commit/946c49a3eaf8ea8ca5c1bc2eb52cd535a876ce58))
* add tools for milestones ([fd1c8b9](https://github.com/structured-world/gitlab-mcp/commit/fd1c8b9704473c38413aa6bac71a3899b7413657))
* add tools for milestones ([bb0da0a](https://github.com/structured-world/gitlab-mcp/commit/bb0da0a86296a17ba71569e9ef603385f6eed9a3))
* add user retrieval functions and schemas for GitLab API integration ([005b46a](https://github.com/structured-world/gitlab-mcp/commit/005b46a1a66d2d72bc922f9f98f2df2f58c5f084))
* add user retrieval functions and schemas for GitLab API integration ([440921a](https://github.com/structured-world/gitlab-mcp/commit/440921ab10f7f71e07434fb54bf2f923b5d67ff5))
* bump version to 1.0.61 🎉 ([ed032ba](https://github.com/structured-world/gitlab-mcp/commit/ed032bad48ee7a43d59d2c57e8ac1984d4d30dc8))
* bump version to 1.0.61 🎉 ([9a2bc5e](https://github.com/structured-world/gitlab-mcp/commit/9a2bc5ef4b0c909772e9e59e68e52cf803022b50))
* Bump version to 5.0.0 ([9f85a7b](https://github.com/structured-world/gitlab-mcp/commit/9f85a7b8e100c86b1e4359f2150007711cfabcb3))
* Decode project_id for GitLab API calls ([08ab135](https://github.com/structured-world/gitlab-mcp/commit/08ab1357a0bfdef0bf6360f0c61759f25405652b))
* Decode project_id for GitLab API calls ([95ad321](https://github.com/structured-world/gitlab-mcp/commit/95ad3211eb534ba8e482640ef38473512605f86d))
* enhance CreateMergeRequest options with assignee, reviewer, and label support ([bf369a4](https://github.com/structured-world/gitlab-mcp/commit/bf369a43dad22d0de8117c7909948f863e90e61d))
* enhance CreateMergeRequest options with assignee, reviewer, and label support ([e692ddc](https://github.com/structured-world/gitlab-mcp/commit/e692ddc54ad35fbde8c767c357b1ae4639b6cf6c))
* enhance test infrastructure and fix code quality issues ([95b3529](https://github.com/structured-world/gitlab-mcp/commit/95b3529e6af6bedfec6ecdcffc382e195b7302e0))
* get merge request default description template on project retrieval ([808c34d](https://github.com/structured-world/gitlab-mcp/commit/808c34d0ee04fd4ec95e77dce040b3a18036e347))
* get merge request default description template on project retrieval ([886faf5](https://github.com/structured-world/gitlab-mcp/commit/886faf566a9eaf6a11f349e804f4ef06828e888f))
* Gitlab list repository tree tool ([bccd5f2](https://github.com/structured-world/gitlab-mcp/commit/bccd5f29c398a994de29e4b01fdf14cd6f6cf55c))
* Gitlab list repository tree tool ([58f51a4](https://github.com/structured-world/gitlab-mcp/commit/58f51a43e61547e3687e56d5cddb381c13297229))
* Implement add_merge_request_thread_note function for adding notes to existing MR threads ([3f2b355](https://github.com/structured-world/gitlab-mcp/commit/3f2b35535ee93b14a6649074608842d1ff8de208))
* Implement add_merge_request_thread_note function for adding notes to existing MR threads ([5f9aecd](https://github.com/structured-world/gitlab-mcp/commit/5f9aecdf21bd83a3b3928e32cec5d503809e88ad))
* implement comprehensive GitLab MCP enhancements v4.4.0 ([60fd9d8](https://github.com/structured-world/gitlab-mcp/commit/60fd9d89a93abe3fc81beb30992cc2848b7f954c))
* implement list_merge_requests functionality ([cc84777](https://github.com/structured-world/gitlab-mcp/commit/cc847772f1f8560d9ce9cba25acbb232cbbf618d))
* implement list_merge_requests functionality ([6acecd2](https://github.com/structured-world/gitlab-mcp/commit/6acecd290d1820f4d24aa719b2f845551a05c51b))
* Implement proxy configuration for HTTP/HTTPS/SOCKS ([7c2578f](https://github.com/structured-world/gitlab-mcp/commit/7c2578fd4ba140242b5f00a792a97488263cd3fc))
* Implement proxy configuration for HTTP/HTTPS/SOCKS ([94b206f](https://github.com/structured-world/gitlab-mcp/commit/94b206f72f888e53a838f64349a43449d5eaaada))
* **pipeline:** Add list_pipeline_trigger_jobs tools ([56a53b3](https://github.com/structured-world/gitlab-mcp/commit/56a53b3ab9930ca51e1e080805c402b7baa1b1a0))
* **pipeline:** Add list_pipeline_trigger_jobs tools ([0006e67](https://github.com/structured-world/gitlab-mcp/commit/0006e675a5a718f78452db995d86617871d3910c))
* **release:** 1.0.44  adds pipeline jobs tool ([ea06c21](https://github.com/structured-world/gitlab-mcp/commit/ea06c21f298feb84e93540fa3bfb8b315562fe1f))
* **release:** 1.0.44  adds pipeline jobs tool ([4e4eb46](https://github.com/structured-world/gitlab-mcp/commit/4e4eb469c6c74c4fcdb7492f15a75f99c57e1388))
* rename ignored_files_regex to excluded_file_patterns and update descriptions for clarity ([fef3606](https://github.com/structured-world/gitlab-mcp/commit/fef360664e0577f4d5ff1238f149ee2ffcb1d471))
* rename ignored_files_regex to excluded_file_patterns and update descriptions for clarity ([159da36](https://github.com/structured-world/gitlab-mcp/commit/159da36d9c25de4b58730fd5805492b89b26faba))
* replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS ([009ad97](https://github.com/structured-world/gitlab-mcp/commit/009ad97ef74f06b58319a08fdda11253e629b077))
* replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS ([6a77b04](https://github.com/structured-world/gitlab-mcp/commit/6a77b043d64778746ea5d1976720d2df8d002ad0))
* support resolving merge request notes ([bde83c0](https://github.com/structured-world/gitlab-mcp/commit/bde83c0a912ba60026abd1954e764bb09d5a013d))
* support resolving merge request notes ([4c349a3](https://github.com/structured-world/gitlab-mcp/commit/4c349a32340f47e46e900d23231d0bada30ee4ef))
* support search by branch for get_merge_request ([20f6275](https://github.com/structured-world/gitlab-mcp/commit/20f62756c197a00f334fc8b63e2cbfe22cf99a2e))
* support search by branch for get_merge_request ([eaadf24](https://github.com/structured-world/gitlab-mcp/commit/eaadf24a1df40e281dcfff32b7e8aa66d86bea10))
* trigger workflow after fix ([435c8f1](https://github.com/structured-world/gitlab-mcp/commit/435c8f1223daeb7cbb321e7be6f63e0295cd6fb4))
* trigger workflow after fix ([40e2a5d](https://github.com/structured-world/gitlab-mcp/commit/40e2a5d835e0b8eae6a79dcd4fad61d3ff11ff3c))
* trigger workflow after jq fix ([5c67d68](https://github.com/structured-world/gitlab-mcp/commit/5c67d68be41a011014dc8315cc57d4b0bf452453))
* trigger workflow after jq fix ([116d1f4](https://github.com/structured-world/gitlab-mcp/commit/116d1f4e738ee26caba8b8fffb203e12986b862a))
* trigger workflow run ([7acdff9](https://github.com/structured-world/gitlab-mcp/commit/7acdff90ef09edc88334ddc18efc9a3c51095971))
* trigger workflow run ([c047571](https://github.com/structured-world/gitlab-mcp/commit/c0475710b9e4916a21072022c1f230e150cfab4a))
* trigger workflow with GITLAB_PERSONAL_ACCESS_TOKEN ([e967bb5](https://github.com/structured-world/gitlab-mcp/commit/e967bb51c8295b3a511273d4547e4eedcc15d38a))
* trigger workflow with GITLAB_PERSONAL_ACCESS_TOKEN ([ebec8b1](https://github.com/structured-world/gitlab-mcp/commit/ebec8b19f81a7ee19549e0cebd169bb11997b178))


### BREAKING CHANGES

* Major architectural improvements and feature additions

- Migrate to Yarn 4 with strict TypeScript configuration
- Implement comprehensive GraphQL Work Items API with 1021 tests
- Add modular entity architecture (Core, Work Items, MRS, Files, Labels, etc.)
- Implement dynamic tool registry with environment-based feature gating
- Add comprehensive integration test suite with data lifecycle management
- Enhance schema validation with case normalization and error handling
- Implement smart user search with transliteration support
- Add dual transport mode (stdio/HTTP) with automatic selection
- Implement coverage reporting and CI/CD with semantic versioning
- Add tool description customization for agentic optimization
- Implement label name-to-ID conversion for improved UX
- Add comprehensive error handling and logging infrastructure
- Migrate from REST to GraphQL for work items operations
- Add support for all GitLab Ultimate features and widgets
- Implement security enhancements and read-only mode support

Version: 4.4.0 (up from upstream 2.0.5)
Tests: 1021 comprehensive tests (877 unit + 144 integration)
Coverage: 76.69% statement coverage
Architecture: Modern TypeScript with strict mode and ESM support

# 1.0.0 (2025-09-19)


### Bug Fixes

* add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema ([5024a2a](https://github.com/structured-world/gitlab-mcp/commit/5024a2a5afb138b2fcd76407edf414bdec6a76f2))
* add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema ([d99c483](https://github.com/structured-world/gitlab-mcp/commit/d99c483ab33bdbd368d804cf68e79f008f026c41))
* add package-lock.json to .gitignore ([067586c](https://github.com/structured-world/gitlab-mcp/commit/067586c665bd81ad4695c2fbbab5582b67e77cb2))
* add package-lock.json to .gitignore ([e7e49f0](https://github.com/structured-world/gitlab-mcp/commit/e7e49f0a93c8c0d542843f4a7c2d0a7d8481b674))
* avoid error caused by line_range: null in discussion ([d50b7fd](https://github.com/structured-world/gitlab-mcp/commit/d50b7fd1ac01802889bd383e39d767378204aa66))
* avoid error caused by line_range: null in discussion ([ac2cee2](https://github.com/structured-world/gitlab-mcp/commit/ac2cee27629f5833d1251dc097742c8576e44b5a))
* Correct formatting of GITLAB_API_URL environment variable in README ([06598d7](https://github.com/structured-world/gitlab-mcp/commit/06598d7adb98b146ae2a36a2cf8bcf807f59b465))
* Correct formatting of GITLAB_API_URL environment variable in README ([83f395d](https://github.com/structured-world/gitlab-mcp/commit/83f395df0547875381da5f0ab5892e34d1ef7bf0))
* fix README ([f4b265b](https://github.com/structured-world/gitlab-mcp/commit/f4b265bf2eaca6960e28aa6b444dda25b0ed596e))
* fix README ([7323405](https://github.com/structured-world/gitlab-mcp/commit/73234055d2c3785eec03ee0f2b3c835ed741eca8))
* GitHub Actions workflow syntax errors ([6d6110c](https://github.com/structured-world/gitlab-mcp/commit/6d6110c78bcef3987799c98a9fd48241236e7cf7))
* GitHub Actions workflow syntax errors ([55d9a5e](https://github.com/structured-world/gitlab-mcp/commit/55d9a5e3103f2b9f1ff17c7c56f17c52ad3ffea4))
* improve error handling for GitLab API rate limit exceeded ([11685d7](https://github.com/structured-world/gitlab-mcp/commit/11685d7a906eade7f586af1fcd08eaf270972b5e))
* improve error handling for GitLab API rate limit exceeded ([1a30d2c](https://github.com/structured-world/gitlab-mcp/commit/1a30d2ccc3abf4a7f22b07268ec207253144815c))
* **list_issues:** add hint for scope all ([478df19](https://github.com/structured-world/gitlab-mcp/commit/478df197615ce60b475bf9f27ab6ba415e3d2f04))
* **list_issues:** add hint for scope all ([aa3b2ab](https://github.com/structured-world/gitlab-mcp/commit/aa3b2ab267da609ce0e64d67a2a0282742c3848c))
* **list_issues:** make project_id optional ([b242522](https://github.com/structured-world/gitlab-mcp/commit/b2425221a6077c7fdba343e8681d1938a24d3a39))
* **list_issues:** make project_id optional ([7cd4731](https://github.com/structured-world/gitlab-mcp/commit/7cd4731cb21b5b94161ad59264b4e0b85d641eb7))
* merge_requests_template can be null ([#79](https://github.com/structured-world/gitlab-mcp/issues/79)) ([cd8f0e5](https://github.com/structured-world/gitlab-mcp/commit/cd8f0e5525a2f570d2fcb825181ca61c2ba113af))
* merge_requests_template can be null ([#79](https://github.com/structured-world/gitlab-mcp/issues/79)) ([73fdd8f](https://github.com/structured-world/gitlab-mcp/commit/73fdd8fee70e7479bfbd8ab071119bfe07884ad6))
* remove duplicate entry for get_branch_diffs in tools list ([6bc1379](https://github.com/structured-world/gitlab-mcp/commit/6bc13794c8cfe09dafa2fddeae2d05589700cac6))
* remove duplicate entry for get_branch_diffs in tools list ([8398109](https://github.com/structured-world/gitlab-mcp/commit/839810934e8ecde7a85580405b7512074a95cb81))
* rename to source branch ([7b8cbc0](https://github.com/structured-world/gitlab-mcp/commit/7b8cbc0806ed9123e033d98f4965fd6fbc532c07))
* rename to source branch ([5baa2d1](https://github.com/structured-world/gitlab-mcp/commit/5baa2d14742372571bb857c9c3cbf8299862beff))
* **schemas:** make avatar_url nullable in GitLabUserSchema ([ab571d2](https://github.com/structured-world/gitlab-mcp/commit/ab571d211de494f116a74bb403267b10e75460a8))
* **schemas:** make avatar_url nullable in GitLabUserSchema ([3f630ca](https://github.com/structured-world/gitlab-mcp/commit/3f630cac3407de2918d58fd6202dca0b61ee44fc))
* **schemas:** make illustration nullable in GitLabPipelineSchema ([40e39d7](https://github.com/structured-world/gitlab-mcp/commit/40e39d7b36362cdadcfc8315861b08484743c5d7))
* **schemas:** make illustration nullable in GitLabPipelineSchema ([87efa04](https://github.com/structured-world/gitlab-mcp/commit/87efa045868f5344699f95bb006cd6ebf86d7f65))
* Update Docker image repository name in workflow ([b97b264](https://github.com/structured-world/gitlab-mcp/commit/b97b2642c954e6cea8d3ce0c1092d04229cfd1f9))
* Update Docker image repository name in workflow ([29ac699](https://github.com/structured-world/gitlab-mcp/commit/29ac699a4c65c0c7a707c46951fa43e633d8651f))
* Update README title and remove duplicate star history chart ([92a3e95](https://github.com/structured-world/gitlab-mcp/commit/92a3e95d38048d0f4fb26a74b2bf19d95021f0a6))
* Update README title and remove duplicate star history chart ([126fa8c](https://github.com/structured-world/gitlab-mcp/commit/126fa8c2b3d79bea63748b960d8b9f6148216017))


### Features

* add branch comparison functionality and update related schemas ([c834ebc](https://github.com/structured-world/gitlab-mcp/commit/c834ebc135bf5896ab4f7982ae417f0c32d8ea42))
* add branch comparison functionality and update related schemas ([af81bd4](https://github.com/structured-world/gitlab-mcp/commit/af81bd402aeff1a6f03afcf7853d83d89231a8fe))
* add configuration files and scripts for project setup ✨ ([5b35bc1](https://github.com/structured-world/gitlab-mcp/commit/5b35bc163c3277523fbf264523601f55103d714b))
* add configuration files and scripts for project setup ✨ ([4aac7f5](https://github.com/structured-world/gitlab-mcp/commit/4aac7f576a91b14fcf7d379c5baa13df3762ef86))
* add cookie-based authentication support for enterprise GitLab  ([#101](https://github.com/structured-world/gitlab-mcp/issues/101)) ([402f068](https://github.com/structured-world/gitlab-mcp/commit/402f06847056903058a5bf5bed0b65d81e0c5757)), closes [#100](https://github.com/structured-world/gitlab-mcp/issues/100)
* add cookie-based authentication support for enterprise GitLab  ([#101](https://github.com/structured-world/gitlab-mcp/issues/101)) ([17b8574](https://github.com/structured-world/gitlab-mcp/commit/17b85746b5c3d9fa64f7c912dbefc7fa1184c59d)), closes [#100](https://github.com/structured-world/gitlab-mcp/issues/100)
* Add create_merge_request_thread tool for diff notes ([026dd58](https://github.com/structured-world/gitlab-mcp/commit/026dd58887079bb60187d6acacaafc6fa28d0c3d))
* Add create_merge_request_thread tool for diff notes ([23b0348](https://github.com/structured-world/gitlab-mcp/commit/23b03481eacc2b32a1f4afdf5a125ca23f87bdcf))
* Add createDraftNote api support, useful for bulk code review ([5f08153](https://github.com/structured-world/gitlab-mcp/commit/5f08153da675a6fbec780329c82c6a3395f3f691))
* Add createDraftNote api support, useful for bulk code review ([73f0c48](https://github.com/structured-world/gitlab-mcp/commit/73f0c484176796e706635f4357efc24d7c5af292))
* add docker image and push to dockerhub ([6f78969](https://github.com/structured-world/gitlab-mcp/commit/6f789692be12cf9623bd5b0d1698713385f37b88))
* add docker image and push to dockerhub ([4fd7124](https://github.com/structured-world/gitlab-mcp/commit/4fd7124ef112bdc5a6eeb41ee8af891adfa322ad))
* add GITLAB_LOCK_PROJECT environment variable ([c899a7d](https://github.com/structured-world/gitlab-mcp/commit/c899a7dc3be63bbfce25a715cd3d910255604c0b))
* add GITLAB_LOCK_PROJECT environment variable ([a102e94](https://github.com/structured-world/gitlab-mcp/commit/a102e94e4020efc9f96f3fa472e0b2cc50a87615))
* add issue discussions support ([4c57c37](https://github.com/structured-world/gitlab-mcp/commit/4c57c378886bf6e3eda8f815c654fda0d29dcd44))
* add issue discussions support ([3d06892](https://github.com/structured-world/gitlab-mcp/commit/3d06892a860e8918d4a1dad56f77ee16bdd33409))
* add milestone management commands to README ([5762b32](https://github.com/structured-world/gitlab-mcp/commit/5762b32a69c3aa13ae819335ba7549be6f36722e))
* add milestone management commands to README ([bd75140](https://github.com/structured-world/gitlab-mcp/commit/bd75140e77988cbfdef628233bbe437847b22680))
* add my_issues and list_project_members tools ([a519a56](https://github.com/structured-world/gitlab-mcp/commit/a519a56493ac40b2b6ae06e3d639cacf864b53dd))
* add my_issues and list_project_members tools ([f33f330](https://github.com/structured-world/gitlab-mcp/commit/f33f330f2b5f928feb91db78adecc6bfdc2cf5ff))
* Add NPM publish workflow for automated package publishing ([#208](https://github.com/structured-world/gitlab-mcp/issues/208)) ([7e985af](https://github.com/structured-world/gitlab-mcp/commit/7e985afadf3d99fe8596d89d2ffb1c92dda6276d))
* Add NPM publish workflow for automated package publishing ([#208](https://github.com/structured-world/gitlab-mcp/issues/208)) ([5a4d416](https://github.com/structured-world/gitlab-mcp/commit/5a4d416bd73bf79e12d4d898a16da1f2fb598d1d))
* add pagination support for CI job logs to prevent context window flooding ([2905f30](https://github.com/structured-world/gitlab-mcp/commit/2905f30af7bea788be340a3b74792dcd1e305aef))
* add pagination support for CI job logs to prevent context window flooding ([f05d8bf](https://github.com/structured-world/gitlab-mcp/commit/f05d8bf75e124ccdd3263c2d6fefe56f00c3213d))
* add read-only mode support via GITLAB_READ_ONLY_MODE environment variable ([7be17b7](https://github.com/structured-world/gitlab-mcp/commit/7be17b7afcaa407e0e0cd264e887b84b2a8bb688))
* add read-only mode support via GITLAB_READ_ONLY_MODE environment variable ([916a65a](https://github.com/structured-world/gitlab-mcp/commit/916a65ae5253f8a8f83f84edf73deafe18d4960d))
* add support for creating and updating issue notes ([dc6cc59](https://github.com/structured-world/gitlab-mcp/commit/dc6cc59434a14d102a8357034cbce719142c3b0f))
* add support for creating and updating issue notes ([96d5e49](https://github.com/structured-world/gitlab-mcp/commit/96d5e49b71bad624be8c4fb3733f066f936ff6e8))
* add support for ignoring files in branch diff results using regex patterns ([75fd5e8](https://github.com/structured-world/gitlab-mcp/commit/75fd5e83e095b218cd9230e7133d4716c51ffc9a))
* add support for ignoring files in branch diff results using regex patterns ([946c49a](https://github.com/structured-world/gitlab-mcp/commit/946c49a3eaf8ea8ca5c1bc2eb52cd535a876ce58))
* add tools for milestones ([fd1c8b9](https://github.com/structured-world/gitlab-mcp/commit/fd1c8b9704473c38413aa6bac71a3899b7413657))
* add tools for milestones ([bb0da0a](https://github.com/structured-world/gitlab-mcp/commit/bb0da0a86296a17ba71569e9ef603385f6eed9a3))
* add user retrieval functions and schemas for GitLab API integration ([005b46a](https://github.com/structured-world/gitlab-mcp/commit/005b46a1a66d2d72bc922f9f98f2df2f58c5f084))
* add user retrieval functions and schemas for GitLab API integration ([440921a](https://github.com/structured-world/gitlab-mcp/commit/440921ab10f7f71e07434fb54bf2f923b5d67ff5))
* bump version to 1.0.61 🎉 ([ed032ba](https://github.com/structured-world/gitlab-mcp/commit/ed032bad48ee7a43d59d2c57e8ac1984d4d30dc8))
* bump version to 1.0.61 🎉 ([9a2bc5e](https://github.com/structured-world/gitlab-mcp/commit/9a2bc5ef4b0c909772e9e59e68e52cf803022b50))
* Decode project_id for GitLab API calls ([08ab135](https://github.com/structured-world/gitlab-mcp/commit/08ab1357a0bfdef0bf6360f0c61759f25405652b))
* Decode project_id for GitLab API calls ([95ad321](https://github.com/structured-world/gitlab-mcp/commit/95ad3211eb534ba8e482640ef38473512605f86d))
* enhance CreateMergeRequest options with assignee, reviewer, and label support ([bf369a4](https://github.com/structured-world/gitlab-mcp/commit/bf369a43dad22d0de8117c7909948f863e90e61d))
* enhance CreateMergeRequest options with assignee, reviewer, and label support ([e692ddc](https://github.com/structured-world/gitlab-mcp/commit/e692ddc54ad35fbde8c767c357b1ae4639b6cf6c))
* enhance test infrastructure and fix code quality issues ([95b3529](https://github.com/structured-world/gitlab-mcp/commit/95b3529e6af6bedfec6ecdcffc382e195b7302e0))
* get merge request default description template on project retrieval ([808c34d](https://github.com/structured-world/gitlab-mcp/commit/808c34d0ee04fd4ec95e77dce040b3a18036e347))
* get merge request default description template on project retrieval ([886faf5](https://github.com/structured-world/gitlab-mcp/commit/886faf566a9eaf6a11f349e804f4ef06828e888f))
* Gitlab list repository tree tool ([bccd5f2](https://github.com/structured-world/gitlab-mcp/commit/bccd5f29c398a994de29e4b01fdf14cd6f6cf55c))
* Gitlab list repository tree tool ([58f51a4](https://github.com/structured-world/gitlab-mcp/commit/58f51a43e61547e3687e56d5cddb381c13297229))
* Implement add_merge_request_thread_note function for adding notes to existing MR threads ([3f2b355](https://github.com/structured-world/gitlab-mcp/commit/3f2b35535ee93b14a6649074608842d1ff8de208))
* Implement add_merge_request_thread_note function for adding notes to existing MR threads ([5f9aecd](https://github.com/structured-world/gitlab-mcp/commit/5f9aecdf21bd83a3b3928e32cec5d503809e88ad))
* implement comprehensive GitLab MCP enhancements v4.4.0 ([60fd9d8](https://github.com/structured-world/gitlab-mcp/commit/60fd9d89a93abe3fc81beb30992cc2848b7f954c))
* implement list_merge_requests functionality ([cc84777](https://github.com/structured-world/gitlab-mcp/commit/cc847772f1f8560d9ce9cba25acbb232cbbf618d))
* implement list_merge_requests functionality ([6acecd2](https://github.com/structured-world/gitlab-mcp/commit/6acecd290d1820f4d24aa719b2f845551a05c51b))
* Implement proxy configuration for HTTP/HTTPS/SOCKS ([7c2578f](https://github.com/structured-world/gitlab-mcp/commit/7c2578fd4ba140242b5f00a792a97488263cd3fc))
* Implement proxy configuration for HTTP/HTTPS/SOCKS ([94b206f](https://github.com/structured-world/gitlab-mcp/commit/94b206f72f888e53a838f64349a43449d5eaaada))
* **pipeline:** Add list_pipeline_trigger_jobs tools ([56a53b3](https://github.com/structured-world/gitlab-mcp/commit/56a53b3ab9930ca51e1e080805c402b7baa1b1a0))
* **pipeline:** Add list_pipeline_trigger_jobs tools ([0006e67](https://github.com/structured-world/gitlab-mcp/commit/0006e675a5a718f78452db995d86617871d3910c))
* **release:** 1.0.44  adds pipeline jobs tool ([ea06c21](https://github.com/structured-world/gitlab-mcp/commit/ea06c21f298feb84e93540fa3bfb8b315562fe1f))
* **release:** 1.0.44  adds pipeline jobs tool ([4e4eb46](https://github.com/structured-world/gitlab-mcp/commit/4e4eb469c6c74c4fcdb7492f15a75f99c57e1388))
* rename ignored_files_regex to excluded_file_patterns and update descriptions for clarity ([fef3606](https://github.com/structured-world/gitlab-mcp/commit/fef360664e0577f4d5ff1238f149ee2ffcb1d471))
* rename ignored_files_regex to excluded_file_patterns and update descriptions for clarity ([159da36](https://github.com/structured-world/gitlab-mcp/commit/159da36d9c25de4b58730fd5805492b89b26faba))
* replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS ([009ad97](https://github.com/structured-world/gitlab-mcp/commit/009ad97ef74f06b58319a08fdda11253e629b077))
* replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS ([6a77b04](https://github.com/structured-world/gitlab-mcp/commit/6a77b043d64778746ea5d1976720d2df8d002ad0))
* support resolving merge request notes ([bde83c0](https://github.com/structured-world/gitlab-mcp/commit/bde83c0a912ba60026abd1954e764bb09d5a013d))
* support resolving merge request notes ([4c349a3](https://github.com/structured-world/gitlab-mcp/commit/4c349a32340f47e46e900d23231d0bada30ee4ef))
* support search by branch for get_merge_request ([20f6275](https://github.com/structured-world/gitlab-mcp/commit/20f62756c197a00f334fc8b63e2cbfe22cf99a2e))
* support search by branch for get_merge_request ([eaadf24](https://github.com/structured-world/gitlab-mcp/commit/eaadf24a1df40e281dcfff32b7e8aa66d86bea10))
* trigger workflow after fix ([435c8f1](https://github.com/structured-world/gitlab-mcp/commit/435c8f1223daeb7cbb321e7be6f63e0295cd6fb4))
* trigger workflow after fix ([40e2a5d](https://github.com/structured-world/gitlab-mcp/commit/40e2a5d835e0b8eae6a79dcd4fad61d3ff11ff3c))
* trigger workflow after jq fix ([5c67d68](https://github.com/structured-world/gitlab-mcp/commit/5c67d68be41a011014dc8315cc57d4b0bf452453))
* trigger workflow after jq fix ([116d1f4](https://github.com/structured-world/gitlab-mcp/commit/116d1f4e738ee26caba8b8fffb203e12986b862a))
* trigger workflow run ([7acdff9](https://github.com/structured-world/gitlab-mcp/commit/7acdff90ef09edc88334ddc18efc9a3c51095971))
* trigger workflow run ([c047571](https://github.com/structured-world/gitlab-mcp/commit/c0475710b9e4916a21072022c1f230e150cfab4a))
* trigger workflow with GITLAB_PERSONAL_ACCESS_TOKEN ([e967bb5](https://github.com/structured-world/gitlab-mcp/commit/e967bb51c8295b3a511273d4547e4eedcc15d38a))
* trigger workflow with GITLAB_PERSONAL_ACCESS_TOKEN ([ebec8b1](https://github.com/structured-world/gitlab-mcp/commit/ebec8b19f81a7ee19549e0cebd169bb11997b178))


### BREAKING CHANGES

* Major architectural improvements and feature additions

- Migrate to Yarn 4 with strict TypeScript configuration
- Implement comprehensive GraphQL Work Items API with 1021 tests
- Add modular entity architecture (Core, Work Items, MRS, Files, Labels, etc.)
- Implement dynamic tool registry with environment-based feature gating
- Add comprehensive integration test suite with data lifecycle management
- Enhance schema validation with case normalization and error handling
- Implement smart user search with transliteration support
- Add dual transport mode (stdio/HTTP) with automatic selection
- Implement coverage reporting and CI/CD with semantic versioning
- Add tool description customization for agentic optimization
- Implement label name-to-ID conversion for improved UX
- Add comprehensive error handling and logging infrastructure
- Migrate from REST to GraphQL for work items operations
- Add support for all GitLab Ultimate features and widgets
- Implement security enhancements and read-only mode support

Version: 4.4.0 (up from upstream 2.0.5)
Tests: 1021 comprehensive tests (877 unit + 144 integration)
Coverage: 76.69% statement coverage
Architecture: Modern TypeScript with strict mode and ESM support

# [4.4.0](https://github.com/structured-world/gitlab-mcp/compare/v4.3.3...v4.4.0) (2025-09-18)


### Features

* **workitems:** enhance agentic label workflow guidance and case-insensitive type handling ([ac6d970](https://github.com/structured-world/gitlab-mcp/commit/ac6d9702e047f828dcb7961c7d9c2ff4e7f0c35c))

## [4.3.3](https://github.com/structured-world/gitlab-mcp/compare/v4.3.2...v4.3.3) (2025-09-18)


### Bug Fixes

* **workitems:** resolve critical widget and assignee bugs in work item operations ([9b4c830](https://github.com/structured-world/gitlab-mcp/commit/9b4c8301ab48bb816a5052ec24af075d6248c798))

## [4.3.2](https://github.com/structured-world/gitlab-mcp/compare/v4.3.1...v4.3.2) (2025-09-18)


### Bug Fixes

* improve TypeScript typing and eliminate unnecessary ESLint disables ([6b82412](https://github.com/structured-world/gitlab-mcp/commit/6b82412fd33ee3b25c9ec9f1b400047cfe9dff05))

## [4.3.1](https://github.com/structured-world/gitlab-mcp/compare/v4.3.0...v4.3.1) (2025-09-17)


### Bug Fixes

* enhance search_repositories with operator parsing and test coverage ([fbc61d5](https://github.com/structured-world/gitlab-mcp/commit/fbc61d579971f6b74c00dcbecfda2ba1be640a14))

# [4.3.0](https://github.com/structured-world/gitlab-mcp/compare/v4.2.1...v4.3.0) (2025-09-17)


### Features

* optimize work items performance with parallel execution and simplification ([3fda75c](https://github.com/structured-world/gitlab-mcp/commit/3fda75c1525a84e1230ddbbb075df7c9bf8672d0))

## [4.2.1](https://github.com/structured-world/gitlab-mcp/compare/v4.2.0...v4.2.1) (2025-09-17)


### Bug Fixes

* improve work items registry with unified strategy and enhance test coverage ([ec5f139](https://github.com/structured-world/gitlab-mcp/commit/ec5f139d7041194e00b03ae03796b8f52ada22d5))

# [4.2.0](https://github.com/structured-world/gitlab-mcp/compare/v4.1.1...v4.2.0) (2025-09-17)


### Bug Fixes

* update unit tests for dual transport mode architecture ([a70a726](https://github.com/structured-world/gitlab-mcp/commit/a70a726a50acefc74b2f6c5f910d052092880648))


### Features

* implement PORT-based transport mode selection with dual endpoints ([8a42e67](https://github.com/structured-world/gitlab-mcp/commit/8a42e67e27f4f0e86622edb41461e6fd7cffb560))
* implement smart user search with pattern detection and transliteration ([50b7c5e](https://github.com/structured-world/gitlab-mcp/commit/50b7c5e0a4762c9c8565ffa93c3ea6795ad7ad6a))

## [4.1.1](https://github.com/structured-world/gitlab-mcp/compare/v4.1.0...v4.1.1) (2025-09-17)


### Bug Fixes

* improve dual environment testing support and code quality ([55588a3](https://github.com/structured-world/gitlab-mcp/commit/55588a300561fbc2ce7d375c2e592b763a8728f2))
* resolve unit test failures by adding namespace detection mocks ([b856d46](https://github.com/structured-world/gitlab-mcp/commit/b856d460058fbbcc320e3c6883c215db773e20dd))

# [4.1.0](https://github.com/structured-world/gitlab-mcp/compare/v4.0.0...v4.1.0) (2025-09-17)


### Features

* add missing 'active' parameter to list_projects schema and fix dual environment testing ([1f56e33](https://github.com/structured-world/gitlab-mcp/commit/1f56e33923ce2c5f95f6d48128c768cc5a1ee16a))

# [4.0.0](https://github.com/structured-world/gitlab-mcp/compare/v3.2.0...v4.0.0) (2025-09-16)


* feat!: rename package to @structured-world/gitlab-mcp ([3849c3e](https://github.com/structured-world/gitlab-mcp/commit/3849c3e70bb35510720c1fe75f0c67342473a6d8))


### BREAKING CHANGES

* The package and Docker image names have changed to
@structured-world/gitlab-mcp and ghcr.io/structured-world/gitlab-mcp
respectively. Update your configurations accordingly.

# [3.2.0](https://github.com/structured-world/gitlab-mcp/compare/v3.1.2...v3.2.0) (2025-09-16)


### Features

* improve unit test coverage from 86% to 90.65% ([a853967](https://github.com/structured-world/gitlab-mcp/commit/a853967402fc3aa6ff92439158bfed1042f5cea3))

## [3.1.2](https://github.com/structured-world/gitlab-mcp/compare/v3.1.1...v3.1.2) (2025-09-16)


### Bug Fixes

* align workitems test parameter names with GitLab API schema ([950e0eb](https://github.com/structured-world/gitlab-mcp/commit/950e0eb59a7f88a4c0d88eff3094d23d54874df3))
* improve test infrastructure for cross-platform compatibility ([5eb62c0](https://github.com/structured-world/gitlab-mcp/commit/5eb62c05ccfdeec77239f1c7c7b04189956be667))

## [3.1.1](https://github.com/structured-world/gitlab-mcp/compare/v3.1.0...v3.1.1) (2025-09-16)


### Bug Fixes

* implement per-file mock isolation for parallel unit tests ([7839d0c](https://github.com/structured-world/gitlab-mcp/commit/7839d0ce271ce7d9bb29aad264770aa41e15feea))
* resolve test module loading and improve test infrastructure ([0da17ff](https://github.com/structured-world/gitlab-mcp/commit/0da17ff57779b493e3d7e428d1d757c5653d1b61))

# [3.1.0](https://github.com/structured-world/gitlab-mcp/compare/v3.0.0...v3.1.0) (2025-09-16)


### Bug Fixes

* improve error handling and logging consistency ([96d962e](https://github.com/structured-world/gitlab-mcp/commit/96d962e668147318a26bdc8bd133c5f94d56580a))


### Features

* enhance GitLab API schema compliance and validation ([55f90b3](https://github.com/structured-world/gitlab-mcp/commit/55f90b3339e6c5cc158f4cb3d24355ceab8edb0f))

# [3.0.0](https://github.com/structured-world/gitlab-mcp/compare/v2.8.0...v3.0.0) (2025-09-16)


### Bug Fixes

* convert work items registry to use GraphQL API instead of REST ([75f9161](https://github.com/structured-world/gitlab-mcp/commit/75f91616a177329b763136367f5ca464c7bbff4f))
* resolve GraphQL WorkItemWidgetVulnerabilities schema error ([99b7794](https://github.com/structured-world/gitlab-mcp/commit/99b7794edd81cad3dea1bb784854dab39066b1b2))


### Features

* add subgroup creation with epic hierarchy and parent relationships ([6cf3e24](https://github.com/structured-world/gitlab-mcp/commit/6cf3e2476d739d53fa317db49f18ae54762f4cbf))
* Complete integration test migration to handler functions ([3a16c50](https://github.com/structured-world/gitlab-mcp/commit/3a16c500d7b398c0f60267cbc670a5dd0cdbadaf))
* migrate integration tests to use handler functions and fix registry initialization ([a818c7f](https://github.com/structured-world/gitlab-mcp/commit/a818c7f1e3c28c1eedfd677dc3dae9e4c7c206b3))
* migrate work items to GraphQL-only with dynamic type discovery and widget support ([ace59c5](https://github.com/structured-world/gitlab-mcp/commit/ace59c55f74d38105fa5c1c46ac24727080da80d))


### BREAKING CHANGES

* Work items now use GraphQL API exclusively, no REST fallback

# [2.8.0](https://github.com/structured-world/gitlab-mcp/compare/v2.7.0...v2.8.0) (2025-09-15)


### Features

* implement dynamic tool description customization via environment variables ([e28dcd9](https://github.com/structured-world/gitlab-mcp/commit/e28dcd913bd8b518e5cedb84482b6c3e5442ecc9))

# [2.7.0](https://github.com/structured-world/gitlab-mcp/compare/v2.6.2...v2.7.0) (2025-09-15)


### Features

* implement fully dynamic tool registry system with enhanced security ([2c4fe5a](https://github.com/structured-world/gitlab-mcp/commit/2c4fe5a85710aa980c1ced9eeaddc60cf87c01d4))

## [2.6.2](https://github.com/structured-world/gitlab-mcp/compare/v2.6.1...v2.6.2) (2025-09-15)


### Bug Fixes

* Complete unit test infrastructure rewrite and test suite fixes ([05b3f02](https://github.com/structured-world/gitlab-mcp/commit/05b3f024709ec33365cadb5401a47ac154048a59))

## [2.6.1](https://github.com/structured-world/gitlab-mcp/compare/v2.6.0...v2.6.1) (2025-09-15)


### Bug Fixes

* correct FUNDING.yml format according to GitHub documentation ([071ff87](https://github.com/structured-world/gitlab-mcp/commit/071ff879f324f9e0386912050132cb6c7fe581fe))

# [2.6.0](https://github.com/structured-world/gitlab-mcp/compare/v2.5.1...v2.6.0) (2025-09-15)


### Features

* enhance Labels, Milestones, and Wiki entities with dual project/group scope support ([6e406e6](https://github.com/structured-world/gitlab-mcp/commit/6e406e6d50de66770d9614407e589ff4895533fb))

## [2.5.1](https://github.com/structured-world/gitlab-mcp/compare/v2.5.0...v2.5.1) (2025-09-15)


### Bug Fixes

* correct GetUsersSchema validation test expectations ([50b7e04](https://github.com/structured-world/gitlab-mcp/commit/50b7e04512517ca715736d305f2dbb14a5688a81))

# [2.5.0](https://github.com/structured-world/gitlab-mcp/compare/v2.4.0...v2.5.0) (2025-09-15)


### Features

* complete GitLab MCP handler implementation with 100% tool coverage ([843886a](https://github.com/structured-world/gitlab-mcp/commit/843886a7f0b744223e3f44344314ce4441f46a8d))

# [2.4.0](https://github.com/structured-world/gitlab-mcp/compare/v2.3.1...v2.4.0) (2025-09-15)


### Features

* implement dynamic tool handler dispatch system ([5bfe1c3](https://github.com/structured-world/gitlab-mcp/commit/5bfe1c33b8d02f7705a4bf33c583691b44708e59))

## [2.3.1](https://github.com/structured-world/gitlab-mcp/compare/v2.3.0...v2.3.1) (2025-09-15)


### Bug Fixes

* **sse:** implement missing SSE transport and fix schema validation ([e6aed28](https://github.com/structured-world/gitlab-mcp/commit/e6aed2848ec0b48e18d96935557d3a5cf9a92f90))

# [2.3.0](https://github.com/structured-world/gitlab-mcp/compare/v2.2.0...v2.3.0) (2025-09-15)


### Features

* **test:** add user infrastructure setup and assignment to test data lifecycle ([e88f5bb](https://github.com/structured-world/gitlab-mcp/commit/e88f5bb048c8d40d83edeb2fbb2c171906e503b5))

# [2.2.0](https://github.com/structured-world/gitlab-mcp/compare/v2.1.2...v2.2.0) (2025-09-15)


### Bug Fixes

* add esModuleInterop for Zod v4 compatibility ([e3010bb](https://github.com/structured-world/gitlab-mcp/commit/e3010bbe02e03091e07b1774d1ef7a0437b80e8f))
* Docker build and test cleanup improvements ([79a7d9e](https://github.com/structured-world/gitlab-mcp/commit/79a7d9e58508bc2ece922dbd5852b2e15a894599))
* prevent Yarn re-download in Docker build stages ([5807776](https://github.com/structured-world/gitlab-mcp/commit/5807776c704dbe7490469723db314e7e8a99f7e9))
* Resolve critical test infrastructure issues and eliminate soft-fail patterns ([528d34c](https://github.com/structured-world/gitlab-mcp/commit/528d34c0e6fbd0ae5da584878f3c2f68bfff19cf))
* resolve data lifecycle test dependency chain issues ([282ac42](https://github.com/structured-world/gitlab-mcp/commit/282ac42de91e74a98cca2b038ca4a284dbdf8e42))
* resolve TypeScript/ESLint errors in GraphQL introspection code ([f50ea1a](https://github.com/structured-world/gitlab-mcp/commit/f50ea1a367d7e0741817167cc52d7ab673145fe3))


### Features

* reorganize integration tests into dependency chain pattern ([6d8c05e](https://github.com/structured-world/gitlab-mcp/commit/6d8c05e84a5fb8daa30084073cb5905b62a2dbeb))
* **test:** add user infrastructure setup and assignment to test data lifecycle ([3915773](https://github.com/structured-world/gitlab-mcp/commit/39157736cb01791e7e0e4c18c1d7610b28422731))

## [2.1.2](https://github.com/structured-world/gitlab-mcp/compare/v2.1.1...v2.1.2) (2025-09-15)


### Bug Fixes

* remove duplicate docker-publish.yml workflow ([a9a6921](https://github.com/structured-world/gitlab-mcp/commit/a9a692186c1c7db18217a82c387a7fe00536d694))
* remove duplicate release.yml workflow to prevent concurrent releases ([b69fc9d](https://github.com/structured-world/gitlab-mcp/commit/b69fc9d1b78b674b5991d974c376d7080f83ae34))

## [1.1.1](https://github.com/structured-world/gitlab-mcp/compare/v1.1.0...v1.1.1) (2025-09-15)


### Bug Fixes

* enable Corepack in GitHub Actions for Yarn 4 support ([7e170e2](https://github.com/structured-world/gitlab-mcp/commit/7e170e2f186fae60e0b10924261f1fd67ded0a0b))

# [1.1.0](https://github.com/structured-world/gitlab-mcp/compare/v1.0.2...v1.1.0) (2025-09-15)


### Features

* add comprehensive CI/CD pipeline with semantic versioning ([4e6822f](https://github.com/structured-world/gitlab-mcp/commit/4e6822ff865fb2045bfeeb015891e4281cc6c26e))

## [1.0.2](https://github.com/structured-world/gitlab-mcp/compare/v1.0.1...v1.0.2) (2025-09-15)


### Bug Fixes

* correct Docker build configuration for production deployment ([d9b089f](https://github.com/structured-world/gitlab-mcp/commit/d9b089f6c76fda01bd19e96997fa99e37602aec3))

## [1.0.1](https://github.com/structured-world/gitlab-mcp/compare/v1.0.0...v1.0.1) (2025-09-15)


### Bug Fixes

* Add repository field to package.json for npm publish ([a405435](https://github.com/structured-world/gitlab-mcp/commit/a405435432a0b31569bd8c78840c453d5bfa2ee9))

# 1.0.0 (2025-09-15)


### Bug Fixes

* add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema ([5024a2a](https://github.com/structured-world/gitlab-mcp/commit/5024a2a5afb138b2fcd76407edf414bdec6a76f2))
* add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema ([d99c483](https://github.com/structured-world/gitlab-mcp/commit/d99c483ab33bdbd368d804cf68e79f008f026c41))
* add missing @eslint/js dependency ([cd85a8d](https://github.com/structured-world/gitlab-mcp/commit/cd85a8dff086f3202f64c55f9d1a14ef823f2a80))
* add package-lock.json to .gitignore ([067586c](https://github.com/structured-world/gitlab-mcp/commit/067586c665bd81ad4695c2fbbab5582b67e77cb2))
* add package-lock.json to .gitignore ([e7e49f0](https://github.com/structured-world/gitlab-mcp/commit/e7e49f0a93c8c0d542843f4a7c2d0a7d8481b674))
* avoid error caused by line_range: null in discussion ([d50b7fd](https://github.com/structured-world/gitlab-mcp/commit/d50b7fd1ac01802889bd383e39d767378204aa66))
* avoid error caused by line_range: null in discussion ([ac2cee2](https://github.com/structured-world/gitlab-mcp/commit/ac2cee27629f5833d1251dc097742c8576e44b5a))
* Correct formatting of GITLAB_API_URL environment variable in README ([06598d7](https://github.com/structured-world/gitlab-mcp/commit/06598d7adb98b146ae2a36a2cf8bcf807f59b465))
* Correct formatting of GITLAB_API_URL environment variable in README ([83f395d](https://github.com/structured-world/gitlab-mcp/commit/83f395df0547875381da5f0ab5892e34d1ef7bf0))
* Fix build errors and optimize Docker build ([ee60995](https://github.com/structured-world/gitlab-mcp/commit/ee60995ad4e0e1a64801fdb17a80279b5d5ca643))
* fix README ([f4b265b](https://github.com/structured-world/gitlab-mcp/commit/f4b265bf2eaca6960e28aa6b444dda25b0ed596e))
* fix README ([7323405](https://github.com/structured-world/gitlab-mcp/commit/73234055d2c3785eec03ee0f2b3c835ed741eca8))
* GitHub Actions workflow syntax errors ([6d6110c](https://github.com/structured-world/gitlab-mcp/commit/6d6110c78bcef3987799c98a9fd48241236e7cf7))
* GitHub Actions workflow syntax errors ([55d9a5e](https://github.com/structured-world/gitlab-mcp/commit/55d9a5e3103f2b9f1ff17c7c56f17c52ad3ffea4))
* improve error handling for GitLab API rate limit exceeded ([11685d7](https://github.com/structured-world/gitlab-mcp/commit/11685d7a906eade7f586af1fcd08eaf270972b5e))
* improve error handling for GitLab API rate limit exceeded ([1a30d2c](https://github.com/structured-world/gitlab-mcp/commit/1a30d2ccc3abf4a7f22b07268ec207253144815c))
* **list_issues:** add hint for scope all ([478df19](https://github.com/structured-world/gitlab-mcp/commit/478df197615ce60b475bf9f27ab6ba415e3d2f04))
* **list_issues:** add hint for scope all ([aa3b2ab](https://github.com/structured-world/gitlab-mcp/commit/aa3b2ab267da609ce0e64d67a2a0282742c3848c))
* **list_issues:** make project_id optional ([b242522](https://github.com/structured-world/gitlab-mcp/commit/b2425221a6077c7fdba343e8681d1938a24d3a39))
* **list_issues:** make project_id optional ([7cd4731](https://github.com/structured-world/gitlab-mcp/commit/7cd4731cb21b5b94161ad59264b4e0b85d641eb7))
* merge_requests_template can be null ([#79](https://github.com/structured-world/gitlab-mcp/issues/79)) ([cd8f0e5](https://github.com/structured-world/gitlab-mcp/commit/cd8f0e5525a2f570d2fcb825181ca61c2ba113af))
* merge_requests_template can be null ([#79](https://github.com/structured-world/gitlab-mcp/issues/79)) ([73fdd8f](https://github.com/structured-world/gitlab-mcp/commit/73fdd8fee70e7479bfbd8ab071119bfe07884ad6))
* Remove deprecated create_issue tool and update ESLint configuration ([b9737ef](https://github.com/structured-world/gitlab-mcp/commit/b9737efd3f45eb2ddf8744f31c4b5a9ac10a5cbe))
* remove duplicate entry for get_branch_diffs in tools list ([6bc1379](https://github.com/structured-world/gitlab-mcp/commit/6bc13794c8cfe09dafa2fddeae2d05589700cac6))
* remove duplicate entry for get_branch_diffs in tools list ([8398109](https://github.com/structured-world/gitlab-mcp/commit/839810934e8ecde7a85580405b7512074a95cb81))
* rename to source branch ([7b8cbc0](https://github.com/structured-world/gitlab-mcp/commit/7b8cbc0806ed9123e033d98f4965fd6fbc532c07))
* rename to source branch ([5baa2d1](https://github.com/structured-world/gitlab-mcp/commit/5baa2d14742372571bb857c9c3cbf8299862beff))
* **schemas:** make avatar_url nullable in GitLabUserSchema ([ab571d2](https://github.com/structured-world/gitlab-mcp/commit/ab571d211de494f116a74bb403267b10e75460a8))
* **schemas:** make avatar_url nullable in GitLabUserSchema ([3f630ca](https://github.com/structured-world/gitlab-mcp/commit/3f630cac3407de2918d58fd6202dca0b61ee44fc))
* **schemas:** make illustration nullable in GitLabPipelineSchema ([40e39d7](https://github.com/structured-world/gitlab-mcp/commit/40e39d7b36362cdadcfc8315861b08484743c5d7))
* **schemas:** make illustration nullable in GitLabPipelineSchema ([87efa04](https://github.com/structured-world/gitlab-mcp/commit/87efa045868f5344699f95bb006cd6ebf86d7f65))
* temporarily disable lint in CI to fix release process ([d552d06](https://github.com/structured-world/gitlab-mcp/commit/d552d06d6489c3990e22e7217f3b018146fba5b1))
* Update Docker image repository name in workflow ([b97b264](https://github.com/structured-world/gitlab-mcp/commit/b97b2642c954e6cea8d3ce0c1092d04229cfd1f9))
* Update Docker image repository name in workflow ([29ac699](https://github.com/structured-world/gitlab-mcp/commit/29ac699a4c65c0c7a707c46951fa43e633d8651f))
* Update README title and remove duplicate star history chart ([92a3e95](https://github.com/structured-world/gitlab-mcp/commit/92a3e95d38048d0f4fb26a74b2bf19d95021f0a6))
* Update README title and remove duplicate star history chart ([126fa8c](https://github.com/structured-world/gitlab-mcp/commit/126fa8c2b3d79bea63748b960d8b9f6148216017))


### Features

* add branch comparison functionality and update related schemas ([c834ebc](https://github.com/structured-world/gitlab-mcp/commit/c834ebc135bf5896ab4f7982ae417f0c32d8ea42))
* add branch comparison functionality and update related schemas ([af81bd4](https://github.com/structured-world/gitlab-mcp/commit/af81bd402aeff1a6f03afcf7853d83d89231a8fe))
* add configuration files and scripts for project setup ✨ ([5b35bc1](https://github.com/structured-world/gitlab-mcp/commit/5b35bc163c3277523fbf264523601f55103d714b))
* add configuration files and scripts for project setup ✨ ([4aac7f5](https://github.com/structured-world/gitlab-mcp/commit/4aac7f576a91b14fcf7d379c5baa13df3762ef86))
* add cookie-based authentication support for enterprise GitLab  ([#101](https://github.com/structured-world/gitlab-mcp/issues/101)) ([402f068](https://github.com/structured-world/gitlab-mcp/commit/402f06847056903058a5bf5bed0b65d81e0c5757)), closes [#100](https://github.com/structured-world/gitlab-mcp/issues/100)
* add cookie-based authentication support for enterprise GitLab  ([#101](https://github.com/structured-world/gitlab-mcp/issues/101)) ([17b8574](https://github.com/structured-world/gitlab-mcp/commit/17b85746b5c3d9fa64f7c912dbefc7fa1184c59d)), closes [#100](https://github.com/structured-world/gitlab-mcp/issues/100)
* Add create_merge_request_thread tool for diff notes ([026dd58](https://github.com/structured-world/gitlab-mcp/commit/026dd58887079bb60187d6acacaafc6fa28d0c3d))
* Add create_merge_request_thread tool for diff notes ([23b0348](https://github.com/structured-world/gitlab-mcp/commit/23b03481eacc2b32a1f4afdf5a125ca23f87bdcf))
* Add createDraftNote api support, useful for bulk code review ([5f08153](https://github.com/structured-world/gitlab-mcp/commit/5f08153da675a6fbec780329c82c6a3395f3f691))
* Add createDraftNote api support, useful for bulk code review ([73f0c48](https://github.com/structured-world/gitlab-mcp/commit/73f0c484176796e706635f4357efc24d7c5af292))
* add docker image and push to dockerhub ([6f78969](https://github.com/structured-world/gitlab-mcp/commit/6f789692be12cf9623bd5b0d1698713385f37b88))
* add docker image and push to dockerhub ([4fd7124](https://github.com/structured-world/gitlab-mcp/commit/4fd7124ef112bdc5a6eeb41ee8af891adfa322ad))
* add GITLAB_LOCK_PROJECT environment variable ([c899a7d](https://github.com/structured-world/gitlab-mcp/commit/c899a7dc3be63bbfce25a715cd3d910255604c0b))
* add GITLAB_LOCK_PROJECT environment variable ([a102e94](https://github.com/structured-world/gitlab-mcp/commit/a102e94e4020efc9f96f3fa472e0b2cc50a87615))
* add issue discussions support ([4c57c37](https://github.com/structured-world/gitlab-mcp/commit/4c57c378886bf6e3eda8f815c654fda0d29dcd44))
* add issue discussions support ([3d06892](https://github.com/structured-world/gitlab-mcp/commit/3d06892a860e8918d4a1dad56f77ee16bdd33409))
* add milestone management commands to README ([5762b32](https://github.com/structured-world/gitlab-mcp/commit/5762b32a69c3aa13ae819335ba7549be6f36722e))
* add milestone management commands to README ([bd75140](https://github.com/structured-world/gitlab-mcp/commit/bd75140e77988cbfdef628233bbe437847b22680))
* add my_issues and list_project_members tools ([a519a56](https://github.com/structured-world/gitlab-mcp/commit/a519a56493ac40b2b6ae06e3d639cacf864b53dd))
* add my_issues and list_project_members tools ([f33f330](https://github.com/structured-world/gitlab-mcp/commit/f33f330f2b5f928feb91db78adecc6bfdc2cf5ff))
* Add NPM publish workflow for automated package publishing ([#208](https://github.com/structured-world/gitlab-mcp/issues/208)) ([7e985af](https://github.com/structured-world/gitlab-mcp/commit/7e985afadf3d99fe8596d89d2ffb1c92dda6276d))
* Add NPM publish workflow for automated package publishing ([#208](https://github.com/structured-world/gitlab-mcp/issues/208)) ([5a4d416](https://github.com/structured-world/gitlab-mcp/commit/5a4d416bd73bf79e12d4d898a16da1f2fb598d1d))
* add pagination support for CI job logs to prevent context window flooding ([2905f30](https://github.com/structured-world/gitlab-mcp/commit/2905f30af7bea788be340a3b74792dcd1e305aef))
* add pagination support for CI job logs to prevent context window flooding ([f05d8bf](https://github.com/structured-world/gitlab-mcp/commit/f05d8bf75e124ccdd3263c2d6fefe56f00c3213d))
* add read-only mode support via GITLAB_READ_ONLY_MODE environment variable ([7be17b7](https://github.com/structured-world/gitlab-mcp/commit/7be17b7afcaa407e0e0cd264e887b84b2a8bb688))
* add read-only mode support via GITLAB_READ_ONLY_MODE environment variable ([916a65a](https://github.com/structured-world/gitlab-mcp/commit/916a65ae5253f8a8f83f84edf73deafe18d4960d))
* add support for creating and updating issue notes ([dc6cc59](https://github.com/structured-world/gitlab-mcp/commit/dc6cc59434a14d102a8357034cbce719142c3b0f))
* add support for creating and updating issue notes ([96d5e49](https://github.com/structured-world/gitlab-mcp/commit/96d5e49b71bad624be8c4fb3733f066f936ff6e8))
* add support for ignoring files in branch diff results using regex patterns ([75fd5e8](https://github.com/structured-world/gitlab-mcp/commit/75fd5e83e095b218cd9230e7133d4716c51ffc9a))
* add support for ignoring files in branch diff results using regex patterns ([946c49a](https://github.com/structured-world/gitlab-mcp/commit/946c49a3eaf8ea8ca5c1bc2eb52cd535a876ce58))
* add tools for milestones ([fd1c8b9](https://github.com/structured-world/gitlab-mcp/commit/fd1c8b9704473c38413aa6bac71a3899b7413657))
* add tools for milestones ([bb0da0a](https://github.com/structured-world/gitlab-mcp/commit/bb0da0a86296a17ba71569e9ef603385f6eed9a3))
* add user retrieval functions and schemas for GitLab API integration ([005b46a](https://github.com/structured-world/gitlab-mcp/commit/005b46a1a66d2d72bc922f9f98f2df2f58c5f084))
* add user retrieval functions and schemas for GitLab API integration ([440921a](https://github.com/structured-world/gitlab-mcp/commit/440921ab10f7f71e07434fb54bf2f923b5d67ff5))
* bump version to 1.0.61 🎉 ([ed032ba](https://github.com/structured-world/gitlab-mcp/commit/ed032bad48ee7a43d59d2c57e8ac1984d4d30dc8))
* bump version to 1.0.61 🎉 ([9a2bc5e](https://github.com/structured-world/gitlab-mcp/commit/9a2bc5ef4b0c909772e9e59e68e52cf803022b50))
* Decode project_id for GitLab API calls ([08ab135](https://github.com/structured-world/gitlab-mcp/commit/08ab1357a0bfdef0bf6360f0c61759f25405652b))
* Decode project_id for GitLab API calls ([95ad321](https://github.com/structured-world/gitlab-mcp/commit/95ad3211eb534ba8e482640ef38473512605f86d))
* enhance CreateMergeRequest options with assignee, reviewer, and label support ([bf369a4](https://github.com/structured-world/gitlab-mcp/commit/bf369a43dad22d0de8117c7909948f863e90e61d))
* enhance CreateMergeRequest options with assignee, reviewer, and label support ([e692ddc](https://github.com/structured-world/gitlab-mcp/commit/e692ddc54ad35fbde8c767c357b1ae4639b6cf6c))
* get merge request default description template on project retrieval ([808c34d](https://github.com/structured-world/gitlab-mcp/commit/808c34d0ee04fd4ec95e77dce040b3a18036e347))
* get merge request default description template on project retrieval ([886faf5](https://github.com/structured-world/gitlab-mcp/commit/886faf566a9eaf6a11f349e804f4ef06828e888f))
* Gitlab list repository tree tool ([bccd5f2](https://github.com/structured-world/gitlab-mcp/commit/bccd5f29c398a994de29e4b01fdf14cd6f6cf55c))
* Gitlab list repository tree tool ([58f51a4](https://github.com/structured-world/gitlab-mcp/commit/58f51a43e61547e3687e56d5cddb381c13297229))
* Implement add_merge_request_thread_note function for adding notes to existing MR threads ([3f2b355](https://github.com/structured-world/gitlab-mcp/commit/3f2b35535ee93b14a6649074608842d1ff8de208))
* Implement add_merge_request_thread_note function for adding notes to existing MR threads ([5f9aecd](https://github.com/structured-world/gitlab-mcp/commit/5f9aecdf21bd83a3b3928e32cec5d503809e88ad))
* implement list_merge_requests functionality ([cc84777](https://github.com/structured-world/gitlab-mcp/commit/cc847772f1f8560d9ce9cba25acbb232cbbf618d))
* implement list_merge_requests functionality ([6acecd2](https://github.com/structured-world/gitlab-mcp/commit/6acecd290d1820f4d24aa719b2f845551a05c51b))
* Implement proxy configuration for HTTP/HTTPS/SOCKS ([7c2578f](https://github.com/structured-world/gitlab-mcp/commit/7c2578fd4ba140242b5f00a792a97488263cd3fc))
* Implement proxy configuration for HTTP/HTTPS/SOCKS ([94b206f](https://github.com/structured-world/gitlab-mcp/commit/94b206f72f888e53a838f64349a43449d5eaaada))
* major release v2.1.0 with comprehensive improvements ([0fabf17](https://github.com/structured-world/gitlab-mcp/commit/0fabf1722538154aaa3ba3c875c73edf5e52a59a))
* **pipeline:** Add list_pipeline_trigger_jobs tools ([56a53b3](https://github.com/structured-world/gitlab-mcp/commit/56a53b3ab9930ca51e1e080805c402b7baa1b1a0))
* **pipeline:** Add list_pipeline_trigger_jobs tools ([0006e67](https://github.com/structured-world/gitlab-mcp/commit/0006e675a5a718f78452db995d86617871d3910c))
* **release:** 1.0.44  adds pipeline jobs tool ([ea06c21](https://github.com/structured-world/gitlab-mcp/commit/ea06c21f298feb84e93540fa3bfb8b315562fe1f))
* **release:** 1.0.44  adds pipeline jobs tool ([4e4eb46](https://github.com/structured-world/gitlab-mcp/commit/4e4eb469c6c74c4fcdb7492f15a75f99c57e1388))
* rename ignored_files_regex to excluded_file_patterns and update descriptions for clarity ([fef3606](https://github.com/structured-world/gitlab-mcp/commit/fef360664e0577f4d5ff1238f149ee2ffcb1d471))
* rename ignored_files_regex to excluded_file_patterns and update descriptions for clarity ([159da36](https://github.com/structured-world/gitlab-mcp/commit/159da36d9c25de4b58730fd5805492b89b26faba))
* replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS ([009ad97](https://github.com/structured-world/gitlab-mcp/commit/009ad97ef74f06b58319a08fdda11253e629b077))
* replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS ([6a77b04](https://github.com/structured-world/gitlab-mcp/commit/6a77b043d64778746ea5d1976720d2df8d002ad0))
* support resolving merge request notes ([bde83c0](https://github.com/structured-world/gitlab-mcp/commit/bde83c0a912ba60026abd1954e764bb09d5a013d))
* support resolving merge request notes ([4c349a3](https://github.com/structured-world/gitlab-mcp/commit/4c349a32340f47e46e900d23231d0bada30ee4ef))
* support search by branch for get_merge_request ([20f6275](https://github.com/structured-world/gitlab-mcp/commit/20f62756c197a00f334fc8b63e2cbfe22cf99a2e))
* support search by branch for get_merge_request ([eaadf24](https://github.com/structured-world/gitlab-mcp/commit/eaadf24a1df40e281dcfff32b7e8aa66d86bea10))
* trigger workflow after fix ([435c8f1](https://github.com/structured-world/gitlab-mcp/commit/435c8f1223daeb7cbb321e7be6f63e0295cd6fb4))
* trigger workflow after fix ([40e2a5d](https://github.com/structured-world/gitlab-mcp/commit/40e2a5d835e0b8eae6a79dcd4fad61d3ff11ff3c))
* trigger workflow after jq fix ([5c67d68](https://github.com/structured-world/gitlab-mcp/commit/5c67d68be41a011014dc8315cc57d4b0bf452453))
* trigger workflow after jq fix ([116d1f4](https://github.com/structured-world/gitlab-mcp/commit/116d1f4e738ee26caba8b8fffb203e12986b862a))
* trigger workflow run ([7acdff9](https://github.com/structured-world/gitlab-mcp/commit/7acdff90ef09edc88334ddc18efc9a3c51095971))
* trigger workflow run ([c047571](https://github.com/structured-world/gitlab-mcp/commit/c0475710b9e4916a21072022c1f230e150cfab4a))
* trigger workflow with GITLAB_PERSONAL_ACCESS_TOKEN ([e967bb5](https://github.com/structured-world/gitlab-mcp/commit/e967bb51c8295b3a511273d4547e4eedcc15d38a))
* trigger workflow with GITLAB_PERSONAL_ACCESS_TOKEN ([ebec8b1](https://github.com/structured-world/gitlab-mcp/commit/ebec8b19f81a7ee19549e0cebd169bb11997b178))

## [2.1.0] - 2024-12-15

### Added
- Comprehensive Docker support with multi-stage builds
- Docker Compose configuration with multiple deployment scenarios (HTTP, SSE, stdio, read-only)
- Work Items GraphQL support for GitLab Premium/Ultimate instances
- Enhanced environment variable configuration
- Complete test suite with Zero Data Validation Rule implementation
- Comprehensive test lifecycle management (create → use → cleanup pattern)
- Support for all GitLab tiers with automatic feature detection
- Enhanced security with non-root Docker user and health checks

### Changed
- **BREAKING**: Package name changed from `@zereight/gitlab-mcp` to `@structured-world/gitlab-mcp`
- Updated Docker image repository to `ghcr.io/structured-world/gitlab-mcp`
- Improved README with categorized tools list (94 total tools)
- Enhanced documentation with comprehensive Docker deployment instructions
- Refactored test architecture to follow strict data lifecycle rules
- Updated all test files to create their own test infrastructure
- Improved error handling and validation across all test suites

### Fixed
- Removed hardcoded test values and replaced with dynamic test data
- Fixed URL encoding issues in test scripts
- Corrected package references throughout documentation
- Fixed test dependencies on external test infrastructure
- Improved test reliability and isolation

### Infrastructure
- Updated Dockerfile with comprehensive environment variable support
- Added multi-stage Docker build for optimized image size
- Enhanced GitHub Actions integration
- Improved Jest test coverage reporting
- Added semantic release automation
- Comprehensive environment configuration documentation

### Documentation
- Complete rewrite of tools documentation with categorization
- Added comprehensive Docker deployment guide
- Updated environment variable documentation
- Enhanced development setup instructions
- Added contribution guidelines and testing procedures

---

#### [v2.0.5](https://github.com/zereight/gitlab-mcp/compare/v2.0.4...v2.0.5)

- Add ability to trigger / retry / cancel individual jobs [`#233`](https://github.com/zereight/gitlab-mcp/pull/233)
- chore: add expose to docker file [`#222`](https://github.com/zereight/gitlab-mcp/pull/222)
- Pull Request: Add GitLab Events API Tools [`#235`](https://github.com/zereight/gitlab-mcp/pull/235)
- docs: update README to include new pipeline-related tools [`f051153`](https://github.com/zereight/gitlab-mcp/commit/f0511537c96dffba6a4a6cee5ee860b23c318668)

#### [v2.0.4](https://github.com/zereight/gitlab-mcp/compare/v2.0.3...v2.0.4)

> 31 August 2025

- Fixes coverage parsing error on Pipelines related types [`#230`](https://github.com/zereight/gitlab-mcp/pull/230)
- FEAT: add GITLAB_DENIED_TOOLS_REGEX env to disable some tools [`#206`](https://github.com/zereight/gitlab-mcp/pull/206)
- Feat/modify email [`#225`](https://github.com/zereight/gitlab-mcp/pull/225)
- v1.0.77 [`#209`](https://github.com/zereight/gitlab-mcp/pull/209)
- FIX: docker hub repo user name [`#210`](https://github.com/zereight/gitlab-mcp/pull/210)
- feat: Add NPM publish workflow for automated package publishing [`#208`](https://github.com/zereight/gitlab-mcp/pull/208)
- Fix list of tools in `README.md` [`#205`](https://github.com/zereight/gitlab-mcp/pull/205)
- FIX: flexible boolean [`#201`](https://github.com/zereight/gitlab-mcp/pull/201)
- feat(attachement):download attachement, e.g. images [`#200`](https://github.com/zereight/gitlab-mcp/pull/200)
- FEAT: merge MR [`#193`](https://github.com/zereight/gitlab-mcp/pull/193)
- FEAT: get draft note [`#197`](https://github.com/zereight/gitlab-mcp/pull/197)
- feat: Add createDraftNote api support, useful for bulk code review [`#183`](https://github.com/zereight/gitlab-mcp/pull/183)
- feat: add my_issues and list_project_members tools [`#133`](https://github.com/zereight/gitlab-mcp/pull/133)
- feat(pipeline): Add list_pipeline_trigger_jobs tools [`#194`](https://github.com/zereight/gitlab-mcp/pull/194)
- (feat): add tool to upload file for markdown content [`#196`](https://github.com/zereight/gitlab-mcp/pull/196)
- Bump version to 1.0.76 [`#182`](https://github.com/zereight/gitlab-mcp/pull/182)
- FEAT: iteration [`#179`](https://github.com/zereight/gitlab-mcp/pull/179)
- Bump version to 1.0.75 [`#178`](https://github.com/zereight/gitlab-mcp/pull/178)
- Allow accessing issues without project id [`#168`](https://github.com/zereight/gitlab-mcp/pull/168)
- Feat/deploy script [`#176`](https://github.com/zereight/gitlab-mcp/pull/176)
- FEAT: target project on create MR [`#174`](https://github.com/zereight/gitlab-mcp/pull/174)
- Bump version to 1.0.74 [`#175`](https://github.com/zereight/gitlab-mcp/pull/175)
- FEAT: add logging [`#162`](https://github.com/zereight/gitlab-mcp/pull/162)
- FEAT: id is string or number [`#161`](https://github.com/zereight/gitlab-mcp/pull/161)
- FIX string or number [`#160`](https://github.com/zereight/gitlab-mcp/pull/160)
- FIX: id string or number [`#158`](https://github.com/zereight/gitlab-mcp/pull/158)
- FIX: deploy script [`#156`](https://github.com/zereight/gitlab-mcp/pull/156)
- chore: Bump version 1.0.72 [`#154`](https://github.com/zereight/gitlab-mcp/pull/154)
- FEAT: enable string for boolean for claude [`#150`](https://github.com/zereight/gitlab-mcp/pull/150)
- Bump version to 1.0.71 [`#152`](https://github.com/zereight/gitlab-mcp/pull/152)
- tag with image push [`#151`](https://github.com/zereight/gitlab-mcp/pull/151)
- FIX: string | number for gemini [`#149`](https://github.com/zereight/gitlab-mcp/pull/149)
- FIX: format boolean for claude [`#148`](https://github.com/zereight/gitlab-mcp/pull/148)
- Print logs to stderr [`#147`](https://github.com/zereight/gitlab-mcp/pull/147)
- FIX: CreateMergeRequestSchema [`#146`](https://github.com/zereight/gitlab-mcp/pull/146)
- chore: Bump version to 1.0.70 [`#145`](https://github.com/zereight/gitlab-mcp/pull/145)
- FIX: sse [`#144`](https://github.com/zereight/gitlab-mcp/pull/144)
- FIX: default project id [`#141`](https://github.com/zereight/gitlab-mcp/pull/141)
- FEAT: format boolean [`#143`](https://github.com/zereight/gitlab-mcp/pull/143)
- FIX: console to stderr [`#135`](https://github.com/zereight/gitlab-mcp/pull/135)
- FIX: create pipeline [`#138`](https://github.com/zereight/gitlab-mcp/pull/138)
- FEAT: Add support for Streamable HTTP transport [`#128`](https://github.com/zereight/gitlab-mcp/pull/128)
- FIX: notable iid [`#126`](https://github.com/zereight/gitlab-mcp/pull/126)
- FEAT: reviewer on update MR [`#118`](https://github.com/zereight/gitlab-mcp/pull/118)
- FEAT: not call create fork repo on set default project id [`#116`](https://github.com/zereight/gitlab-mcp/pull/116)
- FEAT: project id , vscode doc [`#113`](https://github.com/zereight/gitlab-mcp/pull/113)
- feat(simple healthcheck): [`#112`](https://github.com/zereight/gitlab-mcp/pull/112)
- FIX: new,old path nullable [`#108`](https://github.com/zereight/gitlab-mcp/pull/108)
- fix: avoid error caused by line_range type: null in discussion [`#107`](https://github.com/zereight/gitlab-mcp/pull/107)
- FIX: sse readme [`#103`](https://github.com/zereight/gitlab-mcp/pull/103)
- FEAT: mr discussion with code diff [`#93`](https://github.com/zereight/gitlab-mcp/pull/93)
- feat: add cookie-based authentication support for enterprise GitLab [`#101`](https://github.com/zereight/gitlab-mcp/pull/101)
- Fix notification_level null handling for GitLab group owners [`#99`](https://github.com/zereight/gitlab-mcp/pull/99)
- feat: add pagination support for CI job logs to prevent context window flooding [`#97`](https://github.com/zereight/gitlab-mcp/pull/97)
- FIX: private token auth [`#91`](https://github.com/zereight/gitlab-mcp/pull/91)
- FEAT: private token auth [`#89`](https://github.com/zereight/gitlab-mcp/pull/89)
- FIX: list issues assginee username [`#87`](https://github.com/zereight/gitlab-mcp/pull/87)
- FEAT: add support for `remove_source_branch` and `squash` options for merge requests [`#86`](https://github.com/zereight/gitlab-mcp/pull/86)
- Fix for null error [`#85`](https://github.com/zereight/gitlab-mcp/pull/85)
- FIX: bug get issues [`#83`](https://github.com/zereight/gitlab-mcp/pull/83)
- Add support for retrieving wiki page content in list_wiki_pages [`#82`](https://github.com/zereight/gitlab-mcp/pull/82)
- DOC: readme docker image [`#81`](https://github.com/zereight/gitlab-mcp/pull/81)
- Add pagination to merge request discussions, similar to issue discussions [`#80`](https://github.com/zereight/gitlab-mcp/pull/80)
- fix: merge_requests_template can be null [`#79`](https://github.com/zereight/gitlab-mcp/pull/79)
- FIX: issue param [`#78`](https://github.com/zereight/gitlab-mcp/pull/78)
- FIX: get issues labels [`#77`](https://github.com/zereight/gitlab-mcp/pull/77)
- FEAT: MCP SSE [`#76`](https://github.com/zereight/gitlab-mcp/pull/76)
- Feat: Enrich Merge Request Creation [`#68`](https://github.com/zereight/gitlab-mcp/pull/68)
- Feat/custom ssl [`#72`](https://github.com/zereight/gitlab-mcp/pull/72)
- FEAT: multi platform [`#71`](https://github.com/zereight/gitlab-mcp/pull/71)
- FEAT: ci push docker hub [`#65`](https://github.com/zereight/gitlab-mcp/pull/65)
- feat: add pipeline management commands [`#64`](https://github.com/zereight/gitlab-mcp/pull/64)
- [main] docs: update README with comments on GITLAB configuration options [`#63`](https://github.com/zereight/gitlab-mcp/pull/63)
- test [`#61`](https://github.com/zereight/gitlab-mcp/pull/61)
- Fix GitHub Actions workflow syntax errors [`#62`](https://github.com/zereight/gitlab-mcp/pull/62)
- feat: add tools for milestones [`#59`](https://github.com/zereight/gitlab-mcp/pull/59)
- FEAT: docker image push script [`#60`](https://github.com/zereight/gitlab-mcp/pull/60)
- fix(schemas): make illustration nullable in GitLabPipelineSchema [`#58`](https://github.com/zereight/gitlab-mcp/pull/58)
- feat: implement list_merge_requests functionality [`#56`](https://github.com/zereight/gitlab-mcp/pull/56)
- fix(schemas): make avatar_url nullable in GitLabUserSchema [`#55`](https://github.com/zereight/gitlab-mcp/pull/55)
- FIX: description null error [`#53`](https://github.com/zereight/gitlab-mcp/pull/53)
- feat(release): 1.0.44 adds pipeline jobs tool [`#52`](https://github.com/zereight/gitlab-mcp/pull/52)
- feat: add support for creating and updating issue notes [`#47`](https://github.com/zereight/gitlab-mcp/pull/47)
- fix: fix README [`#45`](https://github.com/zereight/gitlab-mcp/pull/45)
- feat: add issue discussions support [`#44`](https://github.com/zereight/gitlab-mcp/pull/44)
- feat: add docker image and push to dockerhub [`#42`](https://github.com/zereight/gitlab-mcp/pull/42)
- fixed resolve_outdated_diff_discussions nullable [`#41`](https://github.com/zereight/gitlab-mcp/pull/41)
- fix: add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema [`#40`](https://github.com/zereight/gitlab-mcp/pull/40)
- Adds threaded comment support for merge requests [`#38`](https://github.com/zereight/gitlab-mcp/pull/38)
- Support resolving merge request discussion notes [`#37`](https://github.com/zereight/gitlab-mcp/pull/37)
- feat: Gitlab list repository tree tool [`#35`](https://github.com/zereight/gitlab-mcp/pull/35)
- feat: support search by branch for get_merge_request [`#34`](https://github.com/zereight/gitlab-mcp/pull/34)
- feat: Implement proxy configuration for HTTP/HTTPS/SOCKS [`#33`](https://github.com/zereight/gitlab-mcp/pull/33)
- feat: Add read-only mode support [`#29`](https://github.com/zereight/gitlab-mcp/pull/29)
- Add schemas for GitLab discussion notes and merge request discussions [`#26`](https://github.com/zereight/gitlab-mcp/pull/26)
- :sparkles: Add `list_group_projects tool` [`#25`](https://github.com/zereight/gitlab-mcp/pull/25)
- Update README.md [`#24`](https://github.com/zereight/gitlab-mcp/pull/24)
- Fixed types for create_merge_request and get_merge_request tools. [`#23`](https://github.com/zereight/gitlab-mcp/pull/23)
- Authentication Header Consistency Fix [`#22`](https://github.com/zereight/gitlab-mcp/pull/22)
- Labels API Support [`#21`](https://github.com/zereight/gitlab-mcp/pull/21)
- Improve README documentation with detailed tool descriptions [`#18`](https://github.com/zereight/gitlab-mcp/pull/18)
- Implement GitLab Issues and Issue Links API [`#17`](https://github.com/zereight/gitlab-mcp/pull/17)
- Add GitLab Projects API support [`#16`](https://github.com/zereight/gitlab-mcp/pull/16)
- Add GitLab Namespaces API support [`#15`](https://github.com/zereight/gitlab-mcp/pull/15)
- Fix GitLab API fork repository parameter handling [`#14`](https://github.com/zereight/gitlab-mcp/pull/14)
- Fix GitLab API parameter handling in create_or_update_file [`#13`](https://github.com/zereight/gitlab-mcp/pull/13)
- Improve code documentation with bilingual JSDoc comments [`#11`](https://github.com/zereight/gitlab-mcp/pull/11)
- Fix URL construction with smart API URL normalization [`#10`](https://github.com/zereight/gitlab-mcp/pull/10)
- Fix createNote function URL construction: use plural resource names and avoid duplicate /api/v4 [`#7`](https://github.com/zereight/gitlab-mcp/pull/7)
- Added missing api url part to create_note [`#3`](https://github.com/zereight/gitlab-mcp/pull/3)
- Deployment: Dockerfile and Smithery config [`#2`](https://github.com/zereight/gitlab-mcp/pull/2)
- add MCP server badge [`#1`](https://github.com/zereight/gitlab-mcp/pull/1)
- [feat/pipeline-support] feat: add pipeline management commands [`#46`](https://github.com/zereight/gitlab-mcp/issues/46)
- chore: update CHANGELOG for version 2.0.4 [`e26c169`](https://github.com/zereight/gitlab-mcp/commit/e26c16998256cca0d4c3aea9b3046f61ed6cb866)
- Squashed commit of the following: [`73f21db`](https://github.com/zereight/gitlab-mcp/commit/73f21dbf1ea29e501e095b78b8d55cc517e777f5)
- Squashed commit of the following: [`750e1c6`](https://github.com/zereight/gitlab-mcp/commit/750e1c614047a1bb84ac4324d5881f78f24c8482)

#### [v2.0.3](https://github.com/zereight/gitlab-mcp/compare/v2.0.2...v2.0.3)

> 17 August 2025

- fix: Update Docker image repository name in workflow [`b97b264`](https://github.com/zereight/gitlab-mcp/commit/b97b2642c954e6cea8d3ce0c1092d04229cfd1f9)
- chore: Update version to 2.0.3 in package.json [`196aee3`](https://github.com/zereight/gitlab-mcp/commit/196aee3db2faa0e3f4f9263a24d31b29c95fdfda)

#### [v2.0.2](https://github.com/zereight/gitlab-mcp/compare/v2.0.1...v2.0.2)

> 15 August 2025

- chore: update version in package.json to 2.0.2 [`0c5e667`](https://github.com/zereight/gitlab-mcp/commit/0c5e667c5c600c4a70ff613fc6e1de6dcbc2403a)
- chore: update version in CHANGELOG to 2.0.1 [`e3b0144`](https://github.com/zereight/gitlab-mcp/commit/e3b0144f98a409e0decedef076d4c4097b0c8519)

#### [v2.0.1](https://github.com/zereight/gitlab-mcp/compare/2.0.0...v2.0.1)

> 15 August 2025

- v1.0.77 [`#209`](https://github.com/zereight/gitlab-mcp/pull/209)
- FIX: docker hub repo user name [`#210`](https://github.com/zereight/gitlab-mcp/pull/210)
- feat: Add NPM publish workflow for automated package publishing [`#208`](https://github.com/zereight/gitlab-mcp/pull/208)
- Fix list of tools in `README.md` [`#205`](https://github.com/zereight/gitlab-mcp/pull/205)
- Squashed commit of the following: [`291fb10`](https://github.com/zereight/gitlab-mcp/commit/291fb10a6c2e42cc377d5bfd87fe94546ecdfa1e)
- Fix list of tools [`4ab6eb1`](https://github.com/zereight/gitlab-mcp/commit/4ab6eb186c16cc8534f649fe76b71f5e4dc82b9d)
- fix: update Docker Hub repository username in workflow [`4ed895b`](https://github.com/zereight/gitlab-mcp/commit/4ed895b7360c94d7f3b8c788510233550b2a6281)

### [2.0.0](https://github.com/zereight/gitlab-mcp/compare/v1.0.76...2.0.0)

> 15 August 2025

- User based authentication methods [`#130`](https://github.com/zereight/gitlab-mcp/pull/130)
- FIX: flexible boolean [`#201`](https://github.com/zereight/gitlab-mcp/pull/201)
- feat(attachement):download attachement, e.g. images [`#200`](https://github.com/zereight/gitlab-mcp/pull/200)
- FEAT: merge MR [`#193`](https://github.com/zereight/gitlab-mcp/pull/193)
- FEAT: get draft note [`#197`](https://github.com/zereight/gitlab-mcp/pull/197)
- feat: Add createDraftNote api support, useful for bulk code review [`#183`](https://github.com/zereight/gitlab-mcp/pull/183)
- feat: add my_issues and list_project_members tools [`#133`](https://github.com/zereight/gitlab-mcp/pull/133)
- feat(pipeline): Add list_pipeline_trigger_jobs tools [`#194`](https://github.com/zereight/gitlab-mcp/pull/194)
- (feat): add tool to upload file for markdown content [`#196`](https://github.com/zereight/gitlab-mcp/pull/196)
- feat: replace GITLAB_LOCK_PROJECT with GITLAB_ALLOWED_PROJECT_IDS [`009ad97`](https://github.com/zereight/gitlab-mcp/commit/009ad97ef74f06b58319a08fdda11253e629b077)
- feat: add GITLAB_LOCK_PROJECT environment variable [`c899a7d`](https://github.com/zereight/gitlab-mcp/commit/c899a7dc3be63bbfce25a715cd3d910255604c0b)
- FIX [`19b7254`](https://github.com/zereight/gitlab-mcp/commit/19b725447acfbc35d4c6ae3d6f07de7df6d5d0c8)

#### [v1.0.76](https://github.com/zereight/gitlab-mcp/compare/v1.0.75...v1.0.76)

> 25 July 2025

- Bump version to 1.0.76 [`#182`](https://github.com/zereight/gitlab-mcp/pull/182)
- FEAT: iteration [`#179`](https://github.com/zereight/gitlab-mcp/pull/179)
- Bump version to 1.0.75 [`#178`](https://github.com/zereight/gitlab-mcp/pull/178)
- Merge pull request #181 from zereight/feat/166-1 [`6adbeea`](https://github.com/zereight/gitlab-mcp/commit/6adbeea560dc6a06d90a1b0984253bb2f3df2867)
- FIX [`46f8405`](https://github.com/zereight/gitlab-mcp/commit/46f8405a31f957c4c60113e3473e9e084562eff0)
- FIX: default null [`6e82e7e`](https://github.com/zereight/gitlab-mcp/commit/6e82e7e5c9e603af18fa4639956d159a861edce6)

#### [v1.0.75](https://github.com/zereight/gitlab-mcp/compare/v1.0.74...v1.0.75)

> 18 July 2025

- Allow accessing issues without project id [`#168`](https://github.com/zereight/gitlab-mcp/pull/168)
- Feat/deploy script [`#176`](https://github.com/zereight/gitlab-mcp/pull/176)
- FEAT: target project on create MR [`#174`](https://github.com/zereight/gitlab-mcp/pull/174)
- Bump version to 1.0.74 [`#175`](https://github.com/zereight/gitlab-mcp/pull/175)
- FIX [`2872aed`](https://github.com/zereight/gitlab-mcp/commit/2872aed35fee55b29d44ec01e0417a0a087e9ef3)
- fix(list_issues): make project_id optional [`b242522`](https://github.com/zereight/gitlab-mcp/commit/b2425221a6077c7fdba343e8681d1938a24d3a39)
- Bump version to 1.0.75 [`b0411ba`](https://github.com/zereight/gitlab-mcp/commit/b0411ba2b9e949fefe37620b27425310d38a5cd7)

#### [v1.0.74](https://github.com/zereight/gitlab-mcp/compare/v1.0.73...v1.0.74)

> 17 July 2025

- Bump version to 1.0.74 [`8effa28`](https://github.com/zereight/gitlab-mcp/commit/8effa283ba7fe71e7b9c6548e37a7866bd730421)

#### [v1.0.73](https://github.com/zereight/gitlab-mcp/compare/v1.0.72...v1.0.73)

> 13 July 2025

- FEAT: add logging [`#162`](https://github.com/zereight/gitlab-mcp/pull/162)
- FEAT: id is string or number [`#161`](https://github.com/zereight/gitlab-mcp/pull/161)
- FIX string or number [`#160`](https://github.com/zereight/gitlab-mcp/pull/160)
- FIX: id string or number [`#158`](https://github.com/zereight/gitlab-mcp/pull/158)
- FIX: deploy script [`#156`](https://github.com/zereight/gitlab-mcp/pull/156)
- FIX [`1131897`](https://github.com/zereight/gitlab-mcp/commit/1131897817ca5462320ba1a9a532ec3f2b196286)
- FIX [`0affdf9`](https://github.com/zereight/gitlab-mcp/commit/0affdf9df0c2ca1ec9deab2e4977b93f8acd9e0b)
- FIX: string or number [`429f397`](https://github.com/zereight/gitlab-mcp/commit/429f39700ee9f48f65af8bbc8d8756abe3da37bd)

#### [v1.0.72](https://github.com/zereight/gitlab-mcp/compare/v1.0.65...v1.0.72)

> 9 July 2025

- chore: Bump version 1.0.72 [`#154`](https://github.com/zereight/gitlab-mcp/pull/154)
- FEAT: enable string for boolean for claude [`#150`](https://github.com/zereight/gitlab-mcp/pull/150)
- Bump version to 1.0.71 [`#152`](https://github.com/zereight/gitlab-mcp/pull/152)
- tag with image push [`#151`](https://github.com/zereight/gitlab-mcp/pull/151)
- FIX: string | number for gemini [`#149`](https://github.com/zereight/gitlab-mcp/pull/149)
- FIX: format boolean for claude [`#148`](https://github.com/zereight/gitlab-mcp/pull/148)
- Print logs to stderr [`#147`](https://github.com/zereight/gitlab-mcp/pull/147)
- FIX: CreateMergeRequestSchema [`#146`](https://github.com/zereight/gitlab-mcp/pull/146)
- chore: Bump version to 1.0.70 [`#145`](https://github.com/zereight/gitlab-mcp/pull/145)
- FIX: sse [`#144`](https://github.com/zereight/gitlab-mcp/pull/144)
- FIX: default project id [`#141`](https://github.com/zereight/gitlab-mcp/pull/141)
- FEAT: format boolean [`#143`](https://github.com/zereight/gitlab-mcp/pull/143)
- FIX: console to stderr [`#135`](https://github.com/zereight/gitlab-mcp/pull/135)
- FIX: create pipeline [`#138`](https://github.com/zereight/gitlab-mcp/pull/138)
- FEAT: Add support for Streamable HTTP transport [`#128`](https://github.com/zereight/gitlab-mcp/pull/128)
- FIX: notable iid [`#126`](https://github.com/zereight/gitlab-mcp/pull/126)
- FEAT: reviewer on update MR [`#118`](https://github.com/zereight/gitlab-mcp/pull/118)
- FEAT: not call create fork repo on set default project id [`#116`](https://github.com/zereight/gitlab-mcp/pull/116)
- FEAT: project id , vscode doc [`#113`](https://github.com/zereight/gitlab-mcp/pull/113)
- feat(simple healthcheck): [`#112`](https://github.com/zereight/gitlab-mcp/pull/112)
- FIX: new,old path nullable [`#108`](https://github.com/zereight/gitlab-mcp/pull/108)
- fix: avoid error caused by line_range type: null in discussion [`#107`](https://github.com/zereight/gitlab-mcp/pull/107)
- FIX: sse readme [`#103`](https://github.com/zereight/gitlab-mcp/pull/103)
- REVIEW FIX [`3ad2954`](https://github.com/zereight/gitlab-mcp/commit/3ad29547b4f53aacb07b54d4f88329f8cb23c1cf)
- fix: avoid error caused by line_range: null in discussion [`d50b7fd`](https://github.com/zereight/gitlab-mcp/commit/d50b7fd1ac01802889bd383e39d767378204aa66)
- FIX [`b109392`](https://github.com/zereight/gitlab-mcp/commit/b109392f1c89d891d6a9706249c2fcd541ab0165)

#### [v1.0.65](https://github.com/zereight/gitlab-mcp/compare/v1.0.64...v1.0.65)

> 16 June 2025

- FEAT: mr discussion with code diff [`#93`](https://github.com/zereight/gitlab-mcp/pull/93)
- docs: update README and version to 1.0.64 [`cced1c1`](https://github.com/zereight/gitlab-mcp/commit/cced1c16f9c2c7cc0ba2e7e2c28884bb966f0bd5)

#### [v1.0.64](https://github.com/zereight/gitlab-mcp/compare/1.0.63...v1.0.64)

> 16 June 2025

- feat: add cookie-based authentication support for enterprise GitLab [`#101`](https://github.com/zereight/gitlab-mcp/pull/101)
- Fix notification_level null handling for GitLab group owners [`#99`](https://github.com/zereight/gitlab-mcp/pull/99)

#### [1.0.63](https://github.com/zereight/gitlab-mcp/compare/v1.0.63...1.0.63)

> 12 June 2025

- docs: add CHANGELOG entry for v1.0.63 [`8d70627`](https://github.com/zereight/gitlab-mcp/commit/8d706275e657be0509941b43c47f892643a24a5b)

#### [v1.0.63](https://github.com/zereight/gitlab-mcp/compare/1.0.62...v1.0.63)

> 12 June 2025

- feat: add pagination support for CI job logs to prevent context window flooding [`#97`](https://github.com/zereight/gitlab-mcp/pull/97)
- [version-update] fix: correct Private-Token header authentication for GitLab API 🔐 [`3c23675`](https://github.com/zereight/gitlab-mcp/commit/3c23675eece9b1d8ce90f65cc9692100f5cb2c8a)
- chore: bump version to 1.0.63 [`62f0fff`](https://github.com/zereight/gitlab-mcp/commit/62f0ffff69e8b52acc078410e5578231ef883cc1)

#### [1.0.62](https://github.com/zereight/gitlab-mcp/compare/1.0.60...1.0.62)

> 10 June 2025

- FIX: private token auth [`#91`](https://github.com/zereight/gitlab-mcp/pull/91)
- FEAT: private token auth [`#89`](https://github.com/zereight/gitlab-mcp/pull/89)
- style: format code for consistency and readability ✨ [`1ba5434`](https://github.com/zereight/gitlab-mcp/commit/1ba54342bc4a2769b95cf27fc6cc54c84e55aa94)
- [version-update] feat: bump version to 1.0.60 🎉 [`29659db`](https://github.com/zereight/gitlab-mcp/commit/29659db0b74471b6042106fcae1b2ca273f2ae4c)
- [version-update] feat: bump version to 1.0.62 🎉 [`8df87c6`](https://github.com/zereight/gitlab-mcp/commit/8df87c67d2701f5bd6bdbef4e0880457507b135d)

#### [1.0.60](https://github.com/zereight/gitlab-mcp/compare/v1.0.59...1.0.60)

> 7 June 2025

- FIX: list issues assginee username [`#87`](https://github.com/zereight/gitlab-mcp/pull/87)
- FEAT: add support for `remove_source_branch` and `squash` options for merge requests [`#86`](https://github.com/zereight/gitlab-mcp/pull/86)

#### [v1.0.59](https://github.com/zereight/gitlab-mcp/compare/v1.0.57...v1.0.59)

> 4 June 2025

- Fix for null error [`#85`](https://github.com/zereight/gitlab-mcp/pull/85)
- FIX: bug get issues [`#83`](https://github.com/zereight/gitlab-mcp/pull/83)
- Add support for retrieving wiki page content in list_wiki_pages [`#82`](https://github.com/zereight/gitlab-mcp/pull/82)
- DOC: readme docker image [`#81`](https://github.com/zereight/gitlab-mcp/pull/81)
- [version-update] feat: bump version to 1.0.59 🎉 [`0930ce3`](https://github.com/zereight/gitlab-mcp/commit/0930ce3636e8b155d7ac5892226cc1c780135de3)
- [feat] update: bump version to 1.0.58 [`8cb7703`](https://github.com/zereight/gitlab-mcp/commit/8cb7703aa1a2284143bc4e84f16bf2af59a2792a)

#### [v1.0.57](https://github.com/zereight/gitlab-mcp/compare/v1.0.56...v1.0.57)

> 3 June 2025

- Add pagination to merge request discussions, similar to issue discussions [`#80`](https://github.com/zereight/gitlab-mcp/pull/80)
- fix: merge_requests_template can be null [`#79`](https://github.com/zereight/gitlab-mcp/pull/79)
- [feat] update: bump version to 1.0.57 [`c07356b`](https://github.com/zereight/gitlab-mcp/commit/c07356bd465dc565ce323683a8b96a7e76241c8b)

#### [v1.0.56](https://github.com/zereight/gitlab-mcp/compare/v1.0.54...v1.0.56)

> 2 June 2025

- FIX: issue param [`#78`](https://github.com/zereight/gitlab-mcp/pull/78)
- FIX: get issues labels [`#77`](https://github.com/zereight/gitlab-mcp/pull/77)
- FEAT: MCP SSE [`#76`](https://github.com/zereight/gitlab-mcp/pull/76)
- Feat: Enrich Merge Request Creation [`#68`](https://github.com/zereight/gitlab-mcp/pull/68)
- feat: add branch comparison functionality and update related schemas [`c834ebc`](https://github.com/zereight/gitlab-mcp/commit/c834ebc135bf5896ab4f7982ae417f0c32d8ea42)
- fix: remove duplicate entry for get_branch_diffs in tools list [`6bc1379`](https://github.com/zereight/gitlab-mcp/commit/6bc13794c8cfe09dafa2fddeae2d05589700cac6)
- feat: add user retrieval functions and schemas for GitLab API integration [`005b46a`](https://github.com/zereight/gitlab-mcp/commit/005b46a1a66d2d72bc922f9f98f2df2f58c5f084)

#### [v1.0.54](https://github.com/zereight/gitlab-mcp/compare/v1.0.53...v1.0.54)

> 31 May 2025

- Feat/custom ssl [`#72`](https://github.com/zereight/gitlab-mcp/pull/72)
- FEAT: multi platform [`#71`](https://github.com/zereight/gitlab-mcp/pull/71)
- Release v1.0.54: Add multi-platform support and custom SSL configuration [`459161e`](https://github.com/zereight/gitlab-mcp/commit/459161e23514e9a4d70fd6f902e5f84ba049eec1)
- chore: remove outdated release notes for version 1.0.40 [`e9493b2`](https://github.com/zereight/gitlab-mcp/commit/e9493b2ff90554d21bd8056350a554e8325c22ba)
- [main] chore: bump version to v1.0.54 🚀 [`4a8088c`](https://github.com/zereight/gitlab-mcp/commit/4a8088c25cea0c747c9df71501ff0a6fe46bef40)

#### [v1.0.53](https://github.com/zereight/gitlab-mcp/compare/v1.0.52...v1.0.53)

> 30 May 2025

- FEAT: ci push docker hub [`#65`](https://github.com/zereight/gitlab-mcp/pull/65)
- [main] fix: make old_line and new_line optional for image diff discussions [`cb36c00`](https://github.com/zereight/gitlab-mcp/commit/cb36c007cb215127c16e621ef5a0255c76a6cdbe)
- [main] chore: bump version to v1.0.53 [`fcb71e2`](https://github.com/zereight/gitlab-mcp/commit/fcb71e293e8a0f7f803397582d2e5ff867febd2d)

#### [v1.0.52](https://github.com/zereight/gitlab-mcp/compare/v1.0.50...v1.0.52)

> 30 May 2025

- feat: add pipeline management commands [`#64`](https://github.com/zereight/gitlab-mcp/pull/64)
- [main] docs: update README with comments on GITLAB configuration options [`#63`](https://github.com/zereight/gitlab-mcp/pull/63)
- test [`#61`](https://github.com/zereight/gitlab-mcp/pull/61)
- Fix GitHub Actions workflow syntax errors [`#62`](https://github.com/zereight/gitlab-mcp/pull/62)
- [feat/pipeline-support] feat: add pipeline management commands [`#46`](https://github.com/zereight/gitlab-mcp/issues/46)
- [feat/pipeline-support] feat: add USE_PIPELINE environment variable for conditional pipeline feature activation [`de0b138`](https://github.com/zereight/gitlab-mcp/commit/de0b138d8002daf15d845c6360957c50d95a6288)
- [main] docs: update README to remove automated testing section 📝 [`37203ba`](https://github.com/zereight/gitlab-mcp/commit/37203bae5a87d902380ecb7ead454ec9b19af1ef)
- [main] debug: temporarily disable MCP server startup test [`8e2b6e6`](https://github.com/zereight/gitlab-mcp/commit/8e2b6e67349aa575dd9c3217b58bfe76772932ae)

#### [v1.0.50](https://github.com/zereight/gitlab-mcp/compare/v1.0.48...v1.0.50)

> 29 May 2025

- [main] feat: update milestone management tools and improve code formatting ✨ [`181f1e9`](https://github.com/zereight/gitlab-mcp/commit/181f1e943cbfcee8486717e73a63fd62e3ded280)

#### [v1.0.48](https://github.com/zereight/gitlab-mcp/compare/v1.0.47...v1.0.48)

> 29 May 2025

- feat: add tools for milestones [`#59`](https://github.com/zereight/gitlab-mcp/pull/59)
- FEAT: docker image push script [`#60`](https://github.com/zereight/gitlab-mcp/pull/60)
- [main] chore: v1.0.48 버전 업데이트 [`2a80988`](https://github.com/zereight/gitlab-mcp/commit/2a80988a0231320f80a1d4bd75e51f50e195b29a)
- feat: add milestone management commands to README [`5762b32`](https://github.com/zereight/gitlab-mcp/commit/5762b32a69c3aa13ae819335ba7549be6f36722e)

#### [v1.0.47](https://github.com/zereight/gitlab-mcp/compare/v1.0.46...v1.0.47)

> 29 May 2025

- fix(schemas): make illustration nullable in GitLabPipelineSchema [`#58`](https://github.com/zereight/gitlab-mcp/pull/58)
- feat: implement list_merge_requests functionality [`#56`](https://github.com/zereight/gitlab-mcp/pull/56)
- fix(schemas): make avatar_url nullable in GitLabUserSchema [`#55`](https://github.com/zereight/gitlab-mcp/pull/55)
- feat: implement list_merge_requests functionality [`cc84777`](https://github.com/zereight/gitlab-mcp/commit/cc847772f1f8560d9ce9cba25acbb232cbbf618d)
- [main] release: v1.0.47 [`a2c2ac1`](https://github.com/zereight/gitlab-mcp/commit/a2c2ac185ad2891e11e27a534ef089701effb526)

#### [v1.0.46](https://github.com/zereight/gitlab-mcp/compare/v1.0.45...v1.0.46)

> 27 May 2025

- FIX: description null error [`#53`](https://github.com/zereight/gitlab-mcp/pull/53)
- [main] fix: description null error handling [`f8b1444`](https://github.com/zereight/gitlab-mcp/commit/f8b1444afd5932307ae743ec11380189e59daafa)

#### [v1.0.45](https://github.com/zereight/gitlab-mcp/compare/v1.0.42...v1.0.45)

> 24 May 2025

- feat(release): 1.0.44 adds pipeline jobs tool [`#52`](https://github.com/zereight/gitlab-mcp/pull/52)
- chore(release): 1.0.43 - get_repository_tree is added read_only_mode [`1406203`](https://github.com/zereight/gitlab-mcp/commit/140620397ba88ee6abbd6da01147a466905e1f22)
- [main] docs: update changelog for v1.0.45 pipeline tools [`8ba3398`](https://github.com/zereight/gitlab-mcp/commit/8ba33986f3da8eae4079b179aa3580a1712586a1)
- docs: translate issue notes changelog from Korean to English [`3d7aa80`](https://github.com/zereight/gitlab-mcp/commit/3d7aa8035d996a312559e15f7dd1457e1f32a826)

#### [v1.0.42](https://github.com/zereight/gitlab-mcp/compare/v1.0.40...v1.0.42)

> 22 May 2025

- feat: add support for creating and updating issue notes [`#47`](https://github.com/zereight/gitlab-mcp/pull/47)
- fix: fix README [`#45`](https://github.com/zereight/gitlab-mcp/pull/45)
- chore(release): 1.0.42 - issue note 기능 추가 (#47) [`25be194`](https://github.com/zereight/gitlab-mcp/commit/25be1947b98ffe1e5cffbfce9e04928f4180d2f8)
- docs: update release notes for v1.0.40 (2025-05-21) [`b326f4c`](https://github.com/zereight/gitlab-mcp/commit/b326f4c3c3c43ec6b669a36bbc016377ebfc1a0c)

#### [v1.0.40](https://github.com/zereight/gitlab-mcp/compare/v1.0.39...v1.0.40)

> 21 May 2025

- feat: add issue discussions support [`#44`](https://github.com/zereight/gitlab-mcp/pull/44)

#### [v1.0.39](https://github.com/zereight/gitlab-mcp/compare/v1.0.38...v1.0.39)

> 20 May 2025

- feat: add docker image and push to dockerhub [`#42`](https://github.com/zereight/gitlab-mcp/pull/42)
- fixed resolve_outdated_diff_discussions nullable [`#41`](https://github.com/zereight/gitlab-mcp/pull/41)
- docs: add release-notes.md [`676bbcd`](https://github.com/zereight/gitlab-mcp/commit/676bbcd4ddb9fa3b566a67fffdd2f25de258b933)
- 버전 1.0.39로 업데이트 [`e4a28a9`](https://github.com/zereight/gitlab-mcp/commit/e4a28a9a47540214587169b7d3f3a98fe057c7d8)

#### [v1.0.38](https://github.com/zereight/gitlab-mcp/compare/v1.0.37...v1.0.38)

> 17 May 2025

- fix: add `expanded` to `start` and `end` for GitLabDiscussionNoteSchema [`#40`](https://github.com/zereight/gitlab-mcp/pull/40)
- Bump version [`0bb59a3`](https://github.com/zereight/gitlab-mcp/commit/0bb59a3217f4c3dd98b51503bf2de51d8578bb0d)

#### [v1.0.37](https://github.com/zereight/gitlab-mcp/compare/v1.0.36...v1.0.37)

> 15 May 2025

- Adds threaded comment support for merge requests [`#38`](https://github.com/zereight/gitlab-mcp/pull/38)
- Support resolving merge request discussion notes [`#37`](https://github.com/zereight/gitlab-mcp/pull/37)
- feat: Add create_merge_request_thread tool for diff notes [`026dd58`](https://github.com/zereight/gitlab-mcp/commit/026dd58887079bb60187d6acacaafc6fa28d0c3d)
- feat: Implement add_merge_request_thread_note function for adding notes to existing MR threads [`3f2b355`](https://github.com/zereight/gitlab-mcp/commit/3f2b35535ee93b14a6649074608842d1ff8de208)
- feat: support resolving merge request notes [`bde83c0`](https://github.com/zereight/gitlab-mcp/commit/bde83c0a912ba60026abd1954e764bb09d5a013d)

#### [v1.0.36](https://github.com/zereight/gitlab-mcp/compare/v1.0.34...v1.0.36)

> 13 May 2025

- feat: Decode project_id for GitLab API calls [`08ab135`](https://github.com/zereight/gitlab-mcp/commit/08ab1357a0bfdef0bf6360f0c61759f25405652b)
- [main] refactor: update label_id schema to use string type [`bf250b0`](https://github.com/zereight/gitlab-mcp/commit/bf250b0d88fad864a93ae2d95c0f99b7eb827498)
- [main] chore: update version to 1.0.35 🚀 [`651072d`](https://github.com/zereight/gitlab-mcp/commit/651072dfd7926101b77f095d5ce2ab9d0fe6af58)

#### [v1.0.34](https://github.com/zereight/gitlab-mcp/compare/1.0.32...v1.0.34)

> 7 May 2025

- feat: Gitlab list repository tree tool [`#35`](https://github.com/zereight/gitlab-mcp/pull/35)
- feat: support search by branch for get_merge_request [`#34`](https://github.com/zereight/gitlab-mcp/pull/34)
- fix: rename to source branch [`7b8cbc0`](https://github.com/zereight/gitlab-mcp/commit/7b8cbc0806ed9123e033d98f4965fd6fbc532c07)
- [main] docs: update README with detailed descriptions for merge request functions [`3a25e7c`](https://github.com/zereight/gitlab-mcp/commit/3a25e7c5e8b9e21585068db15e61818ca542f0f9)
- [main] chore: update version to 1.0.34 [`23a9bbc`](https://github.com/zereight/gitlab-mcp/commit/23a9bbc728a4171eb362d6458ef165d3f9246564)

#### 1.0.32

> 25 April 2025

- feat: Implement proxy configuration for HTTP/HTTPS/SOCKS [`#33`](https://github.com/zereight/gitlab-mcp/pull/33)
- feat: Add read-only mode support [`#29`](https://github.com/zereight/gitlab-mcp/pull/29)
- Add schemas for GitLab discussion notes and merge request discussions [`#26`](https://github.com/zereight/gitlab-mcp/pull/26)
- :sparkles: Add `list_group_projects tool` [`#25`](https://github.com/zereight/gitlab-mcp/pull/25)
- Update README.md [`#24`](https://github.com/zereight/gitlab-mcp/pull/24)
- Fixed types for create_merge_request and get_merge_request tools. [`#23`](https://github.com/zereight/gitlab-mcp/pull/23)
- Authentication Header Consistency Fix [`#22`](https://github.com/zereight/gitlab-mcp/pull/22)
- Labels API Support [`#21`](https://github.com/zereight/gitlab-mcp/pull/21)
- Improve README documentation with detailed tool descriptions [`#18`](https://github.com/zereight/gitlab-mcp/pull/18)
- Implement GitLab Issues and Issue Links API [`#17`](https://github.com/zereight/gitlab-mcp/pull/17)
- Add GitLab Projects API support [`#16`](https://github.com/zereight/gitlab-mcp/pull/16)
- Add GitLab Namespaces API support [`#15`](https://github.com/zereight/gitlab-mcp/pull/15)
- Fix GitLab API fork repository parameter handling [`#14`](https://github.com/zereight/gitlab-mcp/pull/14)
- Fix GitLab API parameter handling in create_or_update_file [`#13`](https://github.com/zereight/gitlab-mcp/pull/13)
- Improve code documentation with bilingual JSDoc comments [`#11`](https://github.com/zereight/gitlab-mcp/pull/11)
- Fix URL construction with smart API URL normalization [`#10`](https://github.com/zereight/gitlab-mcp/pull/10)
- Fix createNote function URL construction: use plural resource names and avoid duplicate /api/v4 [`#7`](https://github.com/zereight/gitlab-mcp/pull/7)
- Added missing api url part to create_note [`#3`](https://github.com/zereight/gitlab-mcp/pull/3)
- Deployment: Dockerfile and Smithery config [`#2`](https://github.com/zereight/gitlab-mcp/pull/2)
- add MCP server badge [`#1`](https://github.com/zereight/gitlab-mcp/pull/1)
- build: test-note.js 파일 삭제 [`61ee124`](https://github.com/zereight/gitlab-mcp/commit/61ee1244f431c591f199d93d683f2f9b573e48b6)
- Add compiled JavaScript files for Issue Links API schema fix [`a4d7795`](https://github.com/zereight/gitlab-mcp/commit/a4d7795a7ab28a28a3863e8cc77322d6829ec713)
- Build upd. [`5d10401`](https://github.com/zereight/gitlab-mcp/commit/5d1040141d20169420e63e67c438a9a942d157d6)

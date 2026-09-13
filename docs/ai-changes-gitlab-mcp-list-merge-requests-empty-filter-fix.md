# 修复 list_merge_requests 空筛选参数

## 问题背景

部分 MCP 客户端会把未填写的 `list_merge_requests` 可选参数传为空字符串或空数组。服务端完成 Schema 解析和互斥参数清理后，仍会把这些空值序列化到 GitLab API 查询字符串中，例如：

上游 Issue：[#740](https://github.com/zereight/gitlab-mcp/issues/740)

```text
assignee_id=&assignee_username=&author_id=&author_username=
```

GitLab 会把同时出现的 ID 与 username 参数视为互斥参数冲突，并返回 `400 Bad Request`。

## 变更内容

- 在 Merge Request 列表查询参数序列化边界忽略空字符串和空数组。
- 保持 `false`、`0` 等有意义的假值不变。
- 增加端到端回归测试，模拟 GitLab 拒绝空筛选参数，并验证最终请求 URL 不包含空参数。

## 验证策略

- 修改实现前运行新增测试，确认请求包含空筛选参数并收到模拟的 `400 Bad Request`。
- 修改实现后运行 `list_merge_requests` 专项测试。
- 运行参数清理工具测试、类型构建和项目 Mock 测试，检查下游影响。

## 影响范围

变更仅影响 `list_merge_requests` 和复用同一序列化函数的 Merge Request 列表请求。非空筛选参数、布尔值和数值仍按原逻辑传递；不改变写操作或其他工具的通用参数清理行为。

## 验证结果

- `npm run test:list-merge-requests`：5 项全部通过。
- `list_group_merge_requests` 回归测试：3 项全部通过。
- 参数清理工具测试：9 项全部通过。
- `npm run build`：通过。
- Prettier 检查：通过。
- 完整 Mock 测试需使用 Node.js 22；运行过程中发现 `remote-auth-simple-test.ts` 的既有 Session 状态码断言失败（期望 404，实际 406），与本次查询参数序列化变更无关。
- 仓库当前 ESLint 9 脚本缺少 `eslint.config.*`，因此 Lint 未能执行；本次不修改该既有工程配置。

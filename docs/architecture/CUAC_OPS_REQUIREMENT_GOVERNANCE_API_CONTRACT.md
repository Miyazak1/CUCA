# CUAC Ops 目录要求治理 API 合同

状态：2026-09-03 本地生产地基完成。本文覆盖项目批次要求的内部起草、双人审批、发布与撤回，不代表真实来源、法律文案或阿里云 staging 已获业务批准。

## 1. HTTP 能力

- `GET /api/v1/ops/catalog/programs/:programId/intakes/:intakeId/requirements`：分页读取版本和当前发布指针。
- `POST /api/v1/ops/catalog/programs/:programId/intakes/:intakeId/requirements`：以调用方生成的稳定 UUID 起草一个版本。
- `GET /api/v1/ops/catalog/programs/:programId/intakes/:intakeId/requirements/:versionId`：读取一个内部治理版本。
- `POST .../:versionId/approval`：绑定精确内容摘要、来源检查、范围确认和复核期限。
- `PUT .../:versionId/publication`：以内容摘要、审批摘要和发布 revision 执行 CAS 发布。
- `POST .../:versionId/withdrawal`：以发布 revision 和固定原因执行撤回。

身份、角色、surface、purpose、tenant 和 auth strength 只从当前 Cookie 会话解析。program、intake 和 version 身份只来自路由；body 或 query 不能覆盖。所有入口经过统一同源、JSON、请求大小、`no-store` 和请求 ID 边界。

## 2. 权限与职责分离

| 操作 | `cuac_ops` | `cuac_admin` |
| --- | --- | --- |
| 读取内部版本 | session 或 step-up | session 或 step-up |
| 起草 | session 或 step-up | session 或 step-up |
| 审批 | 禁止 | 必须 step-up |
| 发布 | 禁止 | 必须 step-up |
| 撤回 | 禁止 | 必须 step-up |

审批人不得是起草人。每次读写都在事务内重锁 active account 和匹配当前角色的 live staff grant；授权撤销后旧会话立即失去能力。Agent、student、school_staff、guest 和非 `catalog_management` purpose 均无此接口权限。

## 3. 数据与事务不变量

- 要求文档使用严格 schema、规范化摘要、有限集合和 UTF-8 大小上限；来源检查不会被公开投影。
- 版本号在精确 intake 内分配；同 UUID 重放只在 scope、起草人和内容摘要完全一致时恢复。
- 审批绑定起草人、复核人、program、intake、version、内容摘要、每条来源摘要及数据库时间。
- 发布和撤回使用 revision CAS；并发发布/撤回不能覆盖替代版本或复活已撤回版本。
- 业务状态与 metadata-only audit 同事务提交；审计失败不留下草稿、审批、发布或撤回的部分状态。
- 公开读取继续使用防枚举合同：不存在、未发布、撤回或过期均为 `200 { "data": null }`，损坏的已发布证据以脱敏 503 失败关闭。

## 4. 本地证据

- requirement governance unit/HTTP 定向复跑：11/11。
- `npm run test:backend`：706/706，其中 `test:server` 为 632/632。
- `npm run db:pg:rehearse`：408/408，PostgreSQL 16.13。
- `npm run db:http:rehearse`：515/515；真实生产构建完成起草、普通管理员会话拒绝、密码 step-up、双人审批、发布、公开读取、撤回和授权撤销后拒绝。
- `npm run local:smoke`：持久本地库通过 `cuac_ops` 当前授权读取实际 program/intake 的治理列表。
- TypeScript、聚焦 ESLint 和 `git diff --check` 通过；没有新增迁移，仍为 43 条迁移、69 表、1048 列、386 个约束、264 个索引，detached release 保持 `161acf06e323e3b9f554cba56f1e2c134651414b8dc6a6eb027364fa3266abf8`。

## 5. 未完成边界

真实来源、适用范围、复核人员、法律文案和内容批准仍需产品流程；Ops data quality 与 routing 队列尚未完成。隔离支付事件复核已由后续 [Ops 账务复核合同](CUAC_OPS_BILLING_REVIEW_CONTRACT.md) 收口，但退款发起和人工补偿仍未开放。真实员工 IdP/MFA、外部告警、前端管理界面、云端 RDS/KMS/WAF 和浏览器 staging 也不在本合同完成范围内。

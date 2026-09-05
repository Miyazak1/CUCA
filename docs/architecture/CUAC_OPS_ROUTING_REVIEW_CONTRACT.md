# CUAC Ops 官方递交路由复核合同

日期：2026-09-03。状态：隔离官方递交 outbox 的读取、认领、升级、双人无重试关闭和受限单次重试已完成本地、真实 PostgreSQL 与生产构建 HTTP 验收。本文不授权修改申请材料、切换学校/route/provider、伪造学校收件、绕过递交政策或重复重试。

## 1. HTTP 能力

- `GET /api/v1/ops/routing/submissions`：按隔离时间倒序读取固定最小投影；只接受 UUID `cursor` 和 `1..50` 的 `limit`。
- `POST /api/v1/ops/routing/submissions/:outboxId/review-claim`：以 `expectedRevision: 0` 认领当前隔离 generation。
- `POST .../:outboxId/review-escalation`：当前认领人以 revision CAS、固定升级代码和有限证据引用升级。
- `POST .../:outboxId/review-close`：不同的 `cuac_admin + step_up` 以 revision CAS、固定关闭代码和有限证据引用关闭且不重试。
- `POST .../:outboxId/review-retry`：不同的 `cuac_admin + step_up` 仅对明确耗尽五次且确认未获 provider 接受的 generation 批准一次重试。

身份、角色、surface、purpose、tenant 和 auth strength 只来自当前 Cookie 会话。outbox 身份只来自路由；body/query 不能覆盖。所有入口经过统一同源、JSON、大小、`no-store`、请求 ID 和 UUID 边界。

## 2. 权限与职责分离

| 操作 | `cuac_ops` | `cuac_admin` |
| --- | --- | --- |
| 读取、认领 | session 或 step-up | session 或 step-up |
| 升级 | 仅原认领人，且原 grant 仍有效 | 仅原认领人，且原 grant 仍有效 |
| 无重试关闭、批准重试 | 禁止 | 必须 step-up，且不能是认领人 |

每次读写都在事务内锁定并重验 active account、当前角色和 live staff grant。认领记录绑定精确 user、role 和 grant；授权撤销或重发不会让旧认领恢复能力。Agent、student、school_staff、guest 和非 `routing_review` purpose 均无权限。

## 3. 队列最小投影

队列只返回 outbox/group/school UUID、学校英文名、固定 admission route key、外部渠道类型、成员数、尝试数、受控 outcome/error、隔离时间、服务器计算的重试资格和当前 generation 的复核状态。它不返回：

- 学生身份、CUAC ID、申请正文或材料；
- outbox payload、payload 摘要、密文、密钥或 provider receipt；
- provider 名称、外部消息编号或人工交接内容；
- 员工 grant ID、自由文本备注或 Agent 上下文。

审计 metadata 只记录 review UUID、revision、状态、来源 outcome/attempt count 和固定代码，不保存证据引用、学校/学生身份、payload 或 provider 凭据。

## 4. 生命周期与重试边界

- `ops_submission_delivery_reviews` 以 `outbox + source_quarantined_at` 唯一绑定一个隔离 generation；只把 source outcome、error、attempt count 和微秒级隔离时刻全部匹配的复核视为当前复核。
- `unknown` 与 `invalid_payload` 永远不能经人工复核进入重试；只能升级或 `closed_no_retry`。未知 provider 结果不能按“失败”盲目重发，payload/binding 错误必须先走独立修复流程。
- 只有 `attempt_limit + ATTEMPT_LIMIT + attempt_count=5` 且没有 delivery receipt 的当前 generation 可进入 `retry_approved`。每个 outbox 由部分唯一索引保证终身最多一次人工重试批准。
- 批准重试复用原 outbox/group，保留既有 provider 与 payload 绑定，只把 outbox/group 原子恢复为 pending，并把 attempt count 归零；不新建申请、不重算材料或 route。
- 重试后若再次隔离，可基于新 `source_quarantined_at` 建立新的复核，但不能再批准第二次重试。
- `investigating` 固定 revision 1；升级后为 revision 2；直接关闭/重试为 revision 2，升级后关闭/重试为 revision 3。
- 升级、关闭和重试只接受固定代码；证据引用只允许 1..128 个 ASCII 字母、数字、点、下划线、冒号或连字符，不接受自由文本。
- 认领、升级、关闭、重试及 metadata-only audit 同事务提交；审计失败时 review、outbox 和 group 状态全部回滚。
- generation 比较在 PostgreSQL 内完成，不把带微秒的 `quarantined_at` 往返为 JavaScript 毫秒后再比较。

## 5. 本地证据

- `npm run test:ops-routing-review`：12/12。
- `npm run test:backend`：732/732。
- `npm run db:pg:schema:check`：45 条迁移、36 份快照、71 表一致。
- `npm run db:pg:rehearse:routing-review`：3/3，PostgreSQL 16.13；覆盖 generation 绑定、唯一认领、授权撤销、审计回滚、未知/非法 payload 不可重试、一次重试和业务绑定不变。
- `npm run db:http:rehearse`：522/522；真实生产构建覆盖 Cookie 会话、最小投影、身份/字段注入拒绝、认领、升级、普通管理员拒绝、密码 step-up、双人关闭/重试及撤权后 403。
- `npm run local:smoke`：持久本地库从 44 条升级至 45 条迁移，`cuac_ops` 通过真实 API 读取路由复核队列。
- TypeScript、聚焦 ESLint 与生产构建通过。真库结构为 71 表、1088 列、402 个约束、273 个索引；detached release 为 `114bf612ee84ff1b4cceed731c3802ffa703fa3dfbc1670c4cfebd53d2456f65`。

## 6. 未完成边界

真实员工 IdP/MFA、值班与外部告警、学校/provider case 接线、data quality、payload/route 受控修复、退款补偿、管理前端和阿里云 staging 均未完成。一次人工重试只表示重新进入受监管 worker 队列，不代表 provider 接受、学校签收或申请成功。

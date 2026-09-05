# CUAC Ops 隔离支付事件复核合同

日期：2026-09-03。状态：隔离支付事件的读取、认领、升级和双人无变更关闭已完成本地、真实 PostgreSQL 与生产构建 HTTP 验收。本文不授权人工改账、事件重放、退款发起或真实商户操作。

## 1. HTTP 能力

- `GET /api/v1/ops/billing/provider-events`：按隔离时间倒序读取固定最小投影；只接受 UUID `cursor` 和 `1..50` 的 `limit`。
- `POST /api/v1/ops/billing/provider-events/:eventId/review-claim`：以 `expectedRevision: 0` 认领一个尚无复核记录的隔离事件。
- `POST .../:eventId/review-escalation`：当前认领人以 revision CAS、固定升级代码和有限证据引用升级。
- `POST .../:eventId/review-resolution`：不同的 `cuac_admin + step_up` 以 revision CAS、固定关闭代码和有限证据引用执行 `resolved_no_change`。

身份、角色、surface、purpose、tenant 和 auth strength 只来自当前 Cookie 会话。事件身份只来自路由；body/query 不能覆盖。所有入口经过统一同源、JSON、大小、`no-store`、请求 ID 和 UUID 边界。

## 2. 权限与职责分离

| 操作 | `cuac_ops` | `cuac_admin` |
| --- | --- | --- |
| 读取、认领 | session 或 step-up | session 或 step-up |
| 升级 | 仅原认领人，且原 grant 仍有效 | 仅原认领人，且原 grant 仍有效 |
| 无变更关闭 | 禁止 | 必须 step-up，且不能是认领人 |

每次读写都在事务内锁定并重验 active account、当前角色和 live staff grant。认领记录绑定精确 user、role 和 grant；授权撤销或重发不会让旧认领恢复能力。Agent、student、school_staff、guest 和非 `billing_review` purpose 均无权限。

## 3. 数据最小化

队列只返回事件 UUID、固定 provider、provider event 外部编号、事件类型、invoice/payment 内部 UUID、整数金额/币种、受控时间、隔离原因和复核状态。它不返回：

- webhook payload 或 `payloadSha256`；
- provider payment ID、checkout session ID 或支付凭据；
- 员工 grant ID；
- 学生身份、邮箱、申请正文或 Agent 上下文。

审计 metadata 只记录 review UUID、revision、状态和固定代码，不保存证据引用、provider payment/session ID 或原始 payload。

## 4. 生命周期与不变量

- `ops_payment_event_reviews` 对每个隔离事件最多一条记录；认领并发严格只有一个成功。
- `investigating` 固定 revision 1；`escalated` 固定 revision 2；直接无变更关闭为 revision 2，升级后关闭为 revision 3。
- 升级代码固定为 provider 调查、财务审批、安全调查或内部数据修复；关闭代码固定表示已确认无需改变账务事实。
- 证据引用只允许 1..128 个 ASCII 字母、数字、点、下划线、冒号或连字符，不接受自由文本。
- 认领、升级、关闭和 metadata-only audit 同事务提交；审计失败时业务状态回滚。
- 关闭只能写复核表。它不更新 `payment_provider_events`、`payments`、`invoices`、`application_fee_entitlements`，不重放 provider event，也不授予/撤销权益。
- 当前没有 reopen、force resolve、manual settle、manual refund 或 delete API。需要改账的异常必须进入未来独立、经批准的补偿流程。

## 5. 本地证据

- `npm run test:ops-billing-review`：11/11。
- `npm run test:backend`：718/718，其中 `test:server` 为 633/633。
- `npm run db:pg:schema:check`：44 条迁移、35 份快照、70 表一致。
- `npm run db:pg:rehearse`：411/411，PostgreSQL 16.13；覆盖并发认领、撤权、审计回滚、数据库绕过拒绝和支付事实不变。
- `npm run db:http:rehearse`：519/519；真实生产构建覆盖列表、字段注入拒绝、认领、升级、普通管理员拒绝、密码 step-up、双人关闭及撤权后 403。
- `npm run local:smoke`：持久本地库升级至 44 条迁移，`cuac_ops` 通过真实 API 读取账务复核队列。
- TypeScript、聚焦 ESLint 与生产构建通过。真库结构为 70 表、1066 列、394 个约束、268 个索引；detached release 为 `5a4b6d399cca251b02d39c414731bd29ccf0692b0ef88f0f293b53b4bd40e306`。

## 6. 未完成边界

真实员工 IdP/MFA、岗位分组、外部 provider case 接线、自动告警、值班升级、CUAC 发起退款的双人审批、受控补偿/重放、管理前端和阿里云 staging 均未完成。支付仍默认关闭；本地通过不代表真实收费、商户验收或部署批准。

后续 `0044` 已新增独立的官方递交路由复核，不改变本合同的支付事实边界。当前仓库总证据与结构计数见 [Ops 路由复核合同](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md) 和 [PostgreSQL 演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

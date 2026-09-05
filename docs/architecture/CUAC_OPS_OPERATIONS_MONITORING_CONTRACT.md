# CUAC Ops 运营监控合同

日期：2026-09-03。状态：固定五队列聚合摘要已完成本地、真实 PostgreSQL 和生产构建 HTTP 验收；不是自动告警、队列控制台或完整 Ops Admin。

## 1. 目标与入口

唯一入口为私有 `GET /api/v1/ops/operations/summary`。它提供跨异步管道的最小运营态势，不提供记录明细、用户搜索、队列重放、状态修改或任意分析查询。

请求不接受 query 参数或 body。客户端不能选择指标、数据源、时间窗、用户、学校、申请、支付或 SQL；注册表和 24 小时异常窗口均由代码固定。Agent 工具注册表不包含该入口。

## 2. 授权与审计

- 仅当前密码会话或 step-up 会话中的 `cuac_ops`、`cuac_admin` 可用，必须选择 Ops surface、无学校 tenant，purpose 固定为 `ops_monitoring`。
- session 解析后，repository 仍在事务内锁定并重验当前员工 access grant。授权撤销、到期、角色不匹配或账号失效均返回 403，不能依赖会话中的历史角色。
- 每次成功读取写入 `ops.operations_summary.read`，resource 固定为 `ops_operations_registry/cuac.ops-operations-registry.v1`。
- 审计 metadata 只含注册表版本、队列数和四类总计。审计写入失败时 HTTP 返回脱敏 500，不返回已读取的摘要。

## 3. 固定注册表

注册表版本为 `cuac.ops-operations-registry.v1`，顺序和来源固定：

| queueKey | 受控来源 | due | inFlight / expiredLease | 最近 24 小时 exception |
| --- | --- | --- | --- | --- |
| `auth_email_delivery` | `auth_email_outbox` | 已到 `available_at` 的 queued | leased/sending，按 `lease_expires_at` 区分 | failed/uncertain |
| `notification_delivery` | `notification_deliveries` | email/sms 且已到期的 queued | leased/sending，按租约区分 | failed/uncertain |
| `student_file_processing` | `student_file_assets` | 已到期的 pending_scan/delete_pending | scanning/deleting，按租约区分 | malware/integrity_mismatch/scan_error |
| `official_submission_delivery` | `official_submission_outbox` | 已到期的 pending | leased/sending，按租约区分 | quarantined |
| `payment_reconciliation` | `payment_provider_events` | 已到 `next_attempt_at` 的 pending | 当前持久化模型无租约，固定为 0 | quarantined |

全部队列共享一次数据库时钟。每行只返回 `dueCount`、`inFlightCount`、`expiredLeaseCount`、`exceptionsLast24Hours` 和 `oldestDueAt`，另返回四项合计。计数必须是非负安全整数；五行缺失、乱序、日期不一致、最老到期时刻矛盾或超范围时整体返回脱敏 503。

## 4. 数据最小化

响应不返回 user ID、邮箱、文件名、对象 key、CUAC ID、application ID、payment ID、invoice ID、提供方引用或消息正文。固定 SQL 只做聚合，不选取这些列；本地 smoke 还会检查响应中不存在对应字段和值。

这是队列健康摘要，不是业务统计。`dueCount=0` 不证明外部提供方可达；`exceptionsLast24Hours=0` 不证明投递、收件、扣款或文件扫描已经完成。外部监控系统、阈值、告警通知、值班升级和 runbook 执行仍需在 staging 单独验收。

## 5. 可复跑证据

在 `D:\CODE\CUAC\frontend`：

- `npm run test:ops-monitoring`：8/8。
- `npm run test:backend`：702/702 分组测试通过。
- `npm exec tsc -b --pretty false` 与聚焦 ESLint：通过。
- `npm run db:pg:rehearse`：407/407，PostgreSQL 16.13。
- `npm run db:http:rehearse`：513/513，包含生产构建、真实 Cookie、审计故障、固定响应、参数拒绝和撤权后 403。
- `npm run local:smoke`：持久本地 PostgreSQL 与三角色实际 API 通过，五个固定 queueKey 全部返回且无敏感字段。

本批次没有新增 migration。schema 保持 43 条迁移、69 表、1048 列、386 个约束和 264 个索引；detached migration release 仍为 `161acf06e323e3b9f554cba56f1e2c134651414b8dc6a6eb027364fa3266abf8`。

## 6. 未完成边界

data quality 与 routing 的岗位队列及写流程尚未完成；catalog requirements 与隔离支付事件复核已由后续合同收口，但退款补偿、真实员工 IdP/MFA、外部指标采集、自动告警、值班升级、队列重放和阿里云 staging 仍待验收。上述能力完成前，不能把本摘要描述为完整 Ops Admin 或生产监控闭环。

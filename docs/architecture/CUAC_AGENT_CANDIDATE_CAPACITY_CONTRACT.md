# CUAC Agent 待确认候选容量合同

日期：2026-09-01。

状态：`0032_agent_candidate_capacity` 已在本地 PostgreSQL、构建后 HTTP、Linux 迁移运行时和持久本地库中验证。该状态不启用完整 Agent、生产长期记忆、自然语言业务写入、自由 SQL、支付、递交、学校或 Ops 写操作。

## 1. 目的与边界

Agent candidate 是服务端从当前交互中提取的短期、结构化、低敏学习偏好建议，等待用户查看或确认。它不是完整对话、模型消息、提示词、工具调用记录、申请数据副本或支付数据。

本合同解决两个问题：

1. 一个访客浏览器或学生账号不能无限堆积待确认候选。
2. 同一所有者最后一个名额上的并发请求不能同时越过容量检查。

候选只允许现有 `study_goal` 结构和 `low_sensitive_preference` 数据分类。学校 tenant、老师、Ops、支付、证件、成绩正文、申请材料和其他敏感内容不进入这条持久化路径。完整聊天仍不落库。

## 2. 初始容量

| 所有者范围 | 活跃待确认上限 | 最长期限 | 所有者键 |
| --- | ---: | ---: | --- |
| 已验证 guest 浏览器绑定 | 12 | 24 小时 | 签名 guest session 解析出的单向 `anonymous_session_hash` |
| 已登录 student 账号 | 24 | 7 天 | `user_id` 与精确 `user:{userId}:student` namespace |

上限是服务端安全策略，不由客户端、页面或模型参数决定。它可以在后续容量评审中通过代码、迁移和测试一起调整，不能只改前端显示。

以下条件全部满足时才占用一个名额：

- `status = 'proposed'`；
- `payload_cleared_at is null`；
- `expires_at` 是有限 PostgreSQL 时间；
- `expires_at > clock_timestamp()`；
- scope、role、tenant、账号/浏览器绑定和 student namespace 与当前所有者完全一致。

已接受、已拒绝、已擦除、已到期、无限期限、其他账号、其他浏览器、其他 persona 或 tenant 候选都不占用当前所有者的活跃配额。到期不等于正文已经从主库、WAL 或备份擦除；正文物理清理仍依赖受控候选清理批次和生产保留流程。

## 3. 并发与事务

生产 HTTP 组合必须通过 `createPostgresAgentContextService` 和 `transactionalMethod`，让候选创建、成功审计与容量锁使用同一 PostgreSQL READ COMMITTED 事务。不得把 `PostgresAgentContextRepository.createCandidate` 作为无事务的公开调用入口。

每次创建先取得事务级 advisory lock：

- guest 使用带 `guest:` 前缀的浏览器绑定 namespace；
- student 使用带 `student:` 前缀的账号 namespace；
- 两类 namespace 相互隔离；哈希碰撞最多造成额外串行，不会放宽配额。

锁和计数/插入必须是两个 SQL statement。原因是 PostgreSQL 中一个已经开始并等待 advisory lock 的 statement 保留等待前取得的 MVCC snapshot；如果在同一 statement 内等待、计数并插入，两个请求可能都看到旧计数。先独立取得事务锁，再执行第二条计数/插入语句，后一个请求才会读取前一个已提交结果。

计数与 INSERT 使用同一条固定、参数化 SQL 和同一个数据库时钟 CTE。只有 `stored_count < capacity` 才返回插入记录。无返回行时事务拒绝，不产生候选或成功审计。

## 4. HTTP 与审计

容量耗尽返回：

- HTTP `429`；
- 稳定错误码 `TOO_MANY_REQUESTS`；
- 通用说明：确认现有候选或等待其到期后再试；
- 不返回当前计数、账号/浏览器标识、候选正文、数据库细节或其他所有者状态。

拒绝事件在业务事务回滚后通过现有拒绝审计路径记录。审计 metadata 只包含 `deniedCode: TOO_MANY_REQUESTS` 等受控字段，不包含 summary、structured payload、来源实体、Cookie、guest token 或 user data。

容量控制不是全局速率限制。Gateway/WAF、IP/设备级滥用控制、模型调用预算、请求频率、总墓碑保留和存储字节预算仍需独立设计。

## 5. Schema 与迁移

`0032_agent_candidate_capacity.sql` 不新增表、列、角色、路由或业务写权限，只增加两个部分索引：

- `agent_context_candidates_guest_pending_capacity_idx`：`anonymous_session_hash, expires_at`；
- `agent_context_candidates_student_pending_capacity_idx`：`user_id, expires_at`。

索引 predicate 固定为未擦除、`proposed`、精确 guest/student scope、无 school tenant，并约束对应 owner 字段形状。数据库 schema 当前为 58 表、864 列、310 约束、210 索引。

不可变工件：

- 0032 SQL SHA-256：`3ec80be7f5fb440eccc457da94cc4c406f85c398f65cf84593b8ececc3121ad9`；
- 0032 snapshot SHA-256：`cde55939b6190ecd0c449a4c992e1f3ba9cac39285364456335fcd004a80bf38`；
- journal：`idx=32`、`when=1788251915379`、tag=`0032_agent_candidate_capacity`；
- 最终离线迁移包：`b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`；
- Linux 验收镜像：`sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`。

## 6. 验收证据

- `npm run test:server`：523/523；
- `npm run db:pg:rehearse`：379/379，专用真实 PostgreSQL 入口；
- `npm run db:http:rehearse`：477/477，包含完整真库与构建后网络入口；
- `npm run db:linux:rehearse`：7/7；
- `npm run db:pg:schema:check`：33 条迁移、24 份快照、58 表；
- TypeScript、目标 ESLint、迁移历史篡改/缺失/重排和可重现发布包测试通过。

真实并发测试先填至最后一个 guest 名额，再让两个事务在同一 advisory lock 上等待；锁释放后严格只有一个成功，另一个得到 429，最终活跃数仍为 12。另有测试证明 guest/student 上限不同、其他浏览器和账号不共享配额、到期候选释放名额、拒绝审计不带正文，以及构建后的 HTTP 响应保持脱敏。

持久本地库已从 32 条迁移升级为 33 条，应用与数据库健康检查通过；smoke 仍验证同校两个项目为两份独立申请。所有数据均为 local-only synthetic fixture。

## 7. 生产开放门槛

在生产长期记忆或真实对话链路开放前，仍必须完成：

- 用户可见的候选查看、确认、删除和记忆开关 UX；
- 候选与到期记忆清理调度、积压指标、告警、失败恢复和审计巡检；
- Gateway/WAF 与模型预算层的速率、滥用和成本控制；
- 浏览器切换、登录继承、账号/角色撤销和在途事务的端到端验证；
- RDS TLS、最小权限、备份/WAL/恢复与删除责任验证；
- 模型供应商的数据保留、日志、区域和隐私审批；
- 阿里云 staging 的迁移、压力、恢复和安全验收。

任何这些门槛都不能由“本地候选配额已通过”代替。Agent 继续是受限的信息整理与表达层，只能通过受审 Tool Gateway 获取最小投影；它不获得数据库连接、自由 SQL 或敏感业务写权限。

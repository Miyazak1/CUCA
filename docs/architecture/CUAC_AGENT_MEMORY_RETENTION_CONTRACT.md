# CUAC Agent 记忆有限保留与到期清理合同

日期：2026-09-01。

状态：本地实现并封存；生产长期记忆、自动调度与云端运行仍未启用。

本合同补充 [Agent 上下文生命周期规范](CUAC_AGENT_CONTEXT_LIFECYCLE_SPEC.md)、[候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md) 和 [记忆管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md)。它只规定当前 student persona 的低敏结构化记忆，不授予 Agent 数据库凭据、自由 SQL、学校/Ops 数据、支付数据或申请写权限。

## 1. 决策

1. Agent 不保存原始聊天记录作为长期记忆。
2. 当前唯一可确认的长期类型是 `study_goal`，数据分类固定为 `low_sensitive_preference`，正文必须通过服务端结构白名单重新验证和生成摘要。
3. 学生必须逐项明确确认；注册、登录、打开页面、继续聊天和 Agent 推断都不能自动创建或续期长期记忆。
4. 每条已确认学生记忆从数据库创建时间起最多保留 365 天。用户单项清除、全部清除、停用记忆或删除账号可使正文更早失效。
5. 到期后业务读取立即排除该记录；受信维护批次随后擦除正文，只保留最小墓碑、归属、分类、时间和审计关系。

## 2. 什么值得记

当前可提议并在确认后保存：目标国家/地区、学位层级、宽泛专业方向、授课语言、城市偏好、预算区间、奖学金兴趣和入学时间等稳定、低敏、可结构化的学习偏好。

以下信息对产品流程可能重要，但不能进入 Agent 长期记忆：

- 姓名、电话、邮箱、国籍、当前学校；
- 精确成绩、考试结果、教育经历；
- 家庭收入、资产、付款状态或支付凭据；
- 收藏、Application Choice、材料选择、授权、快照和申请状态的权威事实；
- 学校 tenant 数据、Ops 支持记录、文件正文、令牌和秘密。

这些数据必须由对应 Profile、Education、Assessment、Application、Billing 或学校域服务管理。Agent 只能通过 Tool Gateway 获取当前角色允许的最小投影，不得把业务事实复制成自己的长期事实源。

## 3. 生命周期

| 数据层 | 当前期限 | 到期行为 |
| --- | --- | --- |
| 页面/对话 working context | 当前页面或短会话 | 关闭或切换身份时丢弃；不写长期表 |
| Guest preference candidate | 最多 24 小时 | 不能直接成为长期记忆；到期不可继承，候选清理批次擦除正文 |
| 已登录 student candidate | 最多 7 天 | 仍需学生明确确认；到期不可确认，候选清理批次擦除正文 |
| Confirmed student memory | 创建后最多 365 天 | 读取立即隐藏；受信批次擦除正文和安全归属内的旧候选副本 |
| Audit metadata | 独立安全保留政策 | 不因记忆清除而伪装成不存在；不得含偏好正文 |

365 天是上限，不是自动承诺保留满一年，也不是申请档案、法律记录、备份或审计的保留期限。当前不会因读取、聊天、推荐或重新登录滑动续期。未来若允许用户重新确认，必须创建新的明确证据和新的受控期限，不能静默更新旧行。

## 4. 数据库强制

迁移 `0031_agent_memory_retention.sql`：

- 对 active、student、无 tenant、`low_sensitive_preference` 记忆要求有限 `created_at` 和 `expires_at`；
- 强制 `expires_at <= created_at + interval '365 days'`，绕过服务直接写入也不能得到永久或超长期记忆；
- 升级旧库时保留更早的有限到期时间，把 null/无限期限设置为创建后 365 天，并把更晚期限截断到上限；不修改 summary、structured payload、来源或用户控制设置；
- 对应到期扫描使用部分索引；已清除墓碑不被重新解释为有效正文；
- 迁移前若历史创建时间本身非法则整批失败，不猜测修复。

新确认由 PostgreSQL `clock_timestamp()` 同时生成创建时间与到期时间。调用方不能传入或延长 expiry，应用服务器时钟偏差不会突破上限。

## 5. 到期清理

`sweepExpiredStudentMemories(client, batchSize)` 是内部维护函数，不是 HTTP API、Agent tool、学校/Ops 写能力或生产调度器。

- 每批 1 至 500 条，使用 `FOR UPDATE SKIP LOCKED`，可与其他受控批次协作而不抢占正在处理的记录。
- 只处理精确 student account namespace、无 tenant、低敏偏好且已到期、缺失期限或期限非法的未清除记录。
- 将 summary 置空、structured payload 置为空对象、source 改为 `retention_expired` 并写入 `cleared_at`。
- 只在来源和所有者关系可证明安全时擦除关联的已接受 guest/student 候选副本；绝不跨账号、角色、tenant 或数据分类清理。
- 变更与 `agent.memories.retention_sweep` 系统审计同一事务；审计失败整批回滚。审计只记录数量和策略版本，不记录偏好正文。
- 批次返回 0 只表示当前批次未取得记录，不证明全库已清空；生产调度、积压指标、告警、超时和重试仍需单独设计。

## 6. 权限与沙盒

学生本人通过服务器会话和 `student_action` purpose 管理自己的记忆。Agent runtime 即使以 student persona 回答，也不能调用清除、开关或维护函数；学校员工与 Ops 不共享或读取学生 Agent namespace。角色撤销、账号停用、persona/tenant 不匹配均在数据库事务内重新检查。

Agent 没有数据库连接串。所有未来读取仍必须经过固定 Tool Registry、Policy Enforcement Point 和字段投影；本合同不能被解释为允许 RAG 索引、模型供应商或日志系统接收记忆正文。

## 7. 擦除边界

正文清空是业务层擦除，不是磁盘安全擦除。PostgreSQL 旧行版本、长事务快照、WAL、只读副本、日志、备份和灾备副本有独立生命周期。生产前必须为 RDS 备份/PITR、日志和模型供应商各自确定保留及删除责任，并验证恢复后仍执行相同到期策略。不能用一次 UPDATE、VACUUM 或前端关窗声称所有副本都已删除。

## 8. 发布与回退

发布顺序：暂停并排空旧记忆写入者，备份并验证恢复点，运行 0031，部署只接受数据库时钟有限期的新 writer，再启用受控读取。清理调度器必须在独立审批、监控和回滚演练后才可启用。

回退时关闭相关写入与维护任务，保留新 expiry、约束、索引和墓碑；不得回退到可写 null/无限期限的旧 writer，也不得为了兼容而删除约束或恢复已擦除正文。

## 9. 验收证据

- `npm run test:server`：523/523。
- `npm run db:pg:rehearse`：379/379；`npm run db:http:rehearse`：477/477，后者包含完整真实 PostgreSQL 与构建后 HTTP 场景，入口有重叠。
- `npm run db:linux:rehearse`：7/7。
- Schema：33 条迁移、24 份快照、58 表、864 列、310 约束、210 索引。
- 0031 SQL SHA-256：`5814d6c114019fe4b38d7c636419a9067ee075d70880459aa89a1a1e1f616661`。
- 0031 snapshot SHA-256：`6a72fdba08b71e7ff248eb1d3cc6d7e8c6d6877192a4d6691f98078383d34ef4`。
- 当前最终离线发布包：`b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`；Linux 验收镜像：`sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`。
- 本地持久库已从 32 条升级到 33 条，health 与逐项目申请 smoke 通过。

这些证据只覆盖本地合成数据与离线发布运行。owner-scoped candidate 容量已本地验证，但生产自动清理调度、Gateway/WAF 滥用控制、浏览器控制 UX、在途 persona/session 撤权、RDS 备份删除、模型供应商零保留设置和阿里云 staging 仍是开放门槛。

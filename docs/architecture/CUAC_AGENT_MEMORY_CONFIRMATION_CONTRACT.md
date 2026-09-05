# CUAC Agent 记忆确认与事务合同

更新：2026-08-31。状态：BE-0708 的原子确认部分已本地验证；完整记忆生命周期和生产启用仍未验收。

## 1. 当前范围

只处理受控 `study_goal` 学习偏好候选，不存完整对话，不读取学生证件、申请原文或支付数据，不执行模型、不提供自由 SQL、不新增 Agent 业务写工具。前端唯一设计参考为 `design-lab/home-v3.html`；本次没有读取或修改任何前端页面。

生产接线使用 `createPostgresAgentContextService`，为以下三个方法提供同一连接、同一事务：

| 方法 | 事务内的成功操作 | 当前 HTTP |
| --- | --- | --- |
| `proposeCandidate` | 候选 INSERT + `agent.context_candidate.create` 成功审计 | `POST /api/v1/agent/context/candidates` |
| `acceptCandidateAsMemory` | 账号候选锁定/复查、消费标记、memory INSERT、`agent.memory.create` | 仅服务方法，未新增确认路由 |
| `carryForwardGuestCandidateToStudentMemory` | 游客候选锁定/复查、消费标记、memory INSERT、`agent.memory.carry_forward` | `POST /api/v1/agent/context/carry-forward` |

只构造 `new AgentContextService(mockRepository, auditSink)` 不构成事务保证。生产调用必须使用上述工厂。HTTP 不在 service 事务内部把异常转成成功结果；提交完成后才发送成功响应。

## 2. 归属与确认

1. 在访问候选前要求已认证学生、无学校 tenant、允许 `low_sensitive_preference`，并验证候选 UUID。游客不能直接创建持久记忆，学校/Ops 身份不能借学生记忆服务跨角色使用。
2. 游客继承还要求当前请求带有效的游客绑定。签名 Cookie 由 Auth 层验证；Repository 只接收其单向绑定 hash，不接收 Cookie 原文。
3. Repository 不再按裸 ID 读取候选。账号候选必须同时匹配 user、student role、账号 namespace、空 guest/tenant；游客候选必须匹配 guest hash、guest role、空 user/namespace/tenant。两者都只允许 proposed、无 accepted_at、指定数据分类及有限且未到期的时间。
4. 对可见候选执行 `SELECT ... FOR UPDATE`，锁保持至事务结束；重新验证结构并从枚举/标识重建摘要，不复制历史自由文本摘要或来源数组。
   后续接入的账号控制先取得 users 行锁，复核账号/角色与持久化开关，再取得候选锁；候选创建时刻必须晚于该账号清除时间点，详见 [管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md)。
5. 持锁后以第二条 SQL 再校验相同归属、状态和数据库时钟有效期，再标记 accepted；没有返回记录就终止，不写 memory。
6. memory 归入当前学生 namespace，并标记 `user_confirmed`。HTTP 必须携带 `confirmed: true`；登录本身不触发自动继承，不修改学生正式 profile 或申请。

未找到、跨归属、已消费、过期或存储范围异常的候选，在生产 SQL 路径统一返回 `400 BAD_REQUEST` 和固定不可确认消息，不返回原所有者或已生成 memory ID。请求缺少学生权限/游客绑定仍为 403。格式不符为 400。客户端重复确认不会返回第一次的结果；这不是请求幂等协议。

## 3. 并发与时间

- 同一候选的两个确认事务会在候选行锁上串行化。第一次提交后，另一次不再满足 proposed 条件；失败事务不留下 memory 或成功审计。
- 同账号的确认与清除/停用还会先通过账号锁串行化；新的接受操作同步擦除候选副本的偏好正文和游客绑定，memory 保留确认后的受控内容。
- 新迁移 `0009_agent_memory_confirmation_unique.sql` 对非空 `source_candidate_id` 建立唯一索引。已 cleared 的 memory 也占用唯一位置，不能以“清除后重试”为由重复生成。
- NULL 来源仍沿用 PostgreSQL 唯一索引的默认语义，允许多条 NULL；当前候选确认始终提供非空来源。[PostgreSQL 唯一索引](https://www.postgresql.org/docs/16/indexes-unique.html)
- 锁后有效期使用 `clock_timestamp()`，不是请求传入时间或事务开始时间。`accepted_at` 也由数据库填写。有效性判定点是持锁后的接受 UPDATE，而不是承诺在 COMMIT 时再次判定。[PostgreSQL 时间函数](https://www.postgresql.org/docs/16/functions-datetime.html)
- 创建候选时以同一个数据库实时时刻填写 created_at，并把 expires_at 上限限制为游客 24 小时、学生 7 天。应用提供的更早期限可以缩短有效期，应用时钟偏快不能延长上限。HTTP 无法选择期限。
- 已确认学生 memory 暂沿用 `expires_at = NULL`；这只是未开放生产的基础合同，不能解释为已经完成长期保留、清理或删除机制。

本地测试验证了等待行锁期间过期的情况。后续 SQL 必须保留“先锁，再复查”的分步结构，不能把它重新合并为依赖旧快照的单条业务查询。[PostgreSQL READ COMMITTED](https://www.postgresql.org/docs/16/transaction-iso.html)

## 4. 审计与故障

成功审计与对应候选/memory 写入共用事务。候选 INSERT、接受 UPDATE、memory INSERT、审计 INSERT 任一失败都会回滚当前操作；不返回成功、不增加 Cookie，也不把 SQL/内部异常返回客户端。

创建候选的 4xx 业务拒绝审计由生产工厂在业务事务回滚后单独写入，仅记录固定 action、code 与服务端上下文，不记录攻击者字段名、summary、structured 内容或原始游客凭据。它不能放回会被回滚的事务。5xx 存储/提交故障不伪装成策略拒绝。拒绝审计存储本身不可用时，仍可能返回 500，不能承诺故障期间拒绝事件绝不丢失。

当前未新增全部确认拒绝事件的审计策略。成功审计只保存受控元数据，不保存记忆正文。更通用的事务语义见 [业务事务审计合同](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md)。

数据库提交确认丢失仍可能造成“客户端收到错误，但业务已经提交”的不确定状态。这里不自动重试、不声称 exactly-once，也不复用其他账号的确认结果；BE-0712 负责请求幂等和提交不明恢复。

## 5. 迁移与验证

迁移只新增索引，不改旧迁移、不删历史数据。历史重复来源会导致迁移失败，必须受控审查，不能自动选择一条学生记忆删除。现有 `source_candidate_id` 外键删除行为仍为 SET NULL；此唯一约束不是清理策略或永久删除墓碑。后续清理设计必须一起审查来源生命周期。

本地证据：

- `agent-context-rehearsal.mjs`：真实 PostgreSQL 覆盖两个来源范围的并发、审计故障、锁后过期、应用时钟偏差、跨范围访问、旧内容重验、memory 写故障、历史重复迁移失败和 owner-scoped pending capacity。
- `http-network-rehearsal.mjs`：实际构建 API 验证候选/继承审计失败的快照回滚、拒绝审计存续、两个网络请求真实等待同一锁、游客身份轮换后不能继承旧候选，以及第 13 个 guest 候选返回脱敏 429。
- 当前总门槛：`npm run test:server` 523/523；`npm run db:pg:rehearse` 379/379；`npm run db:http:rehearse` 477/477；`npm run db:linux:rehearse` 7/7。后两套数据库入口有重叠，不能相加作为独立覆盖量。
- 33 个迁移、24 份快照；ESLint、TypeScript 与 API 生产构建通过。所有数据均为临时库或持久本地库内的 synthetic fixture。

不连接阿里云、不发邮件、不支付、不启用完整 Agent。Drizzle snapshot 与迁移链截至 `0032` 的本地核对已完成；后续每条迁移仍须工件检查和真库演练，见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md) 和 [迁移基线规范](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md)。这不替代记忆生命周期或云上验收。

## 6. 尚未完成

| 后续项 | 必须证明的结果 |
| --- | --- |
| 记忆管理 | 学生控制 API/版本/微秒游标、100 条确认容量和 12/24 待确认容量已本地验证，管理用途不能为 agent_tool；UX、生产滥用控制与调度仍待完成，见 [管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) 和 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md) |
| 到期清理 | 候选/确认记忆清理批次、跳过锁、正文擦除和审计回滚已验证；自动调度、告警、失败恢复与生产积压监控待完成 |
| 保留策略 | 候选最多 24 小时/7 天，已确认 student memory 最多 365 天；用户删除与主库正文擦除已定义，备份/WAL/模型供应商中的删除责任仍待验收，不默认永久保存 |
| 身份生命周期 | 登录自动继承必须关闭；账号/角色切换清理 working context；并发撤权与写入的最终授权边界验证 |
| 游客撤销 | 现有游客 Cookie 无状态，轮换只改变当前浏览器，不能撤销复制到别处的旧 token；两账号持同一有效绑定只能竞争一次，但不能保证竞争者一定是最初自然人 |
| 生产控制 | 浏览器 HTTPS、WAF/Gateway 限流、资源/存储配额、异常监控、云上恢复和隐私运营流程 |

关闭网页不是可靠的服务器删除信号；有效期拒绝访问不等于已经物理删除数据。以上项目完成前，BE-0708 保持部分完成，生产长期记忆保持未启用。

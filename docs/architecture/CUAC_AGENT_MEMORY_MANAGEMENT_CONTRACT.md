# CUAC Agent 记忆管理与候选清理合同

更新：2026-09-01。学生记忆控制 API、版本冲突保护、游标分页、确认容量限制及 365 天有限保留已经完成本地真库/网络/Linux 发布包验收。没有前端控制页面、自动调度或生产长期记忆启用。有限保留细节见 [记忆保留合同](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md)。历史服务阶段证据保留在第 6 节，不作为当前总数。

本合同补充 [记忆确认合同](CUAC_AGENT_MEMORY_CONFIRMATION_CONTRACT.md)。前端唯一参考仍为 `design-lab/home-v3.html`，本轮不读取或修改任何前端页面。Agent 仍是信息整理层，不能自由访问数据库或执行本合同中的维护函数。

## 1. 数据与默认行为

迁移 `0010_agent_memory_controls.sql` 新增：

- `agent_student_memory_settings`：以 user_id 为主键，保存 enabled、reset_at、updated_at；删除账号时级联删除该设置。增量迁移 `0021_student_memory_control_revision.sql` 新增正整数 revision，旧设置从 1 开始，不修改 enabled、reset_at 或旧正文；无设置记录表示 revision 0，读取不自动建行。
- 候选表 `payload_cleared_at`：记录正文已擦除，阻止它再次作为有效候选。
- 待清理候选的部分索引。迁移不自动删除或改写历史偏好正文。

增量迁移 `0031_agent_memory_retention.sql` 为 active student 低敏记忆强制有限 `expires_at`，上限为数据库创建时间后 365 天，并增加到期清理索引。旧 null/无限/超长期限只被收敛到该上限，不改写偏好正文、来源或设置。

没有设置记录时，enabled 默认为 true，含义仅为“允许用户明确确认后保存”。它不是自动记忆同意，不会因注册、登录或对话自动生成长期记忆。`confirmed: true` 的确认规则仍保持。设置为 false 后禁止学生候选持久化和两种确认方法；公开目录检索与临时信息整理不依赖此开关。

目前只管理当前账号的 student persona，不实现学校共享记忆或 Ops 工作记忆。设置表不是新账号角色；维护审计里的 `system` 只是受信后端任务标签，不是浏览器可获取的 RBAC 身份。

## 2. 服务合同

入口：`createPostgresAgentMemoryManagementService`。直接构造模拟 service 不构成事务保证；生产接线必须使用工厂。

| 服务方法 | 行为 | 返回 |
| --- | --- | --- |
| `list(context, {limit, cursor})` | 只读取当前学生 namespace 的未清除、未过期、低敏已确认学习偏好；重新验证结构并生成摘要；停用时不加载正文 | enabled、revision、storedCount、capacity、items、nextCursor |
| `clearOne(context, memoryId)` | 擦除该学生的一条记忆正文与可验证归属的已确认候选副本；保留来源唯一性 | cleared；无权限范围内记录与不存在都为 false |
| `clearAll(context, {expectedRevision})` | 当前版本匹配才清除并推进版本/时间点，不改变 enabled；即使当前没有正文也推进 reset 边界 | enabled、revision、clearedCount、clearedCandidateCount |
| `setEnabled(context, {enabled, expectedRevision})` | 必须匹配当前版本；状态改变时清除旧内容并推进版本/时间点；当前版本的同值请求无变化、无成功变更审计 | enabled、revision |

公开接口采用统一安全入口，身份仅从服务器会话解析，purpose 固定为 student_action。URI 位于 agent 命名空间不代表 Agent 工具有调用权；不能向 Agent runtime 提供浏览器 Cookie、通用 HTTP 代理或这些服务对象。

| HTTP | 请求 | 说明 |
| --- | --- | --- |
| `GET /api/v1/agent/memories` | 可选 `limit`、`cursor` 查询参数 | 返回列表及设置版本；不接受重复参数、offset 或权威字段 |
| `DELETE /api/v1/agent/memories/:memoryId` | 完全空请求体 | 固定 ID 清除，重复返回 cleared false；不能影响后来新增的 ID |
| `POST /api/v1/agent/memories/clear` | `{ expectedRevision }` | 明确清除全部 student 记忆与旧候选；不是通用 DELETE 或 Agent 命令 |
| `PATCH /api/v1/agent/memory-settings` | `{ enabled, expectedRevision }` | 开关变化也擦除旧正文，重新开启不恢复过去内容 |

成功响应为 `200 { data: ... }`；全部响应 no-store、nosniff，统一 request ID 与脱敏错误。写入受同源 Origin/Fetch Metadata、体积、JSON 和读取期限约束；GET 同样拒绝跨站/同站非同源浏览器 Fetch Metadata。没有启用生产入口、完整 Agent 或前端联调。

列表默认 20、最多 100。游标是上一页最后扫描记录的 UUID，数据库按 created_at DESC、id DESC 排序；游标先在本人 student namespace 查找，再用数据库原生微秒时间和 ID 比较，不经 JavaScript Date 截断。已清除的本人墓碑仍可作为游标；外人或不存在的游标统一 400。每页最多扫描 limit+1 条合格范围记录，结构不合格的正文跳过，nextCursor 按扫描位置推进，所以空 items 不表示结束，应以 nextCursor 为准。分页不是跨请求快照，新确认需重新读取第一页；历史异常/过期正文不返回。未知字段包括 userId/role/tenant 均拒绝；结果不含 userId、namespace、游客绑定或来源候选 ID。

确认容量初始技术上限为每个学生 namespace 100 条未清除记录。count 包含已过期、历史格式异常的未清除记录，不能利用过滤隐藏配额；storedCount 可能大于当前可展示数量，全部清除可以释放这些记录占用。旧库超过上限不删除、不强行修复，仍允许分页和清除，只阻止新增确认。单项清除释放名额，两种确认服务在同一用户锁内检查容量，超限 409 且候选接受标记/审计全部回滚。此上限不同于 12/24 active pending-candidate 容量，后者见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)。Gateway/WAF 速率与滥用控制、存储字节上限和墓碑保留政策仍是生产门槛。

所有管理方法先要求有效 actor、student role、student surface、student_action purpose、session/step_up、无学校 tenant 且允许低敏偏好；Agent purpose、学校/Ops、游客及缺失权限在访问仓库前拒绝。工厂随后锁定并复查数据库中的 active 账号与未撤销 student grant。用户传入的 memoryId 必须为 UUID。学生资料、支付、收藏、申请及其他 persona 不在清除范围。

## 3. 并发与防恢复

1. 学生候选创建、两种确认和记忆管理先对同一个 active users 行 FOR UPDATE，再对有效 student grant FOR SHARE，然后读取设置、候选和 memory。锁持续至事务结束；角色撤销先提交则等待后的操作拒绝，操作先取得角色锁则撤销等待其提交/回滚。
2. clearAll/开关变化把 reset_at 写成数据库实时时刻。确认 SQL 要求候选 created_at 晚于该账号 reset_at；使用数据库时间戳直接比较，不经 JavaScript 毫秒截断。
3. 先确认、后清除：确认可以完成，后续清除擦除其 memory；先清除、后确认：旧候选不能写回。
4. 停用优先时确认返回 403；清除优先但仍启用时旧候选返回固定 400。重新开启仅允许后续新候选显式确认。
5. 游客候选清除时间点作用于目标学生账号，不把共享浏览器里的所有游客候选全局删除。其他账号仍执行自己的绑定/策略检查；它们的记忆不受当前账号清除影响。
6. 新确认会在接受标记同一条 SQL 内清空候选 summary、structured、来源数组、游客 hash 和 continuation 关联。memory 从锁定后已验证的数据生成，不依赖清空后的候选重新取正文。

expectedRevision 范围是 0 至 PostgreSQL int 最大值。任一旧版本均返回 409，包括当前 enabled 恰好相同的请求。clearAll 成功后，旧清除请求不能再次擦掉后来确认的新记忆；旧开启请求不能覆盖之后的停用。revision 描述设置/reset 边界，不是记忆集合或资料的内容版本；新增确认与单项清除不推进它。最大版本时只允许读取和同值无变化操作，不允许溢出或重置版本。

成功审计与全部变更同事务，审计失败回滚。COMMIT 确认丢失不自动重试或宣称失败未落库；调用方重新 GET 当前设置并让学生作出新决定，不能自动刷新 expectedRevision 后重发。固定 ID 的单项清除可以重复确认。clearAll 首次接受时清除当前范围，而不是只清除客户端先前某页看见的记录。

已经发送到浏览器或外部客户端的数据无法靠服务器清除撤回。当前角色行锁协议不是全部在途撤权问题的解决方案：会话撤销、生产脚本锁顺序、Agent runtime 凭据隔离、前端 working context 与账号切换清理仍需验收。

## 4. 擦除与保留

记忆清除将 summary 置空、structured 置为空对象、source 改成受控清除标签，并设置 cleared_at；候选正文使用 payload_cleared_at 标记。来源候选 ID、记录 ID、归属、分类与时间元数据保留，以保持唯一去重、账号级联和审计关系。已清除记录不会因再次确认生成第二条同来源记忆。

旧版本可能同时存过 memory 与已接受候选正文。因此单项和全部清除还会擦除关联的已确认候选，但仅限同学生候选，或通过当前账号 memory 唯一来源关联的 guest 候选；不会因为一条错误关联就改写另一学生拥有的候选。历史异常 namespace/分类/来源关系的全量审查与修复不由用户清除接口擅自执行。

这是当前业务记录的正文擦除，不是磁盘安全擦除。PostgreSQL UPDATE 会留下待回收旧版本，旧事务快照、WAL、备份和副本也需要独立保留与删除策略；不能用一次 UPDATE 或 VACUUM 声称备份中已没有数据。[PostgreSQL 旧版本回收说明](https://www.postgresql.org/docs/16/routine-vacuuming.html)

已确认学生 memory 现在统一限制为创建后最多 365 天。期限由 PostgreSQL 时钟生成，调用方不能传入、延长或因聊天/访问自动续期；更早的显式清除继续生效。过期记录立即从列表读取中排除，后台受控批次可擦除正文。365 天不是备份、WAL、审计或申请档案的保留期限；墓碑保留时长、备份删除责任和生产调度仍需完成。生产长期记忆继续保持未启用。

## 5. 候选清理批次

`sweepAgentCandidates(client, batchSize)` 是受信后端维护函数，不是 Agent tool、Ops 写接口或公开 API；本轮没有创建定时任务，也没有在现有业务数据库运行它。

- 默认每批 100，允许 1 至 500。
- 只处理无学校 tenant 的 guest/student 候选：已 accepted/rejected/expired 的残留正文，以及期限已到或期限非法的 proposed 候选。
- 到期 proposed 改为 expired；已终态的状态保持。清空正文、来源数组、游客 hash 与 continuation 关联，保留去重需要的记录 ID。
- `FOR UPDATE SKIP LOCKED` 跳过确认中的候选，允许多个清理批次协同处理。跳过意味着本轮可能没处理完，0 条也不证明所有候选都已清空；调度器必须后续重试与监控积压。[PostgreSQL 锁定查询](https://www.postgresql.org/docs/16/sql-select.html)
- 不清理有效候选，不碰正式学生资料、申请、支付或学校/Ops persona。
- 只在发生擦除时记录 `agent.context_candidates.sweep`，元数据仅包含数量，actor 为空、审计标签为 system。
- 批次擦除与审计同事务；审计失败整批回滚。每批限制更新行数，但不是查询耗时/SLA 保证，索引计划、超时、限额和生产压测仍需验收。

关闭网页不是可靠的服务器删除事件；没有运行调度器时，到期候选会被拒绝继承，但未必已擦除正文。

### 已确认记忆到期批次

`sweepExpiredStudentMemories(client, batchSize)` 同样只供受信后端维护使用，不是公开 API、Agent tool、学校或 Ops 能力。本轮没有创建生产定时任务。

- 每批 1 至 500，使用 `FOR UPDATE SKIP LOCKED`。
- 只处理无 tenant、精确 student namespace、低敏且已到期/期限非法的未清除记忆。
- 擦除 summary 与 structured payload，写入 `retention_expired` 和 cleared_at；安全归属可证明时一并擦除关联旧候选副本。
- 与 `agent.memories.retention_sweep` 元数据审计同事务；审计失败整批回滚。
- 不跨账号、角色、tenant 或数据分类，不处理 Profile、Application、Billing、学校或 Ops 数据。

## 6. 本地证据与后续

当前：523/523 常规后端、477/477 真实 PostgreSQL 与构建 HTTP 联合、7/7 Linux 迁移门槛通过；另一次专用真库入口为 379/379，与 HTTP 入口重叠，不能相加。TypeScript、目标 ESLint、离线快照和迁移不可变性检查通过。33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引与 ORM 影子库一致；最终包摘要 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。`0032` 另把 active pending candidate 限制为每个 guest 浏览器绑定 12 条、每个 student 账号 24 条，见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)。仅本地合成数据，非前端或云端验收。

下列为 2026-08-31 的服务基础历史证据。本轮新增验证以 [统一演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md) 的最新批次为准。

- 新增 6 项记忆管理单元测试与 1 项迁移合同测试；完整后端测试为 308 项。
- 新增 12 个数据库子测试：范围/投影、单项与全部清除、历史候选副本、精确时间边界、停用/重启、账号和角色失效、审计回滚、两种锁顺序、清理并发/回滚和设置级联。
- 新增 1 个真实 HTTP 子测试，证明现有候选/继承 API 读取并执行后台持久化开关与清除时间点，而不是只靠模拟对象。
- 默认 PostgreSQL 演练 95 项；数据库/API 联合演练 115 项，包含 94 个数据库子测试、20 个网络子测试与外层测试，二者不应相加计算覆盖。
- 当前 12 个迁移。只有临时 PostgreSQL 合成数据参与测试；无阿里云、真实支付、邮件或完整 Agent。

部署顺序：先完成 staging 备份/恢复与审批，暂停并排空旧记忆写入服务，确认 0021 已完成后执行 0031，再整体部署会遵守版本、账号/角色锁、容量和有限期限的新管理/确认服务，最后恢复受控入口。0031 只收敛 expiry 元数据，不改正文；不能新旧记忆写入者混跑。回退时关闭相关写入和维护任务并保留新增列/约束，不能回退到可写 null/无限期限或绕过版本/容量的旧服务。

后续顺序：完成用户控制 UX，落实 Gateway/WAF 生产限流、滥用/模型预算控制和受控调度；验证浏览器账号/角色切换与服务器在途撤权；完成日志、RDS 备份、恢复和删除责任。BE-0708 仍是部分完成，不能仅因候选容量、有限保留与控制 API 通过本地测试就启用生产。

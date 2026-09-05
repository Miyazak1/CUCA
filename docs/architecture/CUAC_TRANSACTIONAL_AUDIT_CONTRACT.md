# CUAC 业务与审计事务合同

更新：2026-09-01。状态：BE-0707 当前学生/Auth 和 Agent 三个候选/记忆方法已实现事务并本地验证；完整记忆生命周期、外部副作用与完整产品验收仍未完成。Agent 扩展见 [记忆确认合同](CUAC_AGENT_MEMORY_CONFIRMATION_CONTRACT.md)。

## 1. 保证什么

对本合同登记的服务方法，业务写入和成功审计使用同一个 PostgreSQL 连接、同一个事务。审计插入失败时，已发生的资料修改、账号/会话创建、邀请授权或挑战消费必须一起回滚。只有 COMMIT 成功，HTTP 层才返回成功 DTO 或签发/清除 Cookie。

这不是 Agent 可直连数据库的授权。Agent 仍只能通过受控工具取得经过投影的数据。本轮不改前端；唯一前端参考仍为 `D:\CODE\CUAC\design-lab\home-v3.html`，且 demo 可继续成熟化。

## 2. 已接入范围

| 模块 | 同事务业务与成功审计 |
| --- | --- |
| Student | 更新 profile、保存/更新 saved item、创建 application set、添加/移除/编辑/排序 application choices；独立申请基本资料 PATCH；教育经历及考试记录新增/编辑/移除；逐项目材料选择保存/清空；逐项目授权记录/撤回；材料快照创建 |
| Credentials | 注册（user + identity + student role + 初始 session）、登录签发 session、退出撤销 session |
| Email Verification | 创建 challenge、消费 challenge 并更新邮箱验证状态 |
| Password Reset | 创建 challenge；消费时修改密码、撤销旧 sessions、作废其他 pending reset links |
| School Invite | 创建/替换 pending invite、撤销 invite、接受 invite 并创建学校 membership/账号 role |
| Sign-in Continuation | 创建游客待办、登录后单次消费待办 |
| Agent Context | 创建候选、确认账号候选、继承游客候选；成功审计同事务，创建拒绝审计在回滚后单独保存 |
| Agent Memory Management | 单项清除、全部清除、持久化开关变化；另有审计化列表读取，均通过服务工厂同事务执行 |
| Agent Maintenance | 有界候选清理批次和 system 数量审计同事务；无公开路由或调度接线 |
| Catalog Requirements | 内部 prepare/approve/publish/withdraw 的实际变化与 metadata-only 成功审计同事务；没有公开写路由 |

登记范围为原 Student/Auth 16 个写方法，加上草稿移除/编辑/排序 3 个、申请基本资料 1 个、教育经历 3 个、考试记录 3 个、材料选择保存 1 个、逐项目授权记录/撤回 2 个及材料快照创建 1 个，当前共 30 个；另有 Agent 候选 3 个、记忆管理 3 个写方法和 1 个维护批次，以及 1 个审计化列表读取。记忆管理已有学生本人 API，维护批次仍无公开 API；详见 [管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md)。游客 Cookie bootstrap 不写业务库，不在这组数据库事务中。项目要求与告知版本各有准备、批准、发布和撤回 4 个内部写方法，不计入 Student/Auth 或 HTTP 导出数量；均无管理写 HTTP。读取、preflight 及 no-op 不增加成功写审计。

逐项目材料选择由 PostgresMaterialSelection 自身持有事务，保存仅写字段/记录 ID 及版本。成功审计只含集合 ID、选择版本和数量；choice 移除同时清理附属选择，任一成功审计失败则选择、choice 墓碑、状态事件及集合版本全部回滚。完整快照断言已扩展为 30 张业务表，两个 HTTP 方法不授予 Agent 权限；见 [材料选择合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)。

逐项目授权与材料快照各自在同连接事务中持有账号、角色和精确 choice/目标锁。授权成功审计只记录目标/版本标识，不记录材料或告知正文；撤回与 lifecycle 变化一起回滚。快照创建、命令收据和 metadata-only 成功审计原子提交，审计不含选择 ID、摘要、密文、key ID 或材料值；故障时密文和收据均不存在。完整回滚快照当前覆盖 33 张业务表，见 [逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md) 和 [材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)。

申请基本资料由 createPostgresStudentService 的 updateOwnApplicantProfile 执行同连接事务。权限行锁、本人资料 revision 和审计一起完成；no-op 不发审计，COMMIT 不明时重读并比较，不自动提升版本覆盖。详见 [申请资料合同](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md)。

教育经历的 addOwnEducationRecord、updateOwnEducationRecord、removeOwnEducationRecord 同样由生产工厂包裹事务，账号/角色、教育集合和目标记录锁持有到审计提交。三个操作共享教育集合 revision；移除清空九个教育字段。审计只记录 record ID、版本及字段名，严格内容白名单不包含教育正文，审计发生时间不属于学生自报教育年份。审计失败回滚首次版本头、记录、版本推进或字段擦除；详见 [教育经历合同](CUAC_EDUCATION_HISTORY_CONTRACT.md)。

考试记录的 addOwnAssessmentRecord、updateOwnAssessmentRecord、removeOwnAssessmentRecord 同样使用同连接事务，集合 revision 独立于教育经历/基本资料/申请选择。正文、版本、回读及 metadata-only 审计必须一起提交或回滚；三个故障用例明确断言 PostgreSQL 合成触发器 P0001，另由真实 HTTP 验证无部分结果。JSONB 键顺序不触发虚假 no-op 变更，审计不记录成绩/日期/考试名称。详见 [考试记录合同](CUAC_ASSESSMENT_RECORDS_CONTRACT.md)。

项目要求由 PostgresRequirementGovernance 自身开启同连接事务，持有当前账号/角色及目录/批次锁到审计提交。创建以稳定 versionId 恢复，其余以状态读取和 CAS 恢复；不允许自审或撤回后复活旧版本。审计只存 ID、摘要、revision 和理由枚举，审核凭证及正文不复制到日志。16 项真库场景和实际公开 HTTP 读取覆盖服务结果；没有注册 Ops 写接口，见 [审核发布合同](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md)。

告知版本由 PostgresNoticeGovernance 自身管理同连接事务，依次锁有效账号、当前角色及用途/语言范围。首次准备创建范围行也与版本、审计一起回滚。不同人审核、管理员 step_up、正文/完整审核摘要的发布绑定及 CAS 均强制检查；四个写方法的撤权双向锁覆盖实际成功审计，19 项真库场景和公开只读网络检查提供证据。审计不含正文、审查引用或学生同意，见 [告知发布合同](CUAC_NOTICE_PUBLICATION_CONTRACT.md)。

新增 `auth.register/auth.login/auth.logout` 成功审计。注册和登录的 actor/role 来自已完成的账号验证结果；退出的 actor/role/tenant/resource 来自数据库实际撤销的 session，不取客户端角色或用户 ID。无 Cookie 或已经撤销的 session 不产生虚假的再次撤销成功事件。HTTP 返回仍只有既有字段，不新增 token、hash 或内部身份字段。

## 3. 实现边界

1. `frontend/src/server/db/transactional-method.ts` 将明确登记的 service 方法放进事务。每次调用都从 scoped client 新建 repository 和 `PostgresAuditWriter`。
2. `frontend/src/server/db/postgres-client.ts` 独占借用一个连接执行 BEGIN/业务/审计/COMMIT。repository 的嵌套 `transaction()` 加入原事务，不再获取另一个连接，不独立提交，也不提供 savepoint 语义。
3. scoped SQL 或嵌套回调抛错后，事务标记为 rollback-only。即使上层捕获了内层错误，也不能提交部分结果。
4. 事务结束后 scoped client 不可复用。未等待完成的嵌套工作不能提交；后续 SQL 会被关闭的 scope 拒绝。业务代码不得 fire-and-forget 数据库工作，也不得自行执行事务控制 SQL。
5. 提交失败会向上抛错并丢弃该连接；回滚失败同样丢弃连接。不会把错误转成“已成功”结果。
6. Request/Response handler 不在该事务回调内。它在 service promise 拒绝后生成错误响应，不能因为把异常转成 Response 而意外触发提交。限流位于事务前，不随业务回滚清除尝试计数。

服务工厂为 `createPostgresAuthCredentialsService`、`createPostgresStudentService`、`createPostgresEmailVerificationService`、`createPostgresPasswordResetService`、`createPostgresSchoolStaffInviteService`、`createPostgresSignInContinuationService`、`createPostgresAgentContextService`。生产路由使用这些工厂；直接构造带模拟 repository/audit sink 的 service 仍供合同测试使用，不能据此声称有事务保证。Agent 已有创建拒绝审计在业务回滚后独立保存，不能包进会被回滚的同一事务；存储故障不当作策略拒绝。

同连接要求依据 [node-postgres Transactions](https://node-postgres.com/features/transactions)。隔离级别保持 READ COMMITTED；原先锁后分语句重新读取密码/邀请状态的设计不变，参见 [PostgreSQL 事务隔离](https://www.postgresql.org/docs/16/transaction-iso.html)。原有重置/登录两种锁顺序和锁等待中过期测试仍通过。

## 4. 失败与重试

| 情况 | 当前行为 |
| --- | --- |
| 格式、权限、归属或 challenge 检查拒绝 | 保留既有 400/403/409 等合同，不返回成功；本合同不新增拒绝审计策略 |
| 已确认的审计插入故障 | 整个业务事务回滚，HTTP 返回脱敏 500；不发放或清除 Cookie |
| 故障解除后明确重试 | 本地测试证明可正常提交，业务变更和对应成功审计同时存在；失败尝试没有伪成功审计 |
| COMMIT 连接错误或响应丢失 | 不能仅凭客户端错误断定未提交；不自动重试，不作 exactly-once 承诺 |
| 已成功消费的一次性 token 再次提交 | 按 challenge/continuation/invite 的既有一次性规则拒绝 |

`requestId` 用于关联审计，不是幂等键，也没有唯一去重约束。BE-0712 已为创建申请组和添加选择接入必填 HTTP 幂等键；原业务、收据完成及成功审计共用本事务，重试仅生成独立 replay 审计。真实 PG 并发、合成提交确认丢失和实际 HTTP 断连恢复已验证，详见 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。登录 session、邀请等仍不是通用幂等操作；不得推广为任何错误均可自动重试。

退出时若审计写入失败，会话撤销也回滚，浏览器 Cookie 不被清除。客户端必须显示退出未成功并允许重试，不能假装已退出。此行为仍需同源 HTTPS 浏览器验收。

## 5. 可复跑证据

以下数字为 0011 阶段历史记录；后续草稿、批次与申请资料的当前总计见 [统一演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。新增资料故障测试直接调用生产工厂并经真实 HTTP 验证；共享快照 helper 当前覆盖 33 张业务表，已包含申请人/教育/考试、要求/告知、材料选择、授权、认证快照和加密邮件 outbox，不能漏掉新表而误判回滚成功。

- `npm run test:server`：316/316，包括新增同连接嵌套、吞错后的 rollback-only、scope 关闭、未等待工作及提交错误测试。
- `npm run db:pg:rehearse`：106/106，包含原 31、Student/Auth 审计故障 16、Agent 确认 14、记忆管理 12、申请幂等 10、迁移基线 3、迁移执行 8、应用连接 8、发布包 3 个子测试及外层测试。
- `npm run db:http:rehearse`：129/129，包含 105 个数据库子测试、23 个真实网络子测试及外层测试。
- 当前 12 个迁移；最新 `0011` 增加申请命令收据，之前记忆开关、候选清理标记及索引继续保留。ESLint、TypeScript 与 API 构建通过。

新增 `tests/server/db/audit-atomicity-rehearsal.mjs` 直接调用生产服务工厂；网络演练则调用构建后的实际 API。两者都通过合成 PostgreSQL 触发器拒绝指定 action 的审计 INSERT，逐项比较 18 张业务/审计表的完整快照，不只检查 HTTP 错误码。每个故障操作均须确实到达审计插入失败点，不能因更早的权限或格式错误而误判通过。

网络测试额外验证审计故障响应没有 Set-Cookie、没有 SQL/密码 hash/内部异常泄漏；重试成功后按服务端 request ID 找到且只找到该次成功审计。所有数据都是合成 fixture，触发器、辅助表、HTTP 子进程和临时容器均在演练后清理。不接真实邮件、支付或阿里云。

## 6. 下一阶段

1. BE-0708：原子确认、12/24 owner-scoped pending capacity、学生记忆控制 API（含设置版本、清除、100 条确认容量保护）、365 天有限保留及内部候选/记忆清理均有同事务审计回滚证据，实际 HTTP 也验证管理审计失败与脱敏 429；拒绝候选审计仍在回滚后记录。后续完成控制 UX、Gateway/WAF 滥用控制、生产调度/监控和备份删除，不以本地测试替代完整生命周期验收。
2. BE-0712：两个申请命令已本地验收；继续账号/邀请等专属恢复合同、前端未决操作接线、收据保留/限额及云上故障验收。业务原子性不能替代这些要求。
3. 验证邮箱/重置密码已提供同事务加密 enqueue 工厂；只能写待发任务，不能在事务中发送。消费者先提交发送意图，再在事务外调用提供方；结果不明不自动重发。默认运行仍不配置真实发送。`0042` 已为通用通知增加独立 event/delivery 边界：学校状态、状态事件、学生通知和 metadata-only 审计同事务，通知 Worker 在事务外调用 provider，并对明确拒绝、未知结果和 dead-letter 分流。学校邀请、支付/学校集成等其他副作用仍须各自实现 outbox/幂等消费，禁止直接接现有事务内回调或调用支付/模型。见 [邮件队列合同](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md) 与 [通知投递合同](CUAC_NOTIFICATION_DELIVERY_CONTRACT.md)。
4. Billing provider 未接入，checkout 业务写入不在本轮原子性验收范围，启用前须独立评审；通用学校/Ops 写操作仍暂缓。
5. 并发撤权、challenge 签发竞态、WAF/代理可信边界、数据库最小权限、生产凭据安全、浏览器联调与阿里云恢复演练仍未完成。

本合同证明的是登记范围的本地事务行为，不代表完整网站或生产安全已经验收。

## 账号邮件异步边界

账号验证/重置邮件队列已本地验收（BE-0718）：0023 新增短期加密令牌运输、challenge 归属外键、已提交任务租约、发送前身份复核、确定未受理后的有界退避及结果不明隔离。challenge/入队/成功审计同事务；终态清空密文。19 项业务真库、1 项非空升级及 7 项常规测试覆盖篡改、缺失密钥、回滚、并发、过期及提交确认丢失。默认运行仍 deferred；未启用真实提供方、调度、前端动作页或 Agent 访问。见 [账号邮件队列合同](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md)。

消费者审计使用固定 service/system 身份，不冒充学生、管理员或 guest；只记录任务 ID、消息用途、尝试次数及枚举结果。发送意图审计失败则不调用提供方；受理结果审计失败时数据库仍保留 sending，恢复按 uncertain 处理，不重复制造申请或账号操作。outbox 表已加入全部业务审计失败快照（当前 33 表）。当前 30 个学生/Auth 业务写方法不因内部 Worker 状态转换而虚增；显式 HTTP 导出总数以后端构建检查为准，不能用数量推断某能力已授权。

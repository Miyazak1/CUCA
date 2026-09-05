# CUAC 生产计划安排

状态：从前端 demo 进入完整产品建设的生产执行计划。

最后更新：2026-09-03

## 1. 总判断

现在可以开始后端 Phase 0/1 的实际落地准备，并且已经开始执行。

核心技术决策：

- 生产数据库：PostgreSQL / PGSQL。
- 生产部署：阿里云服务器为主，推荐后端应用部署在 ECS、ACK 或容器化服务，数据库使用阿里云 RDS PostgreSQL。
- 后端形态：先用 TypeScript modular monolith，不急着拆微服务。
- ORM/迁移：当前建议 Drizzle + PostgreSQL migration。
- Agent 定位：Agent 是信息整理、推荐、解释、跳转和总结层，不是数据库管理员，也不是支付系统。
- Agent 安全边界：Agent 不直连数据库，不自由 SQL，不访问原始敏感数据，只能通过 Tool Gateway 调用经过角色、租户、数据类型、投影和审计限制的工具。
- 支付边界：CUAC 不存卡号、CVV、银行账号、支付 token 或原始支付 payload，只保存订单、发票、金额、币种、状态和第三方 hosted checkout 引用。

前端 demo 不是不可变更的最终合同。Hub、申请中心、管理员后台、学校端都可以继续成熟化。后端不能直接按临时页面反推表结构，而要按稳定领域模型、权限边界和数据生命周期设计。

前端产品基准说明：当前唯一可参考的前端 demo 是 `D:\CODE\CUAC\design-lab\home-v3.html`。不查看、不参考其他前端页面或版本；不改动用户正在修改的学生 Hub 和申请中心。后端按稳定领域模型推进，不把 demo 固化为最终页面或表结构。

## 2. 当前阶段

当前状态：非 Agent 核心后端已推进并封存到 `0045_ops_catalog_quality_reviews`。逐项目申请准备/提交、稳定 CUAC ID、学校工作流、私有文件处理、官方递交 worker、hosted payment 对账、绑定当前员工授权的限时 Ops 申请支持会话、五类异步队列 summary、项目要求双人治理、隔离支付事件复核、隔离官方递交 outbox 复核，以及城市/学校/项目/奖学金来源质量的 generation-safe 认领/升级/双人处置均有本地证据。当前持久化本地运行器可自动迁移/seed，并通过真实密码入口提供 student、school_staff、cuac_ops 三类合成账号；学校 tenant 和 CUAC role 均由数据库当前授权推导。真实邮件/商户/学校接收方、学校纠错与通用目录编辑、自动 freshness 调度、受控 route/payload 修复、退款发起/补偿流程、产品前端联调和阿里云生产验收尚未完成；支付继续默认关闭。适配边界见 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)、[Ops 支持访问合同](CUAC_OPS_APPLICATION_SUPPORT_CONTRACT.md)、[Ops 运营监控合同](CUAC_OPS_OPERATIONS_MONITORING_CONTRACT.md)、[Ops 目录要求治理合同](CUAC_OPS_REQUIREMENT_GOVERNANCE_API_CONTRACT.md)、[Ops 账务复核合同](CUAC_OPS_BILLING_REVIEW_CONTRACT.md)、[Ops 路由复核合同](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md)、[Ops 数据质量复核合同](CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md) 和 [支付与对账合同](CUAC_HOSTED_PAYMENT_AND_RECONCILIATION_CONTRACT.md)：内部始终按 `student + program + intake` 独立申请，学校官方表单只做版本化传输映射。

### 给产品负责人的进度摘要

| 层面 | 当前状态 | 下一道验收 |
| --- | --- | --- |
| 架构与数据 | PostgreSQL + Drizzle；72 表、46 条迁移已在本地真库运行；1121 列、416 个约束、278 个索引经全链校验 | 阿里云 RDS 迁移、KMS、备份恢复与故障切换演练 |
| 账号与安全 | 注册/登录/会话、三表面密码登录、角色/学校隔离、审计、输入防护及加密邮件队列已本地验证 | 真实员工 IdP/MFA、生产凭据、真实邮件、HTTPS 浏览器和云端入口验收 |
| 学生业务 | 独立资料、教育/考试记录、项目批次草稿、告知/要求治理、材料选择/授权/加密快照、显式招生路径、exact fee entitlement、preflight 及内部原子接收/分组已有本地证据 | 补真实来源、Ops 身份、考试/课程成绩、真实文案/价格、公开 submit 风险评审及外部递交，再按确认的前端契约联调 |
| Agent | 权限边界、候选确认、12/24 owner-scoped 待确认容量、学生记忆控制及 365 天数据库保留上限已本地验证，包含并发最后名额、版本冲突、游标分页、100 条 confirmed-memory 容量和到期擦除 | 用户控制界面、Gateway/WAF 滥用控制、生产调度/监控、备份删除、在途撤权及真实对话链路；生产长期记忆仍未启用 |
| 学校、Ops、支付 | 学校隔离读写工作流、官方递交 worker、Billing 状态、hosted checkout、签名 webhook、退款/对账、逐项目权益、按 CUAC ID 的限时 Ops 支持、固定五队列摘要、目录要求治理、隔离支付事件双人复核、官方递交路由复核及四类目录来源质量复核已有本地证据 | 学校纠错/通用目录编辑、自动 freshness 调度、受控 route/payload 修复、退款发起/补偿、告警升级、受审核价格、真实身份/MFA/密钥、商户与学校 staging 闭环；真实支付仍暂缓 |
| 运行与发布 | 持久化本地 PostgreSQL、三角色 fixtures/smoke、固定队列监控、迁移工件、Linux 迁移、生产构建 HTTP、故障恢复与受控退出已验证；离线上线门槛已修复提供方/桶名误放行 | 真实服务接线、可信 CI、外部监控告警、ECS/RDS staging、备份恢复、联调和 beta；本地通过不是上线批准 |

结论：地基已能运行和验收，但前端尚未接成完整业务网站，不能用表数或测试通过数换算产品完成百分比。下一产品里程碑是学生端端到端最小闭环；不改动用户正在调整的 Hub/申请中心，先稳定后端契约，页面对接待确认。

已完成或已启动的地基：

- `frontend/src/server` 后端模块骨架。
- PostgreSQL schema 和 migrations。
- request context、错误 envelope、deny-by-default policy。
- HTTP 统一安全入口：当前 75 个显式 HTTP 导出已接入统一边界；浏览器写操作执行 Origin/请求体/期限/JSON 防护，外部签名 webhook 仅使用显式 raw-body 模式以保持 HMAC 字节一致，所有响应统一脱敏和 no-store。这不替代业务字段校验。详见 [HTTP 安全与游客会话合同](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md)。
- 签名游客会话：`POST /api/v1/auth/guest-session`，保留或显式更换浏览器绑定；注册/登录保留有效游客 Cookie，logout 清除账号及游客 Cookie。无状态轮换不立即撤销旧 token 的其他副本，也不删除数据库候选。
- Auth session resolver：从服务端 session cookie 解析用户，并核验当前 role grant；角色撤销后后续会话解析失效。学校 tenant 必须再次核验有效 membership 和学校状态；缺少校验器则不授予 tenant。不信任前端传入的 userId/role/schoolId。
- Auth credentials：学生邮箱密码注册、登录创建 session、logout/session revocation 的后端 contract API 已启动；密码使用版本化 scrypt 带盐哈希，session token 只存 hash，自助注册只授予 student role。`POST /api/v1/auth/sessions` 可请求 student、school_staff 或 cuac_internal；学校登录必须带精确 schoolId 并重锁 active membership/学校，内部登录只接受当前已批准且未过期的匹配员工授权，响应 role/tenant 不能由客户端指定。
- 密码运行与升级边界已本地验收（BE-0710 部分）：注册/登录/重置使用异步 scrypt，共享两个在途操作上限、没有等待队列；新写入固定使用 `scrypt_v2`，旧 canonical v1 只读兼容。登录在同一准入槽内固定执行 v1、v2 两个 profile，未知、停用、无哈希和损坏身份也走相同 profile 序列后统一拒绝。有效旧证明仅在用户锁、session 与成功审计同一事务中升级，重置或并发升级先提交时旧证明不能覆盖新状态。该密码里程碑为 470 项常规、335 项 PG、424 项构建 HTTP；当前全量见本节末。下一步仍需 ECS 容量/延迟/超载验收、泄露口令筛查、MFA 和更广枚举/侧信道评估，见 [密码运行合同](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)。
- Auth 输入合同已本地验证：所有当前 Auth 写入口有字段白名单，邮箱/昵称/密码有类型与长度边界；新密码至少 15 code point、最多 1024 UTF-8 字节，保留原文，旧 8 字符密码仍可精确登录并升级；一次性 proof 严格 UUID + canonical token。详见 [Auth 输入合同](CUAC_AUTH_INPUT_CONTRACT.md)。泄露口令筛查、目标 ECS 成本验收与 MFA 等生产凭据门槛仍待完成。
- 账号验证/重置邮件队列已本地验收（BE-0718）：0023 新增短期加密令牌运输、challenge 归属外键、已提交任务租约、发送前身份复核、确定未受理后的有界退避及结果不明隔离。challenge/入队/成功审计同事务；终态清空密文。19 项业务真库、1 项非空升级及 7 项常规测试覆盖篡改、缺失密钥、回滚、并发、过期及提交确认丢失。默认运行仍 deferred；未启用真实提供方、调度、前端动作页或 Agent 访问。见 [账号邮件队列合同](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md)。
- Email verification：challenge、服务、PostgreSQL repository 和 API contract 已启动；消费时在事务内重查当前邮箱/账号/token/有效期，故障回滚和并发单次消费已通过本地真库测试。challenge token 只存 hash，API 不回传 token；可选待发队列仅保存短期 AES-GCM 密文。邮件 composer 要求显式同源动作页路径，以 fragment 携带一次性 proof，不能把 POST API 当邮件 GET 页面；动作页及真实 provider 暂缓。
- Password reset：正常请求的 HTTP 状态/正文不暴露账号存在性；challenge 中的 reset token 只存 hash，待发队列仅保存短期密文；密码修改、旧 sessions 撤销和其他 pending reset links 作废在同一事务完成。签发 session 使用相同用户行锁并重查当前密码 hash，两种锁顺序的并发测试已通过。签发时重新锁定/核验账号和当前密码身份；响应耗时、实际供应商故障及真实发送仍待验收。
- Auth rate-limit：已新增 Auth 限流 action/key/service 地基、PostgreSQL store、Auth HTTP handler 注入点、runtime limiter factory、429 错误 envelope、PostgreSQL `auth_rate_limit_buckets` migration 和生产 readiness gate；blocked 时会先于账号、邮箱验证、密码重置或 continuation repository 返回 429；当前生产/预发布模板使用 API Gateway/WAF 这类入口层强制限流，Redis adapter 实现前不作为可上线配置。
- School staff invite lifecycle：CUAC Ops/Admin 可创建、撤销学校邀请，HTTP 不返回原始 token，外部邮件投递暂缓。创建时在事务内锁定学校、撤销同 school/email 的旧 pending invite 后插入新邀请；唯一索引阻止重复 pending invite，失败会回滚。学校老师账号只能通过被邀请邮箱 + 一次性 invite token 接受学校成员身份；invite token 只按 hash 查询，服务端忽略请求体里的 userId/schoolId/role，接受后只授予 `school_staff` 账号角色和对应学校 membership，不允许自授 CUAC/Ops 权限。
- Sign-in continuation：短期待办必须绑定非空 guest session；登录后按 token/浏览器/当前角色/期限单次消费，不携带 tenant 权限、不执行申请写入。preview 仅接受学校/项目/奖学金/城市 UUID；当前只登记 student 的 `application.add_choice` 导航，创建和消费均复核固定 route/action/role 组合。这与需要单独确认和隔离的 Agent 长期记忆不同。
- RBAC/tenant policy 初版。
- audit log、redaction、PostgresAuditWriter。
- 学生/Auth 的 30 个写方法及 Agent 的 3 个候选/记忆方法已接入同连接业务与成功审计事务；新增三项是逐项目授权记录、撤回和材料快照创建。Agent 创建拒绝事件在回滚后独立记录。真实数据库故障与 HTTP 并发已验证，见 [事务审计合同](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md) 和 [记忆确认合同](CUAC_AGENT_MEMORY_CONFIRMATION_CONTRACT.md)。这不代表完整生产验收。项目要求、告知和官方递交政策另有受控内部治理方法，不计入上述 30 个，也未开放 Ops 写 HTTP。学生记忆三种控制写操作及列表审计同样使用服务工厂事务，没有向 Agent 工具开放。
- 逐项目材料选择草稿已本地验收：新增本人 GET/PUT 和 0022 单表，只存字段/记录 ID、四个来源版本及独立选择 revision；显式清空保留版本，资料变化/移除需重新核对，移除 choice 同事务清理附属选择。6 项常规、15 项业务真库、1 项非空升级和 6 项网络场景覆盖同校项目隔离、并发单胜、撤权/冻结等待、审计回滚及失败脱敏。该里程碑把 Student/Auth 业务写方法推进到 27 个；不复制材料正文、不记录授权、不授予学校或 Agent 权限，见 [材料选择草稿合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)。
- Catalog 公开读 API。
- 项目批次基础已本地验收：游客可分页读取可选批次；草稿新增 programIntakeId、复合范围外键与目标去重，旧意向不自动回填。非空批次使用 v2 摘要，旧 v1 收据仍可恢复；实际 HTTP 已覆盖两层白名单接线、越权、并发、关闭等待和审计回滚。第 14 条迁移及发布限制见 [批次合同](CUAC_APPLICATION_INTAKE_CONTRACT.md)。不代表已经允许正式投递或按批次收费。
- Student profile、saved items、application sets、choices 的服务和 API 地基；详情和关联选择查询在 SQL 中限制 owner，新增 choices/sets/programs/school applications 的归属与学校复合约束。
- 独立申请基本资料已本地验收：GET/PATCH applicant-profile，姓名/联系邮箱/国籍单独保存，expectedRevision 防止覆盖；不从昵称、登录邮箱或 Agent 记忆自动填充。权限行锁、并发首次创建、版本冲突、审计回滚和真实 HTTP 已验证。新增第 15 条迁移，不改旧资料/选择/收据；详见 [申请资料与同意合同](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md)。这不是完整材料、同意或提交许可。

- 多条教育经历已本地验收：新增/读取/编辑/移除 API、独立集合 revision、最多 20 条有效记录、部分更新合并校验、并发与撤权保护、metadata-only 原子审计。移除清空九个教育字段，保留 ID/版本，迟到请求不能影响重加记录。第 16 条迁移增加两表，不把选校偏好当已获学历；详见 [教育经历合同](CUAC_EDUCATION_HISTORY_CONTRACT.md)。学校、Ops 和 Agent 不获得新访问权限。
- 项目要求内部审核发布流程已本地验收：第 18 条迁移增加准备者和内容绑定的审核证据；受控服务支持准备、不同人员批准、按版本 CAS 发布/撤回及结果恢复，4 类成功审计同事务。公开 GET 只返回精确项目/批次下已批准、在生效期内且审核证据匹配的白名单投影；旧无证据记录不自动补批或公开，不以最高版本/旧文本兜底。人工来源确认和内容哈希不等于真实性证明，固定 `assessmentMode=information_only` 仍不做资格判断。未开放 Ops 写 HTTP、真实规则导入、Agent 工具或正式递交，见 [内部治理合同](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md) 和 [项目要求合同](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md)。
- 私有考试记录已本地验收：第 19 条迁移增加独立版本头和记录两表，提供 GET/POST/PATCH/POST-remove；保留考试名称/版本、原始分项/尺度、报告形式及日历日期，不自动转换、拼分或核验。仅当前学生本人、student_action 和教育记录权限可访问，三类写入与审计原子提交，移除擦除正文并保留版本/固定 ID。没有课程成绩/GPA、官方送分、学校/Agent 披露或提交许可，详见 [考试记录合同](CUAC_ASSESSMENT_RECORDS_CONTRACT.md)。
- 告知版本基础已本地验收：第 20 条迁移增加范围、版本和发布三表；严格按用途和语言读取已审核的有效版本，内部独立审核、admin step_up、完整证据摘要、发布版本竞争和撤回均有测试。公开 GET 本身不收集同意；`0024` 已实现绑定当前告知证据的逐项目技术授权记录。真实正文、生产员工/MFA、适用人群、未成年人、跨境、保留和撤回后处理仍须确认，不提供管理写 HTTP，见 [告知版本合同](CUAC_NOTICE_PUBLICATION_CONTRACT.md) 和 [逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)。
- 逐项目检查已本地验收：一个 choice 一份只读准备报告，在同一数据库快照核对本人归属、批次/窗口、资料版本/数量、要求/告知引用、最新授权/认证快照、choice 持久化 route 对应的精确当前政策，以及 exact fee entitlement 的最小状态；不接受 query/header route 覆盖，不返回姓名、原始成绩、选择正文、摘要、密文、密钥、政策内部证据或 invoice/payment/provider 证据，不合并同校项目。每类权威证据只解除自己的 blocker；只有 current entitlement 移除本项目 Billing blocker，submit blocker 始终保留，固定 `canSubmit=false`。前端接线另行对齐，见 [逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)。
- 申请写入幂等：创建申请组/添加选择必须带 HTTP 幂等键，按账号与操作隔离收据；同事务完成业务、审计和收据，网络响应丢失后可用原键恢复原结果。真实并发、审计回滚和断连测试通过，见 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。前端尚未接线；Auth 等其他命令、收据限额/保留与阿里云故障验收仍待完成。
- 申请粒度已按用户本轮决定锁定：一个项目和批次一份 Program Application，同校不同项目不合并；收费维度独立。`0030` 已实现内部原子接收并按审核政策建立 transport groups：一项目一表时分别成组，多项目一表时只合并传输。公开提交接口仍未开放。详见 [按项目提交后端合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) 和 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)。
- 草稿项目移除已本地验收：只软删除本人未锁定、未提交且未形成学校收件的 choice，擦除备注/草稿 JSON；状态事件与成功审计同事务。重复 DELETE 不产生第二次移除，旧 ID 不影响后来重加的新 choice。新增十二项真库和四项网络测试通过；不是撤回已提交申请，也没有接前端。
- 草稿编辑/排序已本地验收：新增集合 revision，第 13 条迁移兼容已有草稿/提交/归档记录；支持备注/奖学金 PATCH 和完整顺序 PUT，旧版本冲突、同校项目隔离、no-op、原子审计和并发单胜均通过。发布必须先迁移、更新并排空旧写入实例，再启用编辑接线；入学批次绑定、独立基本资料、教育集合版本、私有考试记录及项目要求内部审核发布流程已补齐；真实来源准入、Ops 入口、考试定义/必要课程成绩模型、同意、提交快照和正式递交仍待实现。
- School portal tenant-safe queue/detail projection API 地基；详情及状态事件查询均带 tenant 条件，两所学校的实际 PostgreSQL 隔离测试已通过。
- Agent context lifecycle 地基：原子确认与 SQL 归属已验证；`0032` 将 active pending candidate 限制为每个签名 guest 浏览器绑定 12 条、每个 student 账号 24 条，并用事务 advisory lock 保护并发最后名额。本人记忆查看/单项清除/全部清除/开关 API 已本地验收，管理方法强制 student_action，拒绝 Agent 用途。设置/reset revision 防旧请求覆盖，数据库微秒游标支持历史分页，两种确认共享 100 条未清除记忆上限及账号/角色锁。`0031` 强制创建后最多 365 天且不自动续期；到期读取隐藏，受信批次可在同事务审计下擦除正文和安全归属内的旧候选副本。见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)、[记忆管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) 和 [记忆保留合同](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md)。前端控制界面、Gateway/WAF 滥用控制、生产调度/监控、备份删除、在途会话撤销与云端验收仍待完成。
- 学生输入：资料 PATCH 保留遗漏字段、显式清空可空值；收藏检查 active 目录对象，choice 检查学校/项目/奖学金范围；重复相同项目/批次目标返回 409，未绑定批次沿用同项目去重。见 [学生与候选记忆输入合同](CUAC_STUDENT_AND_AGENT_INPUT_CONTRACT.md)。
- Billing 已形成固定 hosted provider 边界：fee preview、checkout intent、本人 invoice 状态、双向 HMAC、事件 inbox、成功/取消/退款事务、乱序对账 worker 与精确 entitlement/撤权均已本地验证；不存原始支付凭据，默认关闭，见 [支付与对账合同](CUAC_HOSTED_PAYMENT_AND_RECONCILIATION_CONTRACT.md)。
- Production readiness check（BE-0719）：明确为 offline_preflight，runtimeVerified 固定 false。支付 test/live 只有固定 provider、完整 HTTPS/host/分离密钥、受监管 worker 和 staging 签名闭环均满足时才通过配置门禁；未知环境、非法模式/布尔值、开发环境冒充发布门槛均失败。两份模板保持外部服务关闭，见 [上线预检合同](CUAC_PRODUCTION_READINESS_CONTRACT.md)。
- PostgreSQL migration safety：production migration 必须显式批准并确认 runbook，staging/production 不允许误指 localhost。
- 逐项目材料预览已本地验收：新增本人 POST 只读计算入口，明确选择基本资料字段及教育/考试记录 ID，按四个来源版本在同一数据库快照生成白名单内容。未选资料不读取正文，过期版本拒绝，不默认为全选；项目/账号/版本绑定的摘要不是授权。九项常规、十二项真库和五项实际 HTTP 验证通过，不持久化预览、不记录同意、不向学校或 Agent 开放。无新迁移，详见 [材料预览合同](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md)。
- 学校申请目标一致性已本地验收：第 21 条迁移将 school_application 的项目和批次与 choice 精确绑定，包括空值；拒绝同校错项目、错批次和单边清空。正确旧数据仅复制已绑定批次，错配旧库整批回滚；学校队列/详情新增 programIntakeId，已有学校记录引用的项目不能硬删除。十项业务真库、四项独立包升级和三项实际 HTTP 已通过，详见 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。没有新增提交、学校写方法或 Agent 权限。
- 逐项目披露授权已本地验收：`0024` 新增精确绑定本人、choice、学校、项目、批次、材料选择/来源版本和告知发布证据的历史表；本人 GET/POST/DELETE 支持幂等记录、范围变化 supersede 和明确撤回。授权操作本身不创建 `school_applications`、材料快照、费用权益或通知；后续 `0025` 只允许学生以一条仍有效的精确授权显式生成独立材料快照。preflight 只读取最小授权状态，当前证据可解除授权 blocker，但 `canSubmit=false`。同校不同项目始终独立，见 [逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)。

- 逐项目不可变材料快照已本地验收：`0025` 为一条精确授权最多保存一份 AES-256-GCM 认证 payload，AAD/复合外键绑定本人、choice、学校、项目和 intake；数据库不保存第二份明文。本人 GET/POST、原键恢复、不同键并发收敛、密文篡改拒绝和审计失败回滚均通过真实 PG/构建 HTTP。preflight 只返回最小状态，`canSubmit=false`；没有学校/Ops/Agent/Billing reader，见 [材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)。

- 官方递交政策 Slice A-D2 已本地验收：`0026` 至 `0029` 建立政策、route、v2 授权及逐项目费用权益；`0030` 新增原子 submission、Program Application v2、official groups/members 和 inert outbox。v1 保留历史但永不 current，不推断回填。当前没有管理/公开政策 HTTP、公开 submit、Agent tool、worker 或学校适配器，见 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md) 和 [官方递交政策与分组合同](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md)。

- 逐项目授权 v2 已本地验收：学生请求只回显公开 route/version/publication/document 身份，服务端自行取得 target-set/approval 摘要并持 share lock 至授权提交；同校不同项目分别授权。route 或 policy 撤回/替换使旧证据失效。through-0027 升级保留 v1 授权/密文快照但不回填，旧 writer 失败，学生明确复核后才创建 v2 和新快照。学校、Ops、Billing 与 Agent 均无该写路径或原始资料投影。

- 逐项目费用权益 Slice D1 已本地验收：`0029` 为新 application fee line 固定 exact `user + set + choice + school + program + intake + route`、金额/币种/费用代码/pricing 摘要，并由内部 Billing authority 从已结算 invoice/payment/success event 原子授予 entitlement 与审计。同校两个项目各有独立 line/entitlement；route、target、退款、撤回、过期或支付证据变化只影响对应项目 currentness。旧 v1 行不回填，没有 public/Ops/学校/Agent grant route，也没有真实 provider。见 [逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)。

- 原子申请接收 Slice D2 已本地验收：`0030` 在同一事务复核完整 set 与每个项目证据，创建独立 Program Applications、政策驱动 groups/members、每组一条 pending outbox、状态、收据和审计，再冻结 set/choices。同校一项目一表和多项目一表、同键竞争、证据失效、审计回滚及 through-0029 升级均通过；pending 不代表学校已收到。

- PostgreSQL 迁移基线已本地对齐并封存到 `0045`：46 条 SQL、37 份快照与 72 表 ORM 结构一致，历史 SQL/journal 未改写。同事务迁移锁、ledger 前缀/hash 核验、失败回滚、历史非空升级与提交确认丢失测试通过。详见 [迁移基线规范](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md) 和 [Linux 运行合同](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md)。可信 CI/签名、云端运行保护与 RDS/KMS 恢复/failover 仍待验收。
- PostgreSQL migration runbook：已沉淀 [CUAC_POSTGRES_MIGRATION_RUNBOOK.md](CUAC_POSTGRES_MIGRATION_RUNBOOK.md)，覆盖 local、staging RDS rehearsal、production migration、rollback/restore 和禁止事项。
- 阿里云环境变量模板：已新增 `frontend/config/staging.env.example`、`frontend/config/production.env.example` 和 `frontend/config/README.md`，覆盖 readiness/migration gate 需要的关键变量，但不包含真实密钥。
- 当前完整后端 746/746、TypeScript 与生产构建通过；数据质量复核聚焦真库为 3/3，`db:http:rehearse` 为 525/525，真实 PostgreSQL 结构为 72 表/1121 列/416 约束/278 索引。它覆盖当前 46 条迁移、核心业务真库和生产构建 HTTP 回归，但不是完整应用的 Linux/云端、真实商户、外部邮件或学校接收验收，详见 [本地演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。
- 应用受控退出：新增 `start:managed`，停止接单、客户端断开后的业务跟踪、实际共享池关闭、重复信号和统一截止时间均已本地验证；独立 `test:linux:lifecycle` 3/3 通过真实 OS SIGTERM。见 [应用生命周期合同](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md)。未修改原 demo 启动入口，不代表完整应用已在云端部署。
- 新增独立 `npm run db:linux:rehearse`：7/7 通过，验证同一发布包在 Linux 中的非 root/只读运行、包外校验、受限角色迁移/no-op、中断恢复和启动器篡改拒绝；这不是 RDS 或 Agent 沙盒的完整验收。
- 持久本地开发运行时已落地：`npm run dev:local` 只使用本机 Docker endpoint 和回环端口，复用命名卷，自动执行当前封存迁移链并幂等加载纯合成目录、学生、学校申请与 Ops 授权样例；Node API 的 health/catalog、学生 Auth/申请读取、学校 Auth/队列及 Ops Auth/支持会话 smoke 已通过。端口被其他服务占用时只更换 CUAC 应用端口，不终止外部进程。普通前端 `npm run dev` 的 Sites/Cloudflare 预览路径不变，详见 [本地开发运行手册](CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md)。

还没有进入：

- 完整 Agent 执行。
- 自然语言写数据库。
- 真实商户扣款/退款、生产 webhook 与 staging 对账验收。
- 学校端完整写操作。
- 通用 Ops Admin 业务写接口（Auth 学校邀请创建/撤销地基除外）。
- 私有文件流水线的真实 OSS/ClamAV 凭据、staging 与生命周期验收。
- 学校系统集成。
- 生产发布。

## 3. 阶段计划

### Phase 0：架构锁定

目标：把不会轻易变化的技术和安全边界定下来。

要完成：

- 确认 PGSQL 是生产唯一权威数据库。
- 确认阿里云部署基线：应用服务、RDS PostgreSQL、OSS、Redis/Queue、KMS/Secret。
- 确认 Drizzle 是否作为生产 schema/migration 源。
- 确认统一账号模型：学生、学校老师、CUAC 管理员共用 users/auth_sessions/user_roles。
- 确认 tenant model：学校老师必须通过 school_staff_memberships 获得学校租户权限。
- 确认 Agent Data Sandbox 和 Tool Gateway 为强制设计。
- 确认支付隔离：只走 hosted checkout，不碰原始卡信息。

完成标准：

- D1/SQLite demo schema 明确不是生产数据源。
- Agent 不能直连数据库成为硬规则。
- 支付敏感信息不进入数据库、日志、Agent context、prompt。
- 第一批后端模块和表可以落地，不被当前 demo 页面变化推翻。
- 需要对齐前端产品意图时，只参考 `D:\CODE\CUAC\design-lab\home-v3.html`，不从其他旧 demo 页面反推契约。

### Phase 1：后端基础地基

目标：所有业务模块共用的安全地基先稳定。

要完成：

- PostgreSQL migration 能在本地或 staging RDS 执行。
- 建立基础表：
  - users
  - auth_identities
  - auth_sessions
  - user_roles
  - school_staff_memberships
  - cuac_staff_access_grants
  - audit_logs
  - cities
  - schools
  - programs
  - scholarships
  - catalog_source_evidence
- 完成 `GET /api/v1/health`。
- 完成 `GET /api/v1/me`。
- 完成公开 catalog read API。
- 完成 policy、audit、redaction test gates。
- 建立阿里云 dev/staging/prod 环境变量规范。
- 建立 `npm run infra:production-check`，让生产环境配置从文档要求变成可运行 gate。
- 建立 Auth 限流生产 gate：staging/production 当前必须使用 API Gateway/WAF 等共享入口层限流，不能只依赖单进程内存；Redis adapter 实现前不作为可上线配置。

完成标准：

- server tests、lint、typecheck、build 通过。
- catalog API 不泄露学生、支付、学校租户、Ops 私有字段。
- session token 不明文入库。
- Auth 注册、登录、邮箱验证、密码重置、sign-in continuation 等入口有明确限流 action 和生产强制配置。
- Auth email verification/password reset 有内部邮件消息 composer、HTTPS public app URL 校验和生产 delivery 配置 gate；外部 provider adapter 必须在供应商明确后单独批准。
- School staff invite 创建/撤销仅允许 CUAC Ops/Admin；接受只能由服务端 session 解析出的被邀请账号完成；客户端提交的 userId/schoolId/role 不产生权限。
- client 传入 userId/role/schoolId 不产生权限。
- audit log 不记录 secrets、payment credentials、raw profile payload。

### Phase 2：学生核心

目标：学生从浏览到准备申请的核心流程真实后端化。

要完成：

- 学生注册、登录、退出、session 管理。
- 已启动学生注册/登录/logout：
  - `POST /api/v1/auth/guest-session`
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/sessions`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/email-verification`
  - `POST /api/v1/auth/email-verification/:challengeId/verify`
  - `POST /api/v1/auth/password-reset`
  - `POST /api/v1/auth/password-reset/:challengeId/reset`
  - `POST /api/v1/auth/sign-in-continuations`
  - `POST /api/v1/auth/sign-in-continuations/:continuationId/consume`
  - 暂不开放学校/Ops 自助注册或自授角色；学校老师只能通过 invite acceptance 获得学校成员身份。
- student_profiles。
- saved_items。
- application_sets。
- application_choices。
- guest-to-login continuation 已启动：使用 id + one-time token 消费，token 只以 hash 入库，只允许内部 target route。
- Agent guest context candidates 登录后由学生确认继承。
- Hub 和 Application Center 与真实 API 对接，但要等你当前前端结构更稳定后再对齐。

完成标准：

- 学生只能读写自己的 profile、saved items、application sets、choices。
- guest context 不持久化完整对话，只允许短期、低敏、结构化 candidates；通过服务端期限与清理机制验收，不依赖关窗或 Cookie 消失。
- 登录后继承上下文必须用户确认。
- Agent 不能把 guest 信息自动写入正式 profile。

### Phase 3：申请提交与支付

本阶段按项目生成独立 Program Application（当前表名 `school_applications`），不按学校合并记录。`0029` 已实现逐项目费用权益，`0030` 已实现内部原子接收和正式 transport 分组地基；Billing 预览仍是未获生产批准的基础公式，申请粒度不能自动决定收费粒度。下一步按 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)、[提交后端合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) 和 [官方递交政策与分组合同](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md) 补真实来源与 Ops 身份、考试/课程成绩、真实文案/价格和法律审查、公开 submit 风险评审、真实支付及 worker/provider。当前 accepted submission、group 或 pending outbox 都不得被解释为高校已收件。

目标：把申请选择变成可支付、可提交、可路由到学校的业务流程。

要完成：

- fee preview。
- invoice/payment business state。
- hosted checkout intent。
- provider adapter 选择和配置。
- webhook signature verification。
- payment status event。
- application submission。
- paid/not-required entitlement。
- school_applications 创建。

完成标准：

- 金额、折扣、paid status 全部由服务端计算。
- 重复点击 submit 不会重复创建学校申请。
- 支付 provider webhook 必须验签。
- CUAC 只存 provider reference 和业务状态，不存卡号/CVV/银行账号/payment token。
- Billing 和 submission 都有审计。

### Phase 4：学校端

目标：学校老师能安全处理自己学校的申请。

要完成：

- school queue。
- applicant detail projection。
- status update。
- owner assignment。
- contact log。
- export job。
- school dashboard summary。
- school staff invite/role management；创建、撤销、接受地基及数据库并发保护已实现；邀请列表、重发、真实邮件投递和学校端完整成员管理仍在后续阶段。

完成标准：

- 学校老师只能看到自己学校 tenant 的申请。
- applicant projection 不能暴露学生申请的其他学校选择。
- export 必须短期、租户隔离、可审计。
- 学校 Agent 只能基于 projection 和脚本汇总，不能读原始学生数据。

### Phase 5：Agent MVP

目标：让 Agent 有用，但不让它变成越权通道。

要完成：

- Tool Gateway。
- Agent tool registry。
- role/tenant/data-class/projection enforcement。
- Retrieval Gateway。
- Agent persona sessions。
- agent_tool_invocations。
- agent_action_previews。
- Agent audit。
- Prompt injection tests。

学生 Agent 能做：

- catalog 搜索、解释、比较。
- 根据学生已授权资料筛选学校、项目、奖学金。
- 帮学生整理申请清单和下一步。
- 提供确认后的跳转或低风险动作。

学校 Agent 能做：

- 汇总本校申请队列。
- 基于 projection 整理学生申请材料状态。
- 帮老师生成内部摘要。

Ops/Admin Agent 能做：

- 汇总数据质量、申请漏斗、支付状态、学校队列。
- 基于 governed metrics 做解释。

Agent 不能做：

- SQL。
- 任意表查询。
- 任意导出。
- raw payment 访问。
- raw student document 访问。
- 跨学生、跨学校 tenant 访问。
- 自主提交申请、改支付状态、改学校录取状态。

完成标准：

- Agent 没有数据库账号。
- 所有工具必须注册。
- 所有工具调用都经过 policy。
- 所有敏感工具调用都写 audit。
- 高风险动作必须 preview + user confirmation + domain service + audit。

### Phase 6：Ops Admin 与运营后台

目标：CUAC 内部能安全运营平台，而不是拥有无限制数据库入口。

当前状态（2026-09-03）：员工 access grant、限时 support access session、固定五队列 governed metric registry、只读 dashboard API、按 program/intake 的要求治理、隔离支付事件复核、隔离官方递交 outbox 复核，以及城市/学校/项目/奖学金 data-quality queue 的 generation-safe 认领、升级和双人处置已完成本地验收。目录特权命令、账务关闭、路由关闭/重试和数据质量处置必须 `cuac_admin + step_up`，所有动作重验 live grant 并写 metadata-only 审计；Agent 未注册这些能力。学校纠错/通用目录编辑、自动 freshness 调度、route/payload 受控修复、退款发起/受控补偿、外部告警升级与完整管理前端仍未完成，因此 Phase 6 尚未整体关闭。详见 [Ops 运营监控合同](CUAC_OPS_OPERATIONS_MONITORING_CONTRACT.md)、[Ops 目录要求治理合同](CUAC_OPS_REQUIREMENT_GOVERNANCE_API_CONTRACT.md)、[Ops 账务复核合同](CUAC_OPS_BILLING_REVIEW_CONTRACT.md)、[Ops 路由复核合同](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md) 与 [Ops 数据质量复核合同](CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md)。

要完成：

- ops access grants。
- support access session。
- catalog review tasks（要求治理已完成；其他目录对象待按需要扩展）。
- data quality queue（城市、学校、项目、奖学金的来源/核验问题读取、认领、升级和双人处置已完成；学校纠错、通用目录编辑与自动调度仍待实现）。
- routing queue（隔离 outbox 的只读队列、认领、升级、无重试关闭及严格受限的一次重试已完成；route/payload 修复和真实接收方 case 接线仍禁止）。
- billing review queue（隔离事件只读队列、认领、升级与无变更关闭已完成；退款发起、人工改账和补偿/重放仍禁止）。
- governed metric registry。
- dashboard APIs。

完成标准：

- Ops 跨租户查看必须有角色、目的、审计。
- 管理后台 API 不按当前 demo 页面硬绑定。
- 指标必须来自代码或 registry，不能让 Agent 临时编 SQL。
- 支持人员查看用户数据必须有 reason。

### Phase 7：通知与自动化

目标：让学生、学校、运营在关键节点收到可靠通知。

当前状态（2026-09-02）：站内通知核心已完成本地验收。`0042`、账号/角色/学校范围、列表/已读/偏好 API、学校状态、CUAC 接受提交、支付成功/取消/退款原子发布、worker 的租约/有限重试/dead-letter/结果不明隔离，以及固定阿里云 Direct Mail SMTP 适配器和受控启动入口均已落地。真实邮件凭据与 staging 投递/退信/投诉、调度监督和 SMS 适配器仍未完成，因此 Phase 7 尚未整体关闭。

要完成：

- notification_preferences。
- notification_templates。
- notification_events。
- notification_deliveries。
- email/SMS/in-app provider facade。
- retry/dead-letter。

完成标准：

- 通知模板不泄露敏感字段。
- 发送任务幂等。
- 用户可管理合理范围内的通知偏好。
- 失败投递可追踪、可重试。

### Phase 8：阿里云基础设施

目标：让系统能在生产环境稳定运行。

要完成：

- 阿里云 dev/staging/prod 环境。
- staging/production 环境变量模板和 secret manager 填写清单。
- RDS PostgreSQL。
- 备份和恢复策略。
- ECS/容器部署。
- 环境变量和 KMS/secret 管理。
- CI/CD。
- migration release procedure。
- migration safety gate：生产迁移必须设置 `CUAC_ALLOW_PRODUCTION_MIGRATION=true` 和 `CUAC_MIGRATION_RUNBOOK_ACK=true`。
- PostgreSQL migration runbook。
- request logs、error monitoring、audit retention。
- rate limiting。
- rollback runbook。

完成标准：

- staging 架构接近 production。
- staging/production env 模板覆盖 PGSQL、SSL、Agent sandbox、Billing、payment、KMS、OSS 和 migration safety gate。
- migration 可以安全执行和回滚。
- staging/production migration 目标环境必须明确为 `CUAC_MIGRATION_TARGET_ENV=staging` 或 `production`。
- staging/production migration 不允许连接 localhost/127.0.0.1。
- 完成至少一次 restore drill。
- secrets 不在 repo、前端 bundle、日志、数据库行、Agent prompt 中出现。
- `CUAC_REQUIRE_PRODUCTION_READY=true npm run infra:production-check` 在明确的 production 目标下通过；它只是离线必要条件，另需真实服务、云端运行和发布审批证据，不能使用 advisory 退出 0 替代。

### Phase 9：Beta

目标：小范围真实用户验证。

范围：

- 选择一批学生。
- 选择少量学校 partner。
- catalog 数据真实但范围受控。
- 支付可以先 test mode 或 limited live。
- Agent 只开放 catalog、导航、低风险总结。
- Ops 人工监控所有关键流程。

完成标准：

- 没有高危 auth、tenant、payment、Agent sandbox 问题。
- 学生从发现学校到提交申请能跑通。
- 学校能处理 tenant-safe 申请。
- audit log 对真实 support 有用。
- 核心漏斗数据可看。

### Phase 10：正式发布

目标：公开 MVP。

发布条件：

- 生产 RDS PostgreSQL ready。
- 后端部署在阿里云生产环境。
- 前端接真实 API。
- Auth live。
- 支付 live。
- 通知 live。
- 学校 tenant onboarding ready。
- Ops Admin 核心读和支持流程 ready。
- Agent MVP feature flag 控制。
- monitoring、backup、rollback、incident runbook ready。

MVP 完成定义：

- catalog 数据来自 PostgreSQL。
- 学生可以注册、收藏、准备、支付、提交。
- 学校老师只能处理自己学校申请。
- CUAC Ops 可以看运营、路由、数据质量、支付状态和支持队列。
- Agent 在严格沙盒内辅助学生、学校、Ops。
- 安全测试全部通过。
- 阿里云生产环境有备份、监控、密钥管理和回滚机制。

## 4. 近期执行顺序

接下来最实际的顺序：

1. 不碰你正在改的学生 Hub 和申请中心前端。
2. 完成后端文档、schema、policy、audit、Billing runtime 的同步。
3. schema 变更先受控生成/审查，再做离线检查和真库演练。BE-0713 已完成本地基线、执行保护、独立发布包与非 root/只读 Linux 运行，新增 `db:linux:rehearse`。下一步接可信 CI/签名、补丁审查、云端启动/秘密控制、领域回填与阿里云 staging，详见 [Linux 运行合同](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md)。BE-0714 本地连接/网络恢复、受控排空和退出期限已通过；完整云端运行、监控和 RDS 切换仍待验收。
4. 按 `frontend/config/staging.env.example` 准备 staging secret/env。
5. 设置 `CUAC_MIGRATION_TARGET_ENV=development` 或 `staging`，跑 `npm run db:pg:check`。
6. 在 staging 用匹配的 schema/SQL/快照/清单及固定工具依赖运行单个 `npm run db:pg:migrate` 作业；本地已验证当前 33 个 migrations 及重复执行。新约束遇到历史重复邀请、错配归属或非法记忆创建时间时必须停下审查，不自动撤销邀请、修改学生/tenant ID、伪造审批、生成授权/材料快照或猜测修复记忆正文。
7. 跑 catalog seed dry-run 和 staging import rehearsal；本地 synthetic sample 重复导入与公开查询已通过。
8. 当前 Auth/学生字段、Student/Auth/Agent 事务、12/24 owner-scoped 待确认候选容量、记忆管理 API/分页、100 条 confirmed-memory 容量及 365 天有限保留已通过真库回归；下一批完成用户控制 UX、Gateway/WAF 滥用控制、生产清理调度/监控、备份删除和在途撤权，继续请求幂等、生产凭据、HTTPS 浏览器和阿里云联调。账号邮件 outbox 已实现，但实际提供方、密钥管理、动作页及受控 worker 接线仍待批准与验收。
9. 等 Hub/Application Center 前端结构稳定后，对接偏好 profile、独立 applicant-profile、saved items、application sets、choices API；不把两个资料来源或版本混为一谈。
10. 草稿增删改序、批次身份、独立基本资料、教育/考试记录、告知/要求治理、单项目准备检查、材料预览/选择、逐项目 policy-bound 授权、不可变快照、版本化官方递交政策及 exact Billing entitlement 地基已本地验收。继续补真实来源准入与 Ops 身份/入口、受控考试定义/尺度及必要课程成绩、真实告知/适用人群/价格与法律审查，确认首发招生路径数据，再做正式分组，最后实现跨集合规则与幂等原子提交。原始自报记录不等于已核验材料，授权/快照/政策发布/entitlement 都不等于高校已接收。不要直接开放旧 submit 草案，见 [政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)、[逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)、[官方递交政策与分组合同](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md)、[材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)、[逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md) 和 [提交后端合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md)。
11. Billing provider/webhook/refund/reconciliation 与幂等地基已完成；保持真实支付关闭，下一步取得受审核商户、价格、密钥并做 test-mode staging 闭环。
12. 私有文件、学校 portal write 与官方递交 worker 已完成本地地基；接真实 OSS/ClamAV/学校接收方做 staging 验收。
13. 学生公开 submit 的本地风险评审、step-up 路由和端到端恢复证据已完成；下一步接真实数据、前端和 staging，不把本地 accepted 当学校签收。
14. 做 Agent Tool Gateway MVP。
15. 做 Ops Admin governed API。
16. 通知站内闭环与邮件适配器已完成；继续真实凭据、调度、退信/投诉和 staging 验收。
17. 做阿里云 staging rehearsal。
18. 做 beta。
19. 正式发布。

### 4.1 下一产品里程碑：学生端业务闭环

不是继续用表数代表产品进展。按以下依赖推进，步骤 A 可以先于真实递交规则对齐；没有确认接收方不能进入实际披露。

| 顺序 | 交付 | 当前状态与进入条件 | 验收 |
| --- | --- | --- | --- |
| A | 本人资料、收藏、申请组及逐项目 choice 的前端接线 | 后端已本地验证；等待前端契约确认，本任务不修改用户正在调整的页面 | 登录后只读写本人；各资料/集合/材料选择使用各自版本；409 保留未保存输入供核对，不自动覆盖；两个同校项目独立显示 |
| B | 首批真实项目、批次、要求与接收规则 | 合作名单、接收渠道、志愿数量/顺序/互斥、收费单位、材料保留期限及适用人群尚未确认；不能采用 demo 或测试告知补空 | 有可追溯且审核后的规则版本，学校/项目接收范围明确；申请单位与计费单位分开 |
| C | 每个项目的明确同意及提交快照 | 技术授权、AES-GCM 快照和正式递交政策已本地实现；B、真实告知/法律审查与 KMS 仍是生产启用条件 | 同意绑定目的、接收方、告知、字段、材料选择 revision 及四个来源版本；快照绑定精确项目/intake/授权且不存第二份明文；范围或内容变化需重新确认；没有其他学校、Agent 或原始支付数据 |
| D | 正式递交、收据、学校可见与通知 | 内部原子接收/group/outbox、学校投影和站内通知核心已通过；仍需真实来源/价格、商户与学校 provider、调度及 staging 验收 | 数据库接收保持业务/快照/同意/权益/收据/审计/outbox 原子一致；外部递交另有租约 fencing、结果不明隔离和逐项目结果；同校不同项目状态独立；学校权限不足不可见 |
| E | HTTPS 浏览器与阿里云 staging 闭环 | A-D 及生产凭据/服务门槛通过 | 用受控样本完成发现、登录、准备、确认、支付、递交和学校处理；跨账号/跨学校隔离、恢复/对账、监控与回滚均有证据，再进入 beta |

前端只以 `design-lab/home-v3.html` 为已批准参考，展示步骤不直接作为数据库状态。本轮已核对实际 student API 和版本合同，但没有取得可核验的前端契约回复，不能把消息已发送当作对齐完成。正式递交仍固定阻塞，不通过 UI 按钮或环境变量放开。

## 5. 当前必须暂缓

这些现在不应该做：

- 完整 Agent 执行。
- Agent 自由访问数据库。
- Agent 自然语言写库。
- 真实商户扣款与退款执行。
- 支付 provider webhook 生产启用。
- 未经 OSS/ClamAV staging 验收的文件上传启用。
- 未经真实学校身份与接收规则验收的学校 portal/递交启用。
- 通用 Ops Admin 业务写接口（Auth 学校邀请创建/撤销地基除外）。
- 学校系统集成。
- 私有学生数据向量库。

原因不是不能做，而是这些都依赖前面的身份、权限、审计、数据生命周期和生产环境安全边界。

## 6. Agent 上下文原则

未注册学生：

- 可以用 Agent。
- 只能用公开 catalog、页面状态、低敏偏好。
- 关闭网页后不保存完整对话。
- 只保留短期、结构化、低敏 context candidate。

上述为产品规则，不是浏览器关窗即可保证的行为。会话 Cookie 可能随浏览器恢复，当前签名有效期为 24 小时；guest/student candidate 分别最多 24 小时/7 天，已确认 student memory 最多 365 天并由服务端结构和数据库约束共同强制。生产调度尚未启用，因此“到期不可读”和“正文已从所有副本擦除”仍是两个阶段。不得只凭客户端声明 dataClass 为低敏就持久化任意聊天内容。

注册/登录后：

- 可以选择把 guest candidate 继承为正式 memory。
- 必须用户确认。
- 继承后进入 `user:{user_id}:student` namespace。
- 不能把支付、证件、文件、学校 tenant、Ops 审计等敏感数据放入 memory。

学校老师：

- Agent namespace 独立，例如 `school:{school_id}:staff`。
- 只能汇总本校 projection。
- 不能看学生申请其他学校的信息。

CUAC 管理员：

- Agent namespace 独立，例如 `ops:{user_id}:audit`。
- 只能调用 governed metrics 和受控 support projection。
- 不能自由 SQL。

## 7. 当前验证结果

本轮（2026-09-02，`0039` stable CUAC application reference）：

- 一个 Application Set 由 PostgreSQL 原子分配 `CUAC-YYYY-NNNNNN`，不从用户或数据库主键派生；学生、原子提交、invoice 和学校租户投影共享同一稳定编号。
- 学校端仅支持已验证 tenant 内精确编号查询；编号不是授权秘密。v2 学校记录必须与 Application Set 编号匹配，legacy v1 可为空。
- 两次 `npm run db:pg:rehearse` 均为 399/399；第二次封存 `0039`。当前 schema 为 40 条迁移、31 份快照、64 表、970 列、350 个约束和 242 个索引。
- `npm run db:http:rehearse`：498/498；当前生产构建 API 与一次性 PostgreSQL 联合通过。
- SQL/快照摘要分别为 `8b166104adf7674881e2374498938751402ffd55468c782704d2f1617a516eee` / `ff6c0920b50851b23501de4764b58fca44b527aaac050aa3d32e6398f9b3edbf`；detached release 为 `8e39e51c3aae5e8456f14e68a0e98e8631fa722ddbd0c699029aca4b6d92922a`。
- 未编辑产品前端；前端接线、Ops 查询、真实支付/学校回执和阿里云 staging 仍待完成。详见 [CUAC 申请编号合同](CUAC_APPLICATION_REFERENCE_CONTRACT.md)。

本轮（2026-09-02，`0038` auth session step-up + public atomic submit）：

- `npm run test:backend`、`npm exec tsc -b --pretty false` 与 `npm run build`：通过；step-up 与公开 submit 路由进入生产构建。
- `npm run db:pg:rehearse`：398/398；数据库时钟、过期降级、持久权限约束和审计失败回滚均在 PostgreSQL 16.13 验证。
- `npm run db:http:rehearse`：497/497；真实构建 HTTP 验证普通会话拒绝、密码 step-up、伪造身份拒绝、原子提交及同 key 重放。
- `npm run db:pg:schema:check`：passed，39 条迁移、30 份快照、63 张表；真库另验证 961 列、341 个约束、236 个索引一致。
- `0038` SQL/快照 SHA-256 分别为 `eebf9055a1d480fce4d130ad82aa23b069afb5d9d141a4fa12e1c563fb67efd8` / `585504fc2c2f592286c477c124b1835f793918a8d11f3a187790372e39128214`；最终迁移包摘要为 `d834652cb7d4df5f459131a2143ed37ea74c802f847140cc80da1636937dc8cf`。临时 PG 和 HTTP 服务已清理。

持久本地开发运行时（2026-09-01）：

- 命名卷 `cuac-pg-local-data-v1` 在最新升级前已有 32 条迁移；本轮为 32 before / 1 now / 33 total，保留原合成数据。
- Docker 端口冲突恢复后只发布实际可用的 IPv4 loopback binding；生成凭据只保存在被忽略的 `.cuac-local/runtime.json`，数据库密码不进入 Docker argv。
- 纯合成 fixture 为 2 城市、2 学校、3 项目、1 奖学金；学生申请集含 3 个独立 choice，其中同校两个不同项目保持独立。
- `npm run local:smoke` 通过 PostgreSQL health、public catalog、student Auth/application-set/通知/安全偏好、school staff 队列及 Ops 支持会话打开/查询/关闭；不是 V3 页面接线、真实数据或云端验收。2026-09-02 当前实跑地址为 `http://127.0.0.1:53855`，端口可在下次启动时自动变化，以命令输出为准。

独立 Linux 证据：

- `npm run test:linux:lifecycle`：既有 3/3 独立应用生命周期证据仍保留；使用合成资源，不代表完整应用 + RDS 的 Linux 联合验收。
- `npm run db:linux:rehearse`：最近一次独立 Linux 证据为 through-0032 的 7/7，Linux 镜像 `sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`；本轮没有把它冒充 through-0037 的 Linux 复验。这验证迁移运行时，不是完整应用 + RDS/KMS 云端验收。

部署辅助门槛：

- `infra:production-check`：staging/production 默认硬门槛；开发环境不能满足 required；非法布尔值/未知环境失败；advisory 不是上线批准。真实邮件/支付/上传仍关闭，见 [预检合同](CUAC_PRODUCTION_READINESS_CONTRACT.md)。
- `db:pg:check`、迁移 runbook 及环境模板继续覆盖目标、批准开关和安全默认值；持久本地开发库现已配置，但本地运行与演练都不代表已连接或批准阿里云 RDS。
- 密码本轮已完成固定版本化工作因子和旧 v1 登录事务内升级；旧参数仅作只读兼容。泄露口令筛查、MFA、目标 ECS 容量/延迟/超载和更广侧信道评估仍需完成。旧二进制不能读取 v2，发布必须停止写入、排空全部旧 Auth 实例后整批切换，禁止新旧实例混跑，见 [密码运行合同](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)。

已知限制：

- 已连接本地真实 PostgreSQL 演练 migration；尚未连接阿里云 staging/production RDS，未完成云上备份恢复或正式上线验收。
- 尚未连接真实邮件 provider；email verification/password reset 已有 token-hash challenge、内部 composer、事务加密 outbox 和离线 gate，通用通知已有独立 event/delivery 队列与一次性 provider facade，但没有真实外部 adapter、实际动作页或调度监督。外部 adapter 会把邮箱和一次性 token 或通知内容交给第三方/网关，必须在供应商和数据处理边界明确后再启用。
- 尚未连接真实支付 provider。
- 当前 Auth、学生和受限 Agent 输入及成功审计事务已本地验证。BE-0718 已实现验证/重置邮件 outbox；私有文件、学校工作流、官方递交和支付外部副作用已有可靠投递/恢复地基，但真实提供方与 staging 仍未验收。候选/记忆清理仍为内部服务，控制 UX、生产调度/监控、备份删除和在途撤权未完成。迁移执行保护、独立包、应用连接恢复与受控退出已有本地证据；可信发布、through-0037 Linux 复验及云端生命周期/RDS 切换仍待完成。
- 生产凭据、HTTPS 浏览器和阿里云验收仍待执行。WAF/Gateway 必须实测覆盖全部 Auth 路由（包括 guest-session），readiness 配置检查不证明云端限流已生效。
- full `npm run lint` 仍有前端 demo/QA 旧 lint 问题，不属于当前后端地基新增问题。

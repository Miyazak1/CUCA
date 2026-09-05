# CUAC PostgreSQL 本地演练记录

最新复验：2026-09-05。

## 0. 最新权威证据（through `0047`）

- 当前迁移链为 48 条迁移、39 份快照，最后一条为 `0047_school_catalog_correction_url_check`。
- `npm run db:pg:rehearse`：真实 PostgreSQL 16.13 上 417/417 通过。
- `npm run db:http:rehearse`：当前生产构建、一次性 loopback HTTP 服务与真实 PostgreSQL 联合 527/527 通过。
- `npm run db:linux:rehearse`：当前 `0047` 发布包在锁定的 Node v22.22.3/Linux amd64 运行时 7/7 通过；测试镜像为 `sha256:f584efaa08ee6d2bb5d35e06197d5d90fafe09748743271cdfee791502b042d7`。
- `npm run test:linux:lifecycle`：非 root、离线 Linux 进程的真实 SIGTERM 正常排空与期限失败路径 3/3 通过。
- 当前 schema parity 为 73 张 public 表、1145 列、424 个约束和 283 个索引。
- detached migration release SHA-256 为 `d4651eb89a5d6295f3aebaf059940614c671db5b4613bcdff408172af19a74c6`，含 15 个锁定运行依赖。
- HTTP 联合演练显式使用受控 Agent 测试配置验证其既有安全边界；正常本地启动 BAT、staging candidate 和当前核心发布配置仍明确关闭 Agent，并禁止 Agent 直连数据库。
- PostgreSQL/HTTP 演练均确认一次性数据库已删除；HTTP 联合演练还确认其自有服务已停止，Linux 演练确认其自有测试镜像、容器和网络已删除。未使用或修改用户的持久本地运行时。

这组结果证明当前代码在本机的真实 PostgreSQL、生产构建 API、权限隔离、并发/回滚及受控退出门槛通过。它不证明阿里云 staging 已通过：RDS verified TLS/ACL、备份恢复、HTTPS/WAF、MFA、真实邮件、OSS/ClamAV、商户支付、学校接收网关、worker 监督、告警、密钥轮换、核心三角色浏览器闭环和回滚仍须在绑定同一 commit/image/migration identity 的云端候选上形成 16 项独立证据，再进入人工发布审核。

以下内容保留各历史里程碑的详细记录；出现旧计数或旧边界时，以本节为当前状态。

历史记录日期：2026-09-02。

结论：后端已从 schema/模拟 repository 测试推进到真实 PostgreSQL、本地构建 HTTP 与 Linux 迁移演练。当前完整迁移链到 `0042`，稳定 CUAC 申请编号已贯通学生、原子提交、invoice、学校租户投影和授权绑定的限时 Ops 支持会话；账号范围通知和固定五队列运营摘要已有真库及生产构建 HTTP 证据。此前私有文件、学校工作流、官方递交 worker、hosted payment、密码 step-up 与公开 submit 证据继续保留。同校两个项目仍是独立申请。没有真实商户扣款、真实学校接收方、完整 Ops 写流程、生产记忆调度、Agent 提交/自由数据库访问或云端服务启用；不代表阿里云预发布、KMS、法律/PCI 合规或完整产品验收通过。

## 1. 环境与复跑

在 `D:\CODE\CUAC\frontend` 运行：

```powershell
npm run db:pg:rehearse
npm run db:http:rehearse
npm run db:linux:rehearse
npm run test:linux:lifecycle
```

- 入口：`frontend/scripts/pg-rehearse.ts`。
- 测试：`frontend/tests/server/db/postgres-integration.test.mjs`。
- 身份/隔离用例：`frontend/tests/server/db/identity-isolation-rehearsal.mjs`，由上述入口在迁移后调用。
- 邮箱/重置/登录前待办用例：`frontend/tests/server/db/auth-challenges-rehearsal.mjs`，包括真实数据库锁屏障与故障回滚测试。
- 事务审计用例：`frontend/tests/server/db/audit-atomicity-rehearsal.mjs`，通过生产 service 工厂覆盖 16 个写方法。`audit-failure-fixture.mjs` 仅在临时库创建审计故障触发器并在结束后清理。
- Agent 用例：`frontend/tests/server/db/agent-context-rehearsal.mjs` 覆盖原子确认、并发、时钟/过期、范围隔离、来源唯一性及 owner-scoped pending capacity；真实最后名额竞争严格为一个成功、一个 429。不是完整生命周期验收。
- 记忆管理用例：`agent-memory-management-rehearsal.mjs` 现 22 项真库子测试，保留控制、版本、游标、容量、撤权和 COMMIT 不明场景，并新增数据库时钟 365 天上限及 tenant-safe 原子到期擦除；`agent-memory-controls-http-rehearsal.mjs` 保留 6 项实际网络场景。控制与有限保留已本地验收，UX/生产调度/备份删除仍待完成。
- 迁移基线用例：`frontend/tests/server/db/schema-consistency-rehearsal.mjs`，3 个子测试比较 SQL 链与独立 ORM 影子库、核验工件，并检测故意引入的结构差异。`schema-snapshot.test.mjs` 另有 6 项不依赖业务数据库的工件/生成/入口测试。
- 迁移执行用例：`frontend/tests/server/db/migration-guard-rehearsal.mjs`，8 个真库子测试覆盖原生历史兼容、非空样本升级、前缀/hash 异常、竞争、事务回滚与断连/提交不明。只在本轮临时容器中新建自有随机测试库，结束后核验 OID 并清理；不修改正式 SQL 目录。
- 应用连接用例：`frontend/tests/server/db/postgres-transport-rehearsal.mjs`，8 个真库子测试覆盖共享池空闲/查询间/活动断连、耗尽、客户端与服务端期限、提交确认丢失和关闭/重建；仅本轮临时库中的合成样本。
- 发布包用例：`migration-release.test.mjs` 验证固定依赖、可重现摘要和篡改时零 TCP 连接；`migration-release-rehearsal.mjs` 在仓库外执行同一包，覆盖完整迁移、非空升级/no-op、异常 ledger 及各领域历史升级。最新记忆升级逐字段保留正文与来源，只补齐或收敛 expiry 元数据到创建后 365 天；`through-0029 -> 0030` 仍逐字段保留历史 Program Applications 为 v1，不推断 v2 证据或创建 submission/group/outbox。重复迁移为 no-op。
- Linux 用例：`linux-migration.test.mjs` 对本轮最终同摘要包重新通过 7/7，非 root、只读、受限网络、包外校验、受限数据库角色、SIGTERM 恢复和启动器篡改拒绝均有证据。不是完整 API 镜像部署验收；见 [Linux 运行合同](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md)。
- 网络演练：`db:http:rehearse` 先构建当前 API，再通过 `frontend/tests/server/db/http-network-rehearsal.mjs` 启动本轮拥有的 loopback HTTP 子进程；退出时停止服务并清理数据库。不是常驻服务或浏览器 UI 测试。
- 应用退出：`http-lifecycle-rehearsal.mjs` 新增四项构建 API/真库场景；另由 `application-lifecycle.test.mjs` 覆盖八项常规场景。此前独立 `test:linux:lifecycle` 为两个真实 OS SIGTERM 子测试加外层，3/3 通过；Linux 使用合成资源，不是完整 API/数据库镜像验收。详见 [应用生命周期合同](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md)。
- 草稿冻结：`application-draft-rehearsal.mjs` 八项真库子测试覆盖非 draft/时间标记、owner 隔离、冻结后原键恢复、冻结/添加两种锁顺序和回滚、同校多项目独立关系；网络另加两项冻结场景。用户已确认按项目独立申请，见 [提交后端合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md)。
- 草稿移除：`application-removal-rehearsal.mjs` 十二项真库子测试覆盖软删除与字段擦除、原收据保留、同校/跨用户隔离、旧 ID 重试与替换、冻结/已收件拒绝、当前权限、并发、双向父锁、事件/审计回滚及模拟 COMMIT 确认丢失。实际网络另加四项；当前十项常规测试覆盖 service/repository/HTTP/empty-body 边界。无新迁移。
- 草稿编辑/排序：`application-edit-rehearsal.mjs` 十六项真库子测试覆盖备注/奖学金 PATCH、整组原子排序、revision 及 ABA/旧版本、当前权限、同校选择隔离、完整成员验证、真实锁等待、并发添加/移除、审计回滚、COMMIT 不明与版本上限；新增十项常规测试及四项实际网络场景。增量 `0012_application_draft_revision` 经单独非空升级验证。
- 申请基本资料：`applicant-profile-rehearsal.mjs` 十二项真库验证独立资料、权限与字段、并发首次创建、版本/ABA/no-op、撤权双向等待、审计回滚、COMMIT 不明重读、约束与版本上限。新增七项常规测试、四项实际 HTTP 场景及一项非空升级测试。
- `0014_student_applicant_profiles` 阶段新增独立表，当时共 37 表/524 列/120 约束/138 索引；此前申请组、批次、项目和 v1/v2 收据不变。资料合同区分基本资料、未来学业记录、同意和逐项目提交快照。
- 教育经历：`education-history-rehearsal.mjs` 十四项真库场景、`education.test.mjs` 七项常规场景、`education-http-rehearsal.mjs` 五项实际 HTTP 场景及一项非空升级验证。独立集合 revision、多记录增删改、合并后校验、容量/并发、当前权限双向锁、审计回滚、COMMIT 不明和旧 ID 隔离均有证据。
- `0015_student_education_history` 新增教育版本头和记录表；该阶段 39 表/542 列/133 约束/141 索引、16 条迁移、7 份快照。旧偏好、基本资料、选择和收据不变；不从目标学位推断已获学历，不向学校/Agent 开放新资料。
- 项目要求读取初始门槛：`program-requirements-rehearsal.mjs` 八项真库、`requirements.test.mjs` 七项常规及一项非空升级继续回归；原三项网络检查继续保留。精确批次/指针、有效期、无回退、严格文档/摘要、内部字段排除、并发读取一致性和约束均通过。当前 fixture 已补绑定的合成审核证据，不代表真实来源已获准。
- `0016_program_requirements` 新增要求版本与发布指针；该阶段 41 表/559 列/144 约束/145 索引、17 条迁移、8 份快照。旧文案不自动成为已批准要求；读取始终 information_only，未新增 Agent/Ops 写权限或自动资格判断。
- 内部要求治理：`requirement-governance.test.mjs` 新增七项常规，`requirement-governance-rehearsal.mjs` 新增十六项真库，一项从 17 条迁移的旧批准数据升级，以及一项内部真实服务流程经公开 GET 验证的网络场景。准备/独立批准、版本读取、发布/撤回 CAS、权限撤销、真实并发、锁后时钟、四类原子审计及提交确认丢失恢复通过。
- `0017_requirement_review_governance` 增加准备者和结构化审核证据两列，不回填旧记录；该阶段 41 表/561 列/146 约束/145 索引、18 条迁移、9 份快照。旧无证据发布被新 reader 隐藏，审批证据变更不能沿用原内容批准。人工确认不是来源真实性证明，未开放 Ops 写 HTTP、Agent 工具或正式提交。
- 考试记录：`assessment-history-rehearsal.mjs` 十七项真库场景、`assessments.test.mjs` 十项常规场景、`assessment-http-rehearsal.mjs` 六项实际 HTTP 场景及一项从 18 条旧迁移的非空升级验证。覆盖本人自报原始分项、独立版本、真实日期/分制、JSONB no-op、容量/并发、当前权限双向锁、三类审计原子、COMMIT 不明、时区稳定和损坏数据失败关闭/显式移除。
- `0018_student_assessment_history` 新增考试版本头与记录表；该阶段 43 表/578 列/160 约束/148 索引、19 条迁移、10 份快照。移除擦除八个资料字段，不复用 ID/版本；不换算分数、不推断官方核验、项目资格、GPA、同意或提交。见 [考试记录合同](CUAC_ASSESSMENT_RECORDS_CONTRACT.md)。
- 告知版本：`notices.test.mjs` 十二项常规、`notices-rehearsal.mjs` 十九项真库业务、`notices-http-rehearsal.mjs` 四项网络及一项旧库升级。验证用途/语言/正文结构、不同人审核、实时权限双向锁、四类审计原子、首建竞争、发布 CAS、锁后时间、COMMIT 不明、完整审核摘要与公开一致性；不收集学生同意。
- `0019_privacy_notice_versions` 新增范围、版本和发布三表；该阶段 47 表/603 列/175 约束/154 索引、20 条迁移、11 份快照。已发布内容被改后失败关闭，无语言或旧版回退，内部写操作没有 HTTP/Agent 入口；见 [告知合同](CUAC_NOTICE_PUBLICATION_CONTRACT.md)。
- 单项目准备检查：`application-preflight.test.mjs` 十项常规、`application-preflight-rehearsal.mjs` 十二项真库和 `application-preflight-http-rehearsal.mjs` 四项实际 HTTP。精确 owner/parent/choice、同校项目及不同批次、时钟/窗口/奖学金范围、资料版本/数量、要求/告知引用、损坏失败关闭与真实 READ ONLY / REPEATABLE READ 语义均有证据；新增一个学生 GET，无新迁移或写方法。
- 学校申请目标：`school-application-target-rehearsal.mjs` 十项业务真库、`school-application-target-upgrade.mjs` 四项非空升级和 `school-application-target-http-rehearsal.mjs` 三项实际 HTTP。精确项目/批次及 null 关系、生成键不可覆盖、项目删除保护、双向 FK 真实锁竞争、独立状态/事件与学校只读投影均通过。
- `0020_school_application_target_identity` 增加学校批次列及两张表的生成目标键、唯一索引和复合外键；该阶段 47 表/606 列/176 约束/155 索引、21 条迁移、12 份快照。正确旧记录只复制已知批次，错配旧库停止并回滚。见 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。
- 材料预览：`application-material-preview.test.mjs` 九项常规、`application-material-preview-rehearsal.mjs` 十二项真库和 `application-material-preview-http-rehearsal.mjs` 五项实际 HTTP。明确选择字段/记录及四个来源版本，只返回本人精确项目下的白名单内容；实际查询间变更/删除、READ ONLY 误写拒绝、损坏/超量数据、当前权限和全 public 表不变均验证。一个 POST 只读计算，无新迁移、业务写入或同意。
- 项目批次：`application-intake-rehearsal.mjs` 十一项真库子测试覆盖精确目标、旧草稿、目录分页/可用性、复合约束、历史摘要、竞争、关闭双向行锁、审计回滚、COMMIT 恢复和权限。发布测试另加一项旧库/独立 v1 收据升级；新增九项常规、四项真实 HTTP 场景。见 [批次合同](CUAC_APPLICATION_INTAKE_CONTRACT.md)。
- 前提：本地 Docker engine 已启动，且本机缓存有 `postgres:16-alpine` 镜像。脚本不自动拉取镜像或配置云资源。
- 演练开始先从批准的离线 npm 缓存构建发布包，再按固定路径/摘要交给隔离数据库进程。需缓存中存在锁定的 15 个运行依赖；不启用安装脚本，也不向数据库进程传入用户 npm 配置。
- 本次实际数据库版本：PostgreSQL 16.13。
- 16.13 是本机缓存镜像的演练版本，不是生产版本锁定；生产须另行审查 RDS 支持版本与补丁策略。
- 本次本地镜像 ID：`sha256:93d55776e04376e19adb2733e3ccebb4392ee7dd86d8ff238503b30fe719c84f`。每次运行会解析缓存镜像 ID 并打印，便于识别版本变化。
- Windows 固定连接本机 Docker Desktop Linux pipe；不采用远程 Docker context。
- 容器、数据库名称和密码每次随机生成；端口仅绑定 `127.0.0.1`，数据库文件存于容器 tmpfs。
- 数据全为 synthetic fixture，未接触真实学生、学校、支付数据。
- 测试进程不继承应用数据库变量；仅接受 runner 提供的专用 `CUAC_PG_REHEARSAL_URL`，并校验 loopback、专用账号和随机库名。
- 正常成功和测试失败路径都会检查容器归属 label 并清理容器。历次失败复现和修复后运行均已完成清理；本次 0037 最终回归结束后，演练脚本确认临时 PostgreSQL 容器和内存数据均已停止并移除。
- 不连接 staging/production、不发邮件、不执行支付、不启用完整 Agent。

该一次性演练容器本身不是常驻开发数据库。2026-09-01 已另行实现受控持久本地运行时：随机本地凭据、CUAC ownership labels、回环端口、命名卷、自动迁移、幂等纯合成种子和 Node API smoke；应用运行时 `DATABASE_URL` 只由忽略提交的本地状态生成。详见 [本地开发运行手册](CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md)。

- `0022_application_material_selection` 新增逐项目私有材料选择，该轮 47 表/622 列/182 约束/156 索引、23 条迁移、14 份快照。只存选择引用和版本；不复制材料正文、不生成同意或学校收件，见 [材料选择合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)。

- `0023_auth_email_outbox` 新增短期密文待发任务；该里程碑为 48 表/638 列/190 约束/163 索引、24 条迁移、15 份快照。
- 账号验证/重置邮件队列已本地验收（BE-0718）：0023 新增短期加密令牌运输、challenge 归属外键、已提交任务租约、发送前身份复核、确定未受理后的有界退避及结果不明隔离。challenge/入队/成功审计同事务；终态清空密文。19 项业务真库、1 项非空升级及 7 项常规测试覆盖篡改、缺失密钥、回滚、并发、过期及提交确认丢失。默认运行仍 deferred；未启用真实提供方、调度、前端动作页或 Agent 访问。见 [账号邮件队列合同](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md)。
- `0024_application_submission_authorization` 至 `0032_agent_candidate_capacity` 的历史里程碑计数保留在第 3 节。当前完整链再追加 `0033_agent_tool_gateway_rate_limit`、`0034_student_private_files`、`0035_school_application_workflow`、`0036_official_submission_delivery` 和 `0037_payment_provider_reconciliation`，共 63 表/960 列/340 约束/235 索引、38 条迁移、29 份快照。
- `0037` 新增 provider event inbox、退款时间及 provider/payment/invoice 唯一性和生命周期/金额约束。最终真库运行 396/396；支付子测试覆盖签名成功与幂等、本人状态、精确 entitlement、退款撤权、退款先到、取消、错配隔离、审计原子回滚及数据库负约束。SQL SHA-256 为 `ac3dffc78e9be2d313f87650389adaaa54bfa237b1c5a937c819521398918af8`，快照 SHA-256 为 `d91184c58f038ee59a9f771a12297b62a9dc8cc5493adccf83c1f1d73b59e8d9`，独立发布包摘要为 `cdff0471d36d2583f00b6a3770fa4c6cff2648ddd2275cbb802bd7a975e0df47`。

## 2. 已验证

本轮最终 `npm run db:pg:rehearse`：396/396 passed；当前 schema 为 63 表/960 列/340 约束/235 索引。支付成功、退款、取消、乱序、重复、错配、状态投影、审计回滚与一 invoice 一 payment 均在 PostgreSQL 16.13 中验证。此前 `db:http:rehearse`、Linux 迁移与应用生命周期证据是历史里程碑，未在本轮冒充重新验收。

| 验证项 | 证据 |
| --- | --- |
| 密码版本升级 | canonical v1 登录先完成固定 v1/v2 两阶段派生，再在同一用户锁事务内创建 session、精确旧 hash 条件更新到 v2 并写成功审计；审计故障三者回滚，密码重置先提交阻止旧证明覆盖，两个并发旧登录只有一个成功。表示升级保留既有 session，真实重置仍撤销会话 |
| 实际迁移 | journal 的 38 个迁移全部成功，第二次执行不增加记录且 migration hash/时间记录不变 |
| 账号邮件队列 | 19 项业务真库与 1 项升级：加密入队/原子审计、并发签发/领取、发送前撤销检查、过期清理、租约 fencing、确定未受理重试上限、未知结果隔离、缺失密钥/密文替换拒绝以及真实提交后模拟确认丢失。旧挑战、材料、收据逐表不变；不自动回填投递 |
| 材料选择草稿 | 15 项业务真库与 1 项独立升级：本人显式选择、独立版本/no-op/清空、同校项目/批次隔离、资料变化与失效记录、撤权/冻结、首建/编辑竞争、资料修改及移除双向锁、只读一致快照、审计回滚、COMMIT 确认丢失、数据库约束及损坏引用拒绝。旧 22 条迁移全部原数据保留，不自动为旧项目勾选材料 |
| Schema 基线 | SQL 链与 ORM 影子库的 63 张表、960 列、340 个约束、235 个索引一致；29 份快照链和历史工件校验通过 |
| 独立迁移发布 | 最终摘要 `cdff0471d36d2583f00b6a3770fa4c6cff2648ddd2275cbb802bd7a975e0df47`；15 个锁定依赖、38 条迁移，基线至 0037，历史条目未改。完整链、非空历史升级/no-op、异常 ledger 和既有业务证据继续通过 |
| 逐项目授权 | v2 业务真库验证精确 route/policy/material/notice 证据、原键恢复、同范围复用、同校项目隔离、route/policy stale、supersede/withdraw、owner/窗口/学校收件拒绝、并发收敛、真实政策撤回锁等待、审计回滚、choice 移除及数据库完整形状/目标约束。preflight 只返回最小状态并保持 canSubmit=false |
| Linux 运行（历史独立 7 项门槛） | 最近一次 through-0032 包在 Node v22.22.3/Linux amd64 中 7/7；运行时文件不可写、UID 1000、无 capabilities/挂载/默认路由。Linux 镜像为 `sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`；本轮未重跑 through-0037 Linux 门槛 |
| 官方递交 | Slice A-D2 的 route/policy/group 保持回归；0036 已增加固定 HTTPS handoff、双向 HMAC、租约 worker、结果不明隔离和学校可见的原子签收。真实学校接收方、公开 submit 与生产启用仍关闭 |
| 支付与逐项目权益 | exact application-fee entitlement 保持逐项目隔离；0037 增加固定 hosted gateway、签名 webhook inbox、成功/取消/退款/乱序对账、本人状态和精确撤权。真实商户、价格和 staging 验收仍关闭 |
| 原子接收与学校工作流 | 同校项目保持独立 Program Application；0035 增加 tenant-scoped 状态和 contact write，0036 仅在确认回执后使学校可见。公开 submit、真实学校身份与生产接收仍关闭 |
| 结构差异检测 | 更改列类型/非空/默认值/生成表达式、部分索引谓词、CHECK、外键名称/删除行为、RLS 开关与增加意外表均被发现；逐项 rollback 后恢复一致 |
| 完整 ledger 核验 | 非末尾 hash/游标变化、删除、重复、未知或隐藏记录均在 DDL 前拒绝；无历史而已有 public 关系时不自动接管；旧发布不能回退新库 |
| 目标 schema | URL 确实指向另一个含同名表的搜索路径时，执行器仍只升级 public；原有 public 记录保留，旁路表保持原结构与内容 |
| 迁移竞争 | 首任务实际持 advisory lock 并等待业务表 DDL 锁，第二任务明确失败；提交后显式重试为 no-op。另有 ledger 普通写锁时 NOWAIT 拒绝 |
| 迁移回滚与恢复 | SQL/提交前 ledger 检查失败回滚 pending DDL、DML 与记录，首次失败连 metadata 一起回滚；真实终止自有迁移连接后可重试，真实 COMMIT 后合成确认丢失只留下一个已提交版本 |
| 应用连接故障 | 终止共享池的空闲、查询间和活动连接不会产生未捕获错误；未提交的合成业务/审计样本回滚，后续显式请求使用新连接 |
| 超时与池容量 | 池耗尽后借用等待有界、health 为 503；客户端超时销毁连接，服务端按独立语句期限结束；普通语句超时可回滚并复用健康连接 |
| 提交与关闭 | 真实提交后模拟确认丢失仍返回失败但不重放；关闭期间拒绝新借用，已有请求归还后全部关闭，运行期随后可明确重建；应用受控退出另见下面四项网络证据 |
| Catalog 导入 | synthetic sample 连续导入两次，对象 ID 不变，来源 evidence 保持 4 条 |
| 公开 Catalog | cities/schools/programs/scholarships 均隐藏 draft；激活后可查；学校搜索、分页及详情查询成功 |
| 邀请替换和撤销 | 替换后旧 token 无效；撤销后的 invite 不可接受 |
| 并发邀请 | 用数据库锁同时阻塞两次请求再释放，两次请求均成功，最终只保留一个 pending invite |
| 并发接受 | 同一 invite 同时接受两次，仅一次成功，成员身份只有一条，只授予 `school_staff` |
| 事务回滚 | 故意让替换插入触发 token 唯一冲突，原 invite 的撤销被回滚 |
| 数据库约束 | 绕过 service 直接插入重复 pending invite，数据库唯一索引拒绝 |
| 学校状态变化 | 预检查后学校被停用，创建事务拒绝新邀请且不撤销旧 invite |
| 注册/登录/退出 | HTTP handler 使用真实 PostgreSQL；自助注册仅授予 student；哈希保存、错误密码拒绝、退出仅撤销指定会话 |
| 注册失败 | 密码身份创建触发冲突时，用户和角色写入一并回滚，不留下无法登录的账号 |
| 角色与账号撤销 | student/school_staff/cuac_ops/cuac_admin 的角色撤销后，后续 session 解析返回 guest；过期 session、disabled account 无法读取学生资料 |
| 学生归属 | 两个学生分别拥有申请集合和选择；伪造 userId/role 无法改变 profile、saved items、application sets 的归属；跨用户直接读写受 repository 条件限制 |
| 学校租户 | 两所学校、两个老师分别读取本校队列/详情/事件；同一学生跨校申请不会暴露其其他选择；缺少 membership 校验、暂停成员和停用学校均拒绝访问 |
| 关系完整性 | 数据库拒绝 choice 与 set 的学生不一致、program 与 school 不一致、school application 与 choice 的学校/学生/集合不一致 |
| 生命周期兼容 | 无学校记录的未绑定批次草稿保留项目删除置空语义；已有学校记录引用的项目由 0020 RESTRICT 保护，已绑定批次的选择仍由 0013 RESTRICT 保护。不能把草稿删除规则外推到已形成学校记录的目标。未关联审批证据的学生删除的既有级联不影响其他学生，基本资料、教育及考试记录同步级联；要求或告知版本引用准备者/审批人时 RESTRICT 阻止硬删除，须单独治理 |
| 审计字段 | 学生写入和学校读取确实产生 PostgreSQL audit rows，但原始资料、偏好值和私有笔记不进入这些操作的 metadata |
| 邮箱验证 | 同一 token 并发消费仅一次成功；伪造 userId 不改变目标；邮箱变化、账号停用、错误 token 和过期均拒绝；用户更新失败时 challenge 消费回滚 |
| 重置响应 | 存在和不存在账号的正常 HTTP 响应状态、正文相同，仅返回 `data.status = accepted`；内部 deliveryStatus 不返回浏览器 |
| 密码重置 | 密码保留首尾空格；重置、旧 session 撤销及同用户其他 pending reset link 作废在同一事务内；不影响其他账号；故障时三者一起回滚 |
| 登录/重置并发 | 通过 `pg_stat_activity` 确认请求确实等待用户行锁；分别验证登录先拿锁和重置先拿锁，两种顺序都不留下旧密码签发的有效会话 |
| 锁等待中过期 | 请求拿到锁前 challenge 过期；最终写入按数据库实时时钟拒绝，不能沿用请求开始时间延长有效期 |
| 登录前待办 | 必须绑定非空 guest session、一次性 token、当前账号角色；错误浏览器、角色撤销、账号停用和携带学校 tenant 均不能消费；只返回预览/导航，不创建申请 |
| 待办数据最小化 | preview 只接受 `schoolId/programId/scholarshipId/cityId` 标识字段；拒绝任意文本/嵌套对象、敏感字段别名和带 query 数据的 URL；拒绝外站、反斜线、编码分隔符和控制字符跳转 |
| 业务/审计原子性 | 原 16 个 Student/Auth 写方法继续注入真实 audit INSERT 故障；共享快照当前覆盖 36 张业务/审计表，包括申请基本资料、教育经历、考试版本头/记录、要求/告知治理及官方递交政策三表。草稿移除/编辑/排序、资料 PATCH、教育与考试写入、要求/告知/政策治理由各自真库/网络或内部服务用例验证，没有部分写入或伪成功审计；故障解除后明确重试成功 |
| 凭据成功审计 | 新增注册/登录/退出事件，actor/role 来自业务结果或实际撤销的 session；不记录密码、原始 token/hash；重复退出不伪造第二次撤销事件 |
| Agent 原子确认 | 两种候选来源同时确认均只创建一个 memory/成功审计；两个账号持同一有效游客绑定竞争也仅有一个成功；审计或 memory 故障完整回滚 |
| Agent 数据与时间范围 | SQL 下推账号/游客/角色/namespace/tenant 条件；有限期限和锁后实时时钟检查；应用时钟偏快不能延长游客 24 小时和学生 168 小时上限 |
| Agent 迁移 | 非空 source_candidate_id 唯一，cleared 也不可重复；历史重复导致建索引失败，不自动删数据；回滚恢复原有索引 |
| 记忆用户控制 | 仅当前学生 namespace 的合格内容可见；清除正文与旧来源副本，其他账号/persona 不受影响；停用阻止持久化，重启不恢复旧候选；与 reset_at 完全相等的候选也被拒绝 |
| 控制与确认竞态 | 使用真实用户行锁分别验证先确认/先清除和先确认/先停用；最终不留下活动记忆；历史错误来源关联不会清除另一学生候选 |
| 候选清理 | 有界 SKIP LOCKED 批次并发无重复计数；跳过确认中的记录；到期后确认仍被数据库拒绝；清理或控制审计失败时全事务回滚 |
| 申请命令幂等 | 新增 10 个真库子测试，验证账号/操作/请求摘要隔离、唯一键等待、首事务回滚后等待者完成、同事务收据/原审计/replay 审计、删除不重建及模拟 COMMIT 确认丢失后恢复原资源 |
| 草稿冻结与项目粒度 | 新增八项：冻结标记与未知状态拒绝、跨学生不泄露状态、旧键恢复与新键拒绝、真实父行锁双向等待及提交/回滚；同校两个项目可保存两条 choice 和独立 school_application。收件通过合成 SQL fixture 创建，不是正式 submit API 验收 |
| 草稿项目移除 | 十二项：只修改目标行并清除私有草稿字段；重复或冻结后确认不重复事件/审计，旧 ID 不影响重加项目；错误父组/owner/不存在目标均 403，冻结或已有学校收件 409；账号/角色复查、父锁双向并发、事件/审计失败全事务回滚、真实 COMMIT 后合成确认丢失可恢复 |
| 草稿版本化编辑/排序 | 十六项：按字段保留/清空，奖学金范围与快照失效，目标/兄弟记录隔离；整组精确成员及顺序原子保存，no-op 不推进版本/审计；旧版本及 ABA 拒绝，两种锁顺序、并发加减项、冻结/移除等待、审计回滚和 COMMIT 不明均验证；正整数上限失败关闭，不使用版本自动重试覆盖 |
| 项目入学批次 | 十一项：相同项目不同批次是不同草稿，重复精确目标只成功一次，旧未绑定草稿和 v1 收据保留；目录读不泄漏私有内容，错配/过期/未公开目标拒绝，复合外键与非空依赖有效；关闭先提交则新选中拒绝，添加先检查则真实目录更新等待其事务结束；审计/版本/收据原子，确认丢失可恢复 |
| 教育经历集合 | 十四项：多记录独立与整体 revision、严格字段/所有权/角色/tenant/data-class、部分更新的合并后校验、旧版本/ABA/no-op；首建、混合增删改与最后容量名额使用真实竞争屏障，当前权限双向锁等待；审计失败回滚两表，COMMIT 不明只重读，移除擦除九字段且旧 ID 不影响替代记录，数据库约束与版本上限有效 |
| 考试记录集合 | 十七项：原始分项/分制/真实日期、状态与形式的合并后校验、独立版本/归属/正向身份权限；首建/混合操作/最后名额真实竞争，三种写操作均验证账号和角色的双向锁；审计故障明确 P0001 且当前 29 表快照不变；JSONB 键序不构成变化，旧版本/ABA/上限拒绝，真实 COMMIT 后确认丢失只重读；擦除八字段且旧 ID 不影响替代记录，损坏读取脱敏 503、显式移除可擦除，数据库时区不改变考试日期 |
| 要求版本读取 | 八项：无旧文案推断、精确项目批次/显式指针/无回退、父级可用性及数据库时间窗口、文档与来源摘要/时序校验、严格公开 DTO、超量/损坏数据失败关闭、并发指针事务前后快照一致；复合外键、版本/状态/审核完整性及删除限制有效。complete 覆盖仍是 information_only，不是学生资格 |
| 要求审核治理 | 十六项业务真库：严格角色/用途/数据分类/身份与实时权限、准备者和审核者不同、精确来源及内容证据、受限管理读取、稳定 ID 恢复、版本 CAS/禁止回退复活、并发单胜、权限锁顺序、等待后时间复核、审计故障完整回滚、真实 COMMIT 后确认丢失、版本上限与退役范围撤回。没有 Ops 写 HTTP 或真实数据导入 |
| 告知版本治理 | 十九项业务真库：精确用途/语言、结构化纯文本与独立审核、admin step_up 与实时账号/角色；首次范围创建、稳定 UUID 和版本序列、CAS/禁止回退复活、四类写入撤权双向锁及实际成功审计持锁；P0001 回滚完整 29 表、等待后时钟、确认丢失重读、损坏内容/完整审核引用失败关闭和紧急撤回、不同正文的前后快照读取、约束/版本上限/受限分页。首次并发唯一约束遗漏已复现修复，每次运行重复八轮首建及同 ID 竞争；无真实同意 |
| 单项目准备检查 | 十二项：当前学生 persona/分类及实时账号/角色，精确父组/choice 与同校项目/批次隔离；空资料、窗口/冻结/目录/奖学金状态、已有本地收件与跨集合同目标提示；基本资料只读存在性，教育/考试只读版本和数量；完整要求仍 unassessed，告知不是同意；损坏发布/超量库存脱敏 503。真实事务 UPDATE 返回 25006，后续普通写事务仍有效；查询间真实资料/发布变更不混入旧快照，下一请求看新版本；复核期限统一使用最初数据库时刻 |
| 学校申请目标一致性 | 十项业务真库及四项非空升级：精确项目/批次与 null 相等、生成键不能直接覆盖、已有学校记录的项目删除保护、正确旧批次复制及错误旧库全回滚。两种锁顺序各覆盖提交/回滚，实际 pg_blocking_pids 证明等待到目标锁；同校多项目/批次独立记录、状态与事件，旧收据可恢复。学校 DTO 仅新增批次 ID，无新权限或原始学生资料 |
| 逐项目材料预览 | 十二项：明确字段/记录选择、本人角色/归属/精确目标、四版本一致性、同校项目及批次独立摘要、原始分数/日期与无默认全选；真实更新/删除提交在读取中间发生仍得到完整旧版本，下一请求拒绝旧版本。实际 READ ONLY 误写返回 25006，随后普通写可用；选择损坏字段或超量正文脱敏拒绝，全 public 表保持不变。无同意、持久化、学校收件或 Agent 披露 |

历史材料预览、D1、D2 和 0031 轮次保留各自当时的 Linux 证据。当前已追加并封存 0032，并对最终同摘要包完整重跑 Linux 7/7；这仍不是应用或阿里云部署验收。

默认 `db:pg:rehearse` 的 HTTP 用例直接调用 Request/Response handler 并连接真实数据库。最终 `db:http:rehearse` 为 477/477 passed；与数据库单独入口 379/379 存在重叠，不能相加当作独立场景数量。0032、0031 与 0030 完整回归通过，并明确检查不存在 public submit route；候选/到期清理和内部 submission service 都不注册为 Agent、学校或 Ops capability，也没有 outbox worker。

| 网络验证项 | 证据 |
| --- | --- |
| 生产构建路由 | health/catalog/me 经真实 HTTP 返回成功，含 no-store、nosniff 和服务端 request ID |
| API 空闲断连 | 终止本轮 API 的空闲数据库连接后，原 HTTP 子进程继续运行，新连接探测成功 |
| API 活动断连 | 用真实表锁阻塞目录查询并终止其数据库连接，返回脱敏 500；仍持锁时即收到失败，证明没有自动重放该请求；解除后新请求成功 |
| API readiness | 用表锁占满 8 个共享池连接，health 在借用期限后返回 503；解除占用并完成请求后探测恢复 200，不把“已配置”作为成功证据 |
| 请求拦截 | 外站/null Origin、错误媒体类型、畸形/非对象 JSON、超大请求被拦截，用户表行数不变；错误 UUID 返回 400，跨源预检没有 allow-origin |
| Auth 字段 | 错类型/超长邮箱密码昵称、未知命令字段均返回 400；users/identities/sessions/roles/challenges/invites/continuations/audits 计数不变；无 Cookie 签发或清除 |
| 密码边界 | 1024 UTF-8 字节 Unicode 口令及 120 字符昵称成功保存；精确密码可登录，去空格后拒绝；新注册不接受旧的 8 字符最低长度 |
| 旧凭据网络升级 | 通过实际构建登录路由使用 canonical v1 凭据后，数据库只保存固定 v2；响应和审计不泄露 hash/密码，随后同一口令可再次登录。升级标记只记录 `credentialUpgrade=scrypt_v2` |
| 邀请网络流程 | 合成 Ops 可创建/撤销；普通账号不能伪造 Ops 创建邀请；接受由被邀请账号完成且只获存储中的学校/viewer 身份；错账号、未知字段和重放不改变邀请 |
| 游客身份 | 未签名 ID 被替换；重复初始化保留绑定；非法 rotate 拒绝，明确 rotate 更换绑定；全程不创建用户 |
| 注册及归属 | 注册忽略客户端管理员角色；保留游客绑定；两个学生隔离 profile 和申请集合，跨账号 choice 写入拒绝 |
| 待办继承 | 原浏览器登录后只能消费一次；其他浏览器拒绝；只存 guest hash，消费不创建申请 |
| 验证及重置 | 合成验证/reset challenge 经真实路由消费；旧 session 和旧密码失效，新密码保留精确字节；不发送邮件 |
| 退出 | 一个响应发送两个 Set-Cookie，清除账号和游客 Cookie；已撤销账号 Cookie 重放无效，无关畸形 Cookie 不导致 500 |
| 网络审计故障 | 实际构建 API 的 16 个写操作全部注入故障；响应为脱敏 500、不设置 Cookie，数据库快照不变；重试成功后有对应 request ID 的成功审计 |
| 资料 PATCH | 只改姓名不清空国籍/学位/偏好；不同顶层字段并发更新均保留；显式 null/空偏好对象可清空；无效字段/类型不改变原记录 |
| 收藏及奖学金 | 不可用收藏对象、其他学校或不匹配项目的奖学金被拒绝且没有 choice 写入；允许全局及匹配项目奖学金；重复项目返回 409 且保留唯一约束 |
| 候选记忆 | 任意摘要/私密 JSON/伪造分类或期限拒绝；分类、摘要、期限服务端生成；确认必须显式且绑定原浏览器；旧摘要重新生成、旧任意 JSON 不继承；不写正式 profile 或申请 |
| 候选容量 | 同一签名 guest 浏览器最多 12 条、student 账号最多 24 条 active pending；最后名额真实并发只插入一条，另一个请求返回脱敏 429；其他浏览器、账号及到期候选不占当前 owner 配额 |
| Agent 网络原子性 | 实际 API 注入候选/继承审计故障，数据快照不变且不发 Cookie；拒绝审计保留；两条网络请求实际等同一行锁后仅一次成功；当前浏览器轮换绑定后不能继承旧候选 |
| 持久化设置接线 | 后端停用后候选/继承 API 拒绝持久化；重新启用不恢复旧候选。新增六项控制 HTTP 测试覆盖四个实际方法、跨账号/来源/字段拒绝、同版本单胜、旧请求保护、四类审计故障、角色等待与容量恢复 |
| 申请键与断连恢复 | 两个申请 POST 必填键，正文顺序/默认值规范化，跨账号隔离，旧 session 撤销后拒绝而新登录可恢复原结果；测试代理在上游已提交后断开下游连接，原键重试不重复创建申请组或 choice |
| 实际应用池关闭 | 先通过构建 API 创建池，停止后暂不让子进程退出；确认 lifecycle 已关闭且真实 API 数据库连接归零，再允许退出 0，避免关闭到另一份模块内的池 |
| 信号与在途请求 | 数据库表锁使目录请求实际在途；分派 SIGTERM/SIGINT 后新 TCP 拒绝，计数仍为 1；解锁后原请求 200、池关闭、只执行一次停止且退出 0 |
| 客户端先离开 | 数据库等待期间主动断开 HTTP，停止仍等待业务计数，不提前关池或报告完成；解锁后正常排空 |
| 截止时间 | 注册事务阻塞在审计 INSERT，1 秒期限到达后进程退出 1；待数据库连接消失后核验未提交账号/审计均无新增，输出不含合成密码/邮箱；不代表 COMMIT 后退出也会回滚 |
| 冻结后添加 | owner 得到 409，其他学生/不存在的集合仍为 403，伪造 status 返回 400；原键找回原 choice，拒绝不遗留业务、收据或成功审计 |
| 冻结竞争 | 构建 API 在 owner 预读后等待真实父行锁；另一个事务提交 locked_at 后，最终写入复查拒绝，没有新增 choice 或未完成收据 |
| 草稿 DELETE | 四项：实际空正文/无幂等键移除、只返回最小确认、同校选择和替换不受影响；旧添加键 409，原删除可重复确认；非空正文/压缩/错误来源/路径/归属拒绝；真实冻结锁等待和审计故障回滚均通过 |
| 草稿 PATCH/PUT | 四项：实际路由返回完整集合/新 revision，部分编辑、完整排序、no-op/清空及兄弟选择保持；非法输入/越权/来源/旧版本/冻结拒绝；两条同版本请求在真实锁屏障后只有一次成功（200/409）；审计故障回滚，明确重试成功，迟到旧版本仍 409 |
| 批次目录与绑定 | 四项：游客通过实际批次路由分页读取，登录后精确绑定/同键恢复，改变批次同键 409，旧未绑定目标仍可准备；错误类型/来源/归属及关闭拒绝，真实并发重复/不同批次结果正确，审计故障及目录关闭锁等待不产生部分写入 |
| 教育经历 HTTP | 五项：完整多记录增删改、状态切换校验与只读投影、跨用户/游客/伪造字段/错误来源拒绝；首建和修改/移除竞争只有一个同版本赢家，成功返回集合等于重读结果；审计故障没有残留版本头或擦除、等待期间角色撤销后写入拒绝 |
| 考试记录 HTTP | 六项：实际读取/添加/修改/移除保留原始文本、自报标记与独立版本；跨用户/游客/伪造敏感字段/嵌套数据/错误来源拒绝；首建及混合操作同版本竞争单胜，三种审计故障不遗留版本头、分数变化或擦除；等待期间角色撤销拒绝，损坏资料返回脱敏 503 后可由本人明确移除 |
| 要求版本 HTTP | 四项：游客/登录相同 11 字段公开 DTO 与安全头、路径不可被 query 覆盖、无写入口；跨项目/未发布/撤回/到期统一 null 无回退、错误 UUID 400；损坏内容返回脱敏 503；另通过实际内部 prepare/approve/publish/withdraw 服务观测公开 GET，篡改绑定证据失败关闭，POST 不能复活发布。不暴露准备者/审核者/证据或旧文案 |
| 告知版本 HTTP | 四项：真实内部准备/独立审核/发布/撤回经 GET 验证，游客与账号同一九字段公开 DTO 和安全头、无 Cookie/同意写入；语言/路径不受 query 影响，错误范围拒绝，无管理写方法；改审核引用返回脱敏 503 后可明确撤回；实际 publish/withdraw 审计失败保持旧公开指针与完整快照 |
| 单项目检查 HTTP | 四项：真实构建路由只向本人返回一个项目、资料版本/数量与最小引用，无原始资料或写入；跨账号/游客/伪造身份、错误路径、重复/越权查询、跨源 Fetch Metadata 和写方法拒绝；实际 profile/choice 变更后版本更新，批次关闭及角色撤销后收紧；损坏已发布审核证据返回脱敏 503，完整快照不变。该阶段显式 API 方法总数为 54；材料预览、记忆控制和材料选择后当前为 61 |
| Choice route / policy preflight HTTP | 一项完整真实路由场景：route Header 被忽略，route query 被 400 拒绝；政策缺失时 PATCH 409 且无变更，精确 current policy 发布后 PATCH 持久化 route；preflight 只返回最小政策投影并保留 Billing/submit blocker；显式清空 route 后 `ADMISSION_ROUTE_REQUIRED` 恢复。全程不读取其他项目、政策内部证据或 Agent/支付数据 |
| 逐项目费用权益 / preflight HTTP | 真实构建路由在内部合成 settled invoice/payment/success event 与 exact entitlement 后，只返回 `{id,status,grantedAt,expiresAt,current}`；同校另一项目不共享，route 变化只恢复对应项目 `BILLING_ENTITLEMENT_UNAVAILABLE`，`SUBMISSION_UNAVAILABLE` 和 `canSubmit=false` 始终保留。invoice line、payment/event、pricing digest、provider 数据及 grant 能力不出网 |
| 学校目标 HTTP | 三项：本校老师读取同校不同项目/批次的独立记录及事件，投影包含精确 programIntakeId，不泄露私有 choice 或生成键；学生/游客拒绝，外校与不存在记录对有效老师同为 200/null，伪造头或 schoolId 查询不能切换租户。独立状态不联动、成员停用后立即拒绝，无新增写方法。老师身份为测试合成，非员工入职或 MFA 验收 |
| 材料预览 HTTP | 五项：本人 POST 返回选中内容及无授权效力的摘要、安全头、无 Cookie；跨 owner/persona、伪造头、未知嵌套字段/重复 ID/错误媒体/超量或畸形正文/路径/查询/来源拒绝。旧版本 409、当前角色撤销 403、损坏内容脱敏 503，没有部分正文或自动修复，全 public 表不变。该预览里程碑累计 61 个显式导出 |
| 材料选择 HTTP | 6 项：本人 GET/PUT/显式清空/关联移除，游客/他人/persona 拒绝，来源/大小/路径/严格输入，资料更新与撤权，真实等待下并发单胜和审计回滚，以及存储损坏的私有错误。该里程碑为 61 个显式 API 方法、27 个 Student/Auth 业务写方法；无 Agent 工具入口 |
| 逐项目授权 HTTP | 3 项网络场景：本人记录/读取/原键恢复/撤回一个精确项目范围；游客、他人、伪造权限、stale 输入、错误来源/方法拒绝；并发 exact 请求收敛且审计故障不留证据/收据。0028 追加 route/version mismatch 409、伪造 approval 字段 400、v2 format 与最小 policy DTO，并验证 target-set/approval/review evidence 不出网。当前仍无学校、Billing 或 Agent 读取入口 |
| 逐项目材料快照 HTTP | 本人对精确 `school + program + intake + authorization` 执行 GET/POST；服务端重算当前选择与来源版本后，仅保存 AES-256-GCM 密文和认证元数据。真实用户行锁竞争证明重叠请求等待后收敛；审计故障不留密文或收据，密文篡改失败关闭。学校、Ops、Billing 与 Agent 无读取入口 |

生产构建在本地 development 安全配置和临时 PostgreSQL 上运行；Node HTTP 客户端的 Cookie jar 不验证浏览器 Secure/SameSite 行为。阿里云路由、TLS、学校/Ops 全量网络流程、浏览器联调和云上负载测试仍待执行。入口细节见 [HTTP 安全与游客会话合同](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md)。

常规验证：

- `npm run test:server`：当前 523/523 passed；既有 0030/0031、持久本地运行时及全部 Agent 控制回归继续通过，并新增候选容量仓储与 0032 迁移合同测试。
- `npm run test:linux:lifecycle`：此前独立验收 3/3 passed，真实 OS SIGTERM，正常退出 0、到期退出 1，均非 OOM；该轮非 root/只读/无网容器及限定内容的临时挂载目录已清理。
- `npm run db:pg:schema:check`：33 条迁移、24 份快照、58 表，通过；不连接数据库、不写文件。受控临时目录内另验证原生 no-op、只生成预期的一张新表，以及 schema 不匹配时迁移 CLI 的 TCP 连接数为零。
- `npx eslint src/server tests/server scripts app/api`：passed。
- `npm exec tsc -- --noEmit --incremental false --pretty false`：passed。
- `npm run build`：passed。
- `npm run db:pg:check`、`npm run infra:production-check`：本地 warning-only 模式可执行；无应用 DB URL、阿里云环境、session secret、真实邮件、支付配置和 KMS 等警告仍然存在。此结果不等于生产 ready。

## 3. 实际发现与修复

1. 学校目录列表和详情把 `WHERE` 拼接在 `GROUP BY` 后面，真实 PostgreSQL 返回 `syntax error at or near "where"`。已把分组移到筛选后面，并用真实列表/详情查询回归。
2. 旧邀请替换依赖一个撤销并插入的 CTE；并发情况下两次请求可以各自插入，实际复现得到 2 个 pending invite。现改为在单个 READ COMMITTED 事务中先锁学校行，再撤销旧邀请、插入新邀请；数据库新增部分唯一索引作为额外保障。
3. 新事务适配器固定使用同一连接，失败 rollback，最后释放连接；rollback 自身失败时丢弃连接，并保留原始失败给调用者。
4. 注册原先分三次独立写入，身份创建失败会残留用户。现改为单个依赖有序的写入 CTE，用户、密码身份和 student role 一起成功或回滚。
5. session 原先仅检查账号和会话状态，没有检查 `user_roles.revoked_at`。现对每次 session 解析核验当前 role grant，签发学生 session 也要求账号有效且仍有该角色。
6. 缺少 membership verifier 原先沿用 session 中的 schoolId，现返回空 tenant；成员信息必须与当前账号和学校一致，且角色有效、成员 active、学校 active。`GET /me` 的运行时也注入同一校验器。
7. 学生/学校详情原先先按 ID 读取，再由 service 拒绝越权。现把 owner/tenant 作为 repository 必填参数，并加入主查询及关联 choices/events 查询；跨范围 ID 和不存在的 ID 均沿用 `200 { data: null }` 读取合同，不暴露对象是否存在。写入越权返回 403。
8. 原数据库允许彼此不一致的学生/学校外键组合。新增复合外键约束，防止未来脚本或写服务误把记录关联到错误学生/学校。
9. 新增 Auth challenge 用例初次运行复现 9 个业务子测试失败。邮箱验证原先分两次提交，且最终写入没有重查 token、有效期、账号和邮箱；现使用同一事务锁定用户，重查并更新，任何失败回滚。
10. 密码重置原先先消费 token、再改密码、最后另行撤销 session；现作为一个 repository 事务完成，并作废该用户其他 pending reset links。公共 HTTP 响应不再返回能暴露账号存在性的 deliveryStatus。
11. 登录原先可以用重置前取得的密码验证结果在重置后签发新 session。现签发和重置使用同一用户行锁，签发时重新比较当前密码 hash。先登录则其 session 被随后重置撤销；先重置则旧 proof 签发被拒绝。
12. continuation 原先允许空 guest 绑定，最终写入缺少 token/期限/角色复查；现两层校验并限制导航数据。对象引用不构成资源访问授权，下游仍需重新做 catalog/policy 校验；这不是完整 Agent 长期记忆实现。
13. API 导出统一接入 Origin/JSON/请求大小及期限校验，错误响应脱敏、私有响应禁止缓存。动态路径参数支持异步解析，并在业务查询前验证 UUID；初始该轮 37 个导出通过检查，草稿 DELETE 后为 38 个，后续编辑/排序后当前 40 个显式 HTTP 导出均通过 AST 门槛。
14. 客户端自选的原始 guest ID 不再可信。新增签名游客会话初始化入口，服务端校验时限和签名后仅使用单向 hash 绑定；logout 同时清除游客 Cookie，未验证 guest 不能写上下文候选。无状态轮换不撤销旧 token 的其他副本，数据库清理仍是独立任务。
15. 原 profile PATCH 将所有遗漏字段也覆盖为空。现使用 SQL 字段存在标志，只更新明确提交的字段；真库验证不同顶层字段并发修改不互相擦除。
16. choice 原先未检查奖学金的学校/项目范围，saved item 也未核验对应目录对象。现把 active/关系判断放入写入 SQL；重复同一项目的网络用例实际复现 500，已针对既有唯一约束映射为 409，未放宽约束。
17. Agent 原先接受客户端 summary、dataClass 和任意 structured，拒绝审计还可能记录输入标签。现仅接受受控 study_goal 结构，服务端生成内容与期限，旧候选重验结构与摘要。输入证据见 [领域输入合同](CUAC_STUDENT_AND_AGENT_INPUT_CONTRACT.md)，后续新增的事务、并发与时间证据见 [记忆确认合同](CUAC_AGENT_MEMORY_CONFIRMATION_CONTRACT.md)；自动清理尚未实现。
18. Auth 原先缺少邮箱/密码字段上限，注册昵称被静默截断，异常邮箱类型可能进入限流代码导致 500。现 HTTP/service 均做字段校验，限流只收到有界字符串或 null；新密码采用 15 code point 下限与 1024-byte 上限，保留精确原文，旧密码登录不追溯套用新下限。
19. 一次性 proof 现严格校验 UUID/canonical token；非法或错误 proof 不消耗 challenge 或修改密码。续接从任意内部路径/action 收紧到已登记组合，catalog reference 必须是 UUID，消费时重验旧记录。见 [Auth 输入合同](CUAC_AUTH_INPUT_CONTRACT.md)。
20. 原 Student/Auth 审计在业务事务之后执行，注册/登录/退出还缺少成功事件。现生产服务方法统一同连接事务，repository 内层事务加入外层；内层失败标记 rollback-only，已结束的 scoped client 禁止复用。真实故障测试证明业务与审计共同回滚，详见 [事务审计合同](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md)。该原子性本身不解决提交不明；两个申请命令现有下述专属恢复合同，其他命令仍待处理。
21. Agent 原先先写 memory，再独立标记 accepted 和审计，且按裸 ID 读取候选。现通过生产工厂统一事务、SQL 范围过滤和行锁，接受前再查数据库时钟；唯一来源索引保证不能插入第二条。创建拒绝审计在回滚后单独保存。见 [记忆确认合同](CUAC_AGENT_MEMORY_CONFIRMATION_CONTRACT.md)。
22. 第一次新版网络演练实际发现游客 TTL 超过 24 小时：created_at 默认取事务开始时刻，expires_at 却取稍后的应用时间。现使用同一个数据库实时时刻，并以小时数限制最大 TTL；新测试把应用时间推到 2099 年，仍不能延长数据库期限。严格 24 小时网络断言保持不变，修复后全套通过。
23. 创建申请组和无 program 的 choice 原先无法识别重复传输。现两个 HTTP 命令必填幂等键，收据与业务/审计同事务提交；确认丢失后不盲目新建，而用原键恢复原资源。测试包括真实唯一键等待、已执行 COMMIT 后合成抛错、已收到上游成功后的真实下游连接关闭，详见 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。不等于 RDS 故障切换或所有 Auth/支付命令已具幂等。
24. 旧最新快照仅覆盖 23 表，当前 12 条迁移却已有 36 表；内存差异实际提出 13 条重复建表。现增加经过真库对比的 `0011_snapshot.json` 和历史字节清单，不重写旧 SQL/journal。两处 ORM 外键名称显式对齐既有 SQL，删除行为不变。
25. 既有最后 journal 的时间游标位于 `2026-09-01T02:00:00Z`，晚于本次机器时钟；原生生成下一条可能落在旧游标之前而被执行器跳过。封装只把新条目推进至不小于前条加一，保留历史；原生 no-op、追加条目和迁移前拒绝连接均已验证。详见 [迁移基线规范](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md)。
26. 原生迁移执行入口只依据最后一条游标，缺少完整历史校验与执行互斥。现仍用 Drizzle 解析工件，但在现有同连接事务内申请 advisory lock、锁定 ledger、逐条核验前缀/hash，再执行待办 SQL 和提交前检查。兼容原生创建的非空库，不新增或改写历史 SQL。
27. 新增真实断连测试初次运行产生 `Connection terminated unexpectedly` 未捕获事件：查询拒绝之外，驱动另发异步连接错误。专用迁移 pool/connection 现记录错误并失败退出；复跑终止连接和提交确认丢失均通过。该证据不覆盖应用共享 pool，已另列 BE-0714。
28. BE-0714 后续确认应用池没有空闲错误监听、事务缺少查询间错误监听，health 只看 URL 配置。现加入有限等待和独立错误处理，真实 probe 决定 readiness；8 个真库和 3 个网络故障场景通过，详见 [应用连接合同](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md)。
29. 客户端读超时初测把服务端释放也要求在 3 秒内完成，而测试服务端配置为 5 秒期限，真实 PostgreSQL 因继续执行语句使断言失败。现分别验证立即释放客户端池容量、服务端期限结束及最终回滚；使用更短的合成期限复跑通过。客户端退出不等于服务器立即取消，不能据此盲目重试写入。
30. 迁移原先依赖可变 checkout 与安装目录。现由通过基线检查的构建器生成代码/计划/依赖清单，发布入口先核对外部预期摘要再导入驱动；测试证明修改运行代码、依赖、计划或清单不会先建立数据库连接。启动器自身仍须外部信任，部署只读保护尚未配置。
31. 初次在隔离数据库进程内打包因缺少用户 npm 缓存环境而失败。现前移为 runner 构建一次后传递固定路径/摘要，数据库进程只执行工件；未放宽其环境隔离。后端 316 项、真库 106 项和联合 129 项均通过。
32. Linux 首轮因 internal 网络不提供预期 host port binding 而止步。数据库增加本轮专用 loopback 控制网络；迁移容器仍只在 internal/isolated 网络。运行时断言网络成员、发布地址及无默认路由，未给迁移容器接通控制网络。
33. 篡改镜像构建首先因净化环境遗漏 ProgramFiles 而找不到 Windows 系统 BuildKit，随后裸镜像 ID 被 Dockerfile FROM 当成 registry 名而失败。现只恢复系统插件路径，使用独立空 Docker 配置及核验过的本地临时标签。六类 Linux 场景全部通过；SIGTERM 退出码明确为 143、非 OOM，测试镜像、容器、两个网络及临时目录均已清理。`--network=none` 不代表整个 Docker 构建器无出网，生产来源/出网控制仍待配置。
34. 受控退出初测仅调用 server.close，活动响应结束后因 keep-alive 导致排空一直等到期限。现设置响应关闭连接并回收空闲连接。入口与构建 API 通过版本化进程注册表共享实际池关闭器，避免源码导入和构建 chunk 各有一份状态。该轮新增八项常规、四项真 API/数据库、两项 Linux OS 信号场景均通过；该轮总计为 324 常规、106 真库、133 联合、7 Linux 迁移及 3 Linux 应用信号测试，各入口有重叠，不累计为独立场景。
35. 提交设计核对发现添加 choice 只检查 owner，不检查已提交/锁定状态；新增定向测试先复现 Missing expected rejection。现新建分支拒绝非 draft，SQL 对 owner-scoped 父行加锁并以锁后状态/时间标记决定写入，原键恢复在新建分支之外。三项常规、八项真库、两项网络场景通过，该轮总计为 327/114/143。用户确认同校不同项目仍是独立申请，修正旧文档合并规则，schema 和迁移包未改。
36. 草稿项目移除新增十项常规、十二项真库和四项网络场景。网络初跑的测试统计查询复用了 UUID/text 参数，出现 `operator does not exist: text = uuid`；修正显式类型转换后完整重跑，该轮总计为 337/126/159。软删除、状态事件、成功审计同事务，原 ID 重试不影响新 choice；该轮不新增迁移、不改前端、不开放正式提交或支付。
37. 草稿备注/奖学金编辑及整组排序新增 application_sets.revision；加/减/编辑/排序实际变化均在父锁内推进版本，旧版本即使值相同也拒绝。新增十项常规、十六项业务真库、一项非空升级及四项网络场景。测试首跑误用了奖学金 name_en 字段（实际为 title），Linux 旧锁屏障也未阻塞新增 ALTER；修正 fixture 和 application_sets 锁屏障，并加强为 SIGTERM 后完整结构一致断言。未跳过失败场景。审查后清单仅追加 0012 条目/哈希，最终摘要包重新通过 347 常规、143 真库、180 联合及 7 Linux 迁移测试；不同入口有重叠。未改前端，正式提交、真实支付及云端仍未开放。

38. 项目批次绑定新增 nullable 外键、目标唯一规则、v2 摘要及公开分页读取。审查生成 SQL 时发现复合外键排在被引用唯一索引之前，已只调整新迁移的依赖顺序。首轮测试暴露旧断言缺少新增字段，以及外键测试先撞到另一唯一规则；修正样本后真库通过。实际 HTTP 随后发现路由独立白名单遗漏 programIntakeId，合法输入被 400 拒绝；现路由/领域共用白名单，并增加 HTTP 回归，未跳过失败场景。最终已审查基线至 0013，同摘要包通过 356 常规、155 真库、196 联合及 7 Linux 迁移测试；11 个新业务真库、1 个非空升级、4 个新网络场景覆盖批次身份及双向真实锁竞争。前端未改，正式提交仍未开放。
39. 独立申请基本资料新增 0014、GET/PATCH、严格白名单、本人 student_pii 权限、账号/角色锁和独立 revision。初测修正了缺失 accountStatus 的模拟会话和放错分组的路由测试；真库并发测试发现第二个等待者可能排在首个等待者后，改为检查完整阻塞链，仍要求两个请求进入真实竞争，没有减弱单胜断言。七项常规、十二项业务真库、一项非空升级和四项网络场景通过。最终基线仅追加 0014，当前共 363 常规、168 真库、213 联合及 7 Linux 迁移测试；各入口有重叠。原偏好/账号/选择/收据不回填或改写，学校/Agent 不获得新资料访问，正式同意及提交仍未开放。
40. 多条教育经历新增 0015 两表、四个 HTTP 导出和独立集合版本。开发期定向测试修正了权限检查前访问 repository 属性的顺序；审查生成 SQL 时将过长的新外键名改为显式短名称，仅改未封存的新迁移/快照。首真库测试把审计 created_at 中的 2026 误判为教育年份泄露，改为精确 metadata 白名单断言并保留正文拒绝；容量竞争进一步要求两个真实锁等待。十四项业务真库、一项非空升级、七项常规及五项网络新增场景全部通过。最终基线仅追加 0015，同摘要包通过 370 常规、183 真库、233 联合及 7 Linux 迁移测试，各入口有重叠。教育资料独立、删除擦除九字段、权限/版本/审计原子；未改前端，正式同意、提交及云端尚未开放。
41. 要求基础新增 0016 两表和公开只读 GET，以批次范围/显式发布指针读取已批准有效版本，严格文档与摘要校验，永不回退旧版本或旧 HSK/英语文本。审查生成 SQL 时调整新复合外键到其唯一索引之后，仅改本条未封存迁移。七项常规、八项业务真库、一项全部旧表比较升级、三项网络场景通过；最终基线仅追加 0016，同摘要包通过 377 常规、192 真库、245 联合及 7 Linux 迁移测试，各入口有重叠。发布样本全为合成 SQL fixture，没有启用受控审批/发布写服务、真实要求导入或自动资格判断；正文不可变性/来源真实性不是仅靠摘要即可证明，生产写入治理仍是后续门槛。
42. 要求内部治理新增 0017 两列和受控服务，明确 session/step_up 正向身份白名单、不同人员批准、内容/来源/有效时间绑定，以及发布/撤回 CAS、结果恢复和元数据审计。发布在目标锁等待结束后重新读取数据库时钟；审计回滚用例明确断言故障触发器 P0001，避免把其他拒绝误计为审计验证。新增七项常规、十六项业务真库、一项旧批准数据升级及一项真实网络流程均通过。最终基线仅追加 0017，最终同摘要包通过 384 常规、209 真库、263 联合及 7 Linux 迁移测试，各入口有重叠；Linux 镜像为 `sha256:ca24b361f6c9dadd6002183df72af16e38a68e3c1751e82fc388958194b79398`。源码 lockfile、历史 17 条 SQL、五个迁移运行模块和依赖版本经独立对比不变。所有样本合成且临时资源清理，不代表生产来源真实性、人员/MFA/访问准入、不可变 ACL 或阿里云验收。公开读取升级必须暂停入口、迁移并排空旧 reader 后再开，不能回退到绕过证据的新旧混跑状态。
43. 考试自报记录新增 0018 两表、四个受保护 HTTP 方法和独立集合版本。保存原始分项文本、分制、报告形式与真实日期，不自动换算或推断核验/资格。审查时将 no-op 比较统一为规范化领域对象，避免 PostgreSQL JSONB 键序造成伪变化；数组顺序仍属于内容。十项常规、十七项业务真库、一项从 18 条旧迁移的逐表比较升级和六项网络场景通过。账号/角色撤销双向等待覆盖全部三种写操作；审计用例明确 P0001 与 26 表完整快照，真实 COMMIT 后确认丢失、跨时区日期和损坏资料移除另有证据。最终基线只追加 0018，同摘要包 `f1e76263cc08e1e13951592d62348ad5bb4dc4b100f33e13d9f6c7894f5944bf` 通过 394 常规、227 真库、287 联合及 7 Linux 迁移测试，各入口有重叠；Linux 镜像为 `sha256:859829c0daf831f9763c077e34ce742eebaf07332d7ed794e850d8bf24b989b1`。独立比较确认历史 18 条 SQL、五个迁移运行模块、15 个依赖版本和源码 lockfile 不变。所有样本合成，未改前端页面，未开放学校/Agent 访问原始成绩、官方核验、同意、正式提交、真实支付或阿里云部署。
44. 告知版本新增 0019 三表、独立审核及 CAS 发布/撤回、一个只读 GET，公开内容绑定正文和完整审核摘要；不创建真实正文或学生同意。审查时调整新迁移的复合外键创建顺序、拒绝稀疏数组，并让一致性测试使用不同正文。最终真库复跑发现首次范围并发创建仅处理主键、遗漏次级唯一索引，明确复现 `23505/privacy_notice_scope_unique`；仅该范围插入改为无指定冲突目标的 DO NOTHING，随后仍以完整条件加锁复读，约束不放宽，不自动重试事务。每轮重复八次首建及同 UUID 竞争。十二项常规、十九项业务真库、一项逐表保留旧 consent/资料/考试/收据的升级及四项网络场景通过。最终同摘要包 `1869d6df2bb85da1b32b93c33774ed9a00d06198def7260a4e01d4a7f7b744c1` 通过 406 常规、247 真库、311 联合及 7 Linux 迁移测试，各入口有重叠；Linux 镜像为 `sha256:6dc8cc7b4042370aac328da9e0e007a0d1bb0ffa87b3123f5972365146c0e111`。独立比较确认历史 19 条 SQL、五个迁移运行模块、15 个依赖版本及源码 lockfile 不变，基线仅追加 0019；失败和成功运行均清理，最后按标签检查容器/网络/临时镜像无残留。所有样本合成，未改前端、未开放员工 MFA 签发、管理写 HTTP、私有 Agent 访问、真实同意、正式提交、支付或云端部署。
45. 新增单项目 choice preflight 准备报告，返回稳定项目身份、集合/资料版本、资料存在性/数量及要求/告知版本引用，不包含原始个人资料或成绩。使用独立 READ ONLY / REPEATABLE READ 事务，第一次数据库查询固定毫秒时刻并传给已有发布读取；不改变这些公开接口的默认时钟。真实 UPDATE 故障返回 25006，查询间提交资料与发布后仍读取一致旧版本，下一次报告读取新版本；目标、窗口、奖学金范围/已知期限、当前角色和跨集合同目标记录均验证。首个故障样本误以为删除教育版本头能留下孤立记录，实际外键级联清除了记录；改为超量样本后又被缺失 attendance_status 的 CHECK 拒绝。随后补全合法形状并确认确有 21 条活动记录，才验证 503 与不修复写入；未放宽数据库约束或跳过失败用例。十项常规、十二项真库和四项真实 HTTP 场景通过，最终总计 416 常规、259 真库、327 联合；各入口有重叠。迁移仍为 20 条/11 快照/46 表，发布摘要仍为 `1869d6df2bb85da1b32b93c33774ed9a00d06198def7260a4e01d4a7f7b744c1`，未改迁移/lockfile，Linux 7 项沿用同摘要先前证据。本轮全部临时服务/容器已结束，归属标签检查无容器/网络/运行镜像残留。当前 canSubmit=false，真实授权、材料快照、费用权益及正式提交未开放，前端未修改。

46. 目标一致性定向测试先复现同校错项目仍可写入（Missing expected rejection）。追加 0020，通过不可覆盖的非空生成键和复合外键约束 school_application 与 choice 的精确项目/批次及 null 关系，已有学校记录引用的项目改为 RESTRICT。升级先锁表检查旧项目一致性，任一错配整批回滚；仅复制已知 choice 批次，逐字段保留旧资料/时间/状态/收据。首轮 null 测试先撞到 fixture 另一条未绑定 choice 的唯一索引，明确移除无关活动样本后仍严格断言目标 FK；首轮 HTTP 将他校详情误断言为 403/404，核对既有合同后同时断言他校与不存在均为 200/null，学生仍须 403。基线封存后常规测试的旧 throughIndex=19 断言失败，改为已审查的 20 及完整十二快照列表，未放宽工件检查。新增十项业务真库、四项非空升级和三项真实网络场景；最终通过 416 常规、273 真库、344 联合及 7 Linux 迁移测试，各入口重叠不能相加。最终包摘要为 `69d8329afe046785bd42da5a44ea44e0a7c61ffe32a90856d7256b243ce7c1b6`；Linux 镜像为 `sha256:2b5bcccf431533e01df1b59819f256222e11570ae03125f281f9a47ba8842a24`。停止屏障改为先完成 19 条、在 0019 DDL 执行后等待 0020 明确锁语句；SIGTERM 后整个 schema/ledger 恢复到 19 条，显式重试补齐两条。历史 20 条 SQL、五个运行模块、依赖版本与源码 lockfile 不变。最终容器/网络/临时镜像标签检查均为空；未改前端，无新 Agent 权限、学校写 HTTP、真实授权或正式递交。

47. 新增本人逐项目材料预览 POST，补上 preflight 数量/版本报告之后的具体内容核对。请求仅包含字段/记录选择和四个已读版本，服务器读取精确 owner/parent/choice 和已选资料，在同一 READ ONLY / REPEATABLE READ 事务构造白名单内容。SQL 不获取未选记录正文；实际更新/删除在查询之间提交时仍返回同一旧快照，新请求拒绝旧版本。内容摘要绑定账号、项目/批次、选择、版本和值，排除每次变化的 checkedAt；它不是签名或同意。初期 lint 发现未使用的解构变量，改用既有白名单 DTO mapper，避免让 expectedRevision 进入教育材料。九项常规、十二项真库、五项实际 HTTP 全部通过；最终总计 425/285/361，各入口有重叠。当前显式 API 方法 55 个，Student/Auth 业务写方法仍为 26 个；仅新增只读计算，无新 SQL/快照/基线/依赖锁变化，发布摘要仍为 `69d8329afe046785bd42da5a44ea44e0a7c61ffe32a90856d7256b243ce7c1b6`，Linux 7 项沿用上一轮同摘要证据而非本轮重跑。预览固定 self_review、canSubmit=false、persisted=false、consentRecorded=false；未改前端，未开放真实授权、持久化材料、学校/Agent 披露或正式提交。

邀请并发方案依据 PostgreSQL 的[事务隔离说明](https://www.postgresql.org/docs/16/transaction-iso.html)：READ COMMITTED 的后续命令取得新的快照。因此邀请锁单独执行在撤销/插入之前；不能把等待锁和后续业务读取重新合成一个共享旧快照的查询。草稿父行使用锁后 revision/行状态，批次使用 FOR SHARE 后重验目标状态，分别有实际并发证据，不能把三种查询协议混为一谈。

账号重置基线参考 [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)。本轮验证正常响应的一致性和 token 一次性/过期/会话失效；没有证明响应耗时一致，也没有完成外部邮件故障下的反枚举测试。

48. 记忆控制定向回归先复现 Agent 用途仍可调用管理服务（Missing expected rejection）。现管理方法要求 student_action、student surface、有效会话及低敏偏好范围，数据库先锁账号再锁有效 student role。新增 0021 设置 revision，clearAll/开关比较当前版本且原子推进，迟到请求不能覆盖之后的停用或擦除新确认内容；COMMIT 不明不自动重试。列表采用 owner-scoped UUID 游标与数据库微秒比较，清除的墓碑仍可翻页，异常正文页按扫描位置前进；两种确认在同一账号锁内强制 100 条未清除记忆上限，超限完整回滚接受标记与审计。旧库逐字段保留 enabled、微秒 reset、正文和原有数据，缺失设置不补行，101 条旧记录不破坏性回填。四个新 HTTP 方法有六项真实网络验证，涵盖私有投影、输入/同源边界、同版本单胜、四类审计故障、撤权等待及容量释放后重试。新增六项常规、八项业务真库、一项升级；最终 431 常规、294 真库、376 联合和 7 Linux 迁移门槛通过，各入口有重叠。最终包为 `4e85b4ffdd211defbc1218c4ca7b69aa180316fa0c57f55d9448af21984eff62`，Linux 镜像为 `sha256:73f25a818ad75eab5f28f450c69f6436c56899b87fbb011c45bb978e3561862c`；59 个显式 API 方法。基线只追加 0021，历史 21 条 SQL/快照、五个运行模块、依赖版本和 lockfile 不变。未改前端，没有生产长期记忆、调度、完整 Agent、真实同意、正式递交或云端发布；控制 UX、候选配额、保留/到期、会话撤销和云端仍需验收。

49. 新增 0022 逐项目材料选择表及本人 GET/PUT；字段/记录 ID、四个来源版本与独立 revision 持久化，不保存材料正文或授权。账号/角色/集合/choice/资料锁内复查当前权限和版本，清空保留版本，no-op 也必须使用当前版本；资料变化提示重新核对，被移除的本人记录只返回失效 ID，未知/他人已存引用失败关闭。choice 移除同事务删除附属选择，不影响同校其他项目，已有墓碑的迟到保存不能重建。首轮真库新增场景通过，但两项旧断言仍写死 29 表和两处生成键；补全 30 表与三处生成键清单后重跑。常规回归另发现旧 SQL 断言禁止所有 DELETE，改为精确只允许 application_material_selections 且必须通过 removed_choice 与本人/集合范围清理，继续禁止硬删 choice；没有放宽业务约束。最终 437 常规、310 真库、398 联合和 7 Linux 迁移测试通过，各入口重叠；新增 6 常规、15 业务真库、1 非空升级及 6 网络场景。最终同摘要包 `c9ae5798a5f7cca3e9305f6b74872e4edf18830d071ace9f78bedc904589698e`，Linux 镜像 `sha256:ff6629d6f0bbb52b3f652706863378067eb8211510db479a1109edbf1b5d48a3`。基线只追加 0022，独立比较确认历史 22 条 SQL/13 快照、五个运行模块、15 个依赖与源码 lockfile 不变。非空旧库全部原字段/收据/停用记忆设置保留，空选择不自动创建；Linux 从 19 条前缀中断回滚后显式补齐四条。最终标签核对无演练容器/网络/运行镜像残留。未改前端、未启用真实同意、正式提交、支付、学校/Agent 访问材料或云端发布；保留期/账号删除、真实告知及前端接线仍待完成。

50. 账号验证/重置邮件队列已本地验收（BE-0718）：0023 新增短期加密令牌运输、challenge 归属外键、已提交任务租约、发送前身份复核、确定未受理后的有界退避及结果不明隔离。challenge/入队/成功审计同事务；终态清空密文。19 项业务真库、1 项非空升级及 7 项常规测试覆盖篡改、缺失密钥、回滚、并发、过期及提交确认丢失。默认运行仍 deferred；未启用真实提供方、调度、前端动作页或 Agent 访问。见 [账号邮件队列合同](CUAC_AUTH_EMAIL_OUTBOX_CONTRACT.md)。 原来可注入的 send 回调发生在成功审计之前，已改成明确的 enqueue 合同与同连接事务工厂。签发先锁账号再插 challenge，避免并发 FK 锁升级问题，并按锁后当前邮箱/密码身份及数据库时间复核。邮件链接不再指向 POST-only API 或在 query 携带 token；显式配置的同源动作页仍待前端实施。首轮常规测试暴露旧断言禁止 SQL 检查 password_hash，现仅允许存在性检查、不读取原始哈希返回；最后 ESLint 要求控制字符检查用字符码实现，新增恶意 origin 样本回归。最终常规 444、真库 330、联合 418 及 Linux 7 项通过，入口重叠；没有新增网络用例或公开 API。最终包 `b0cb03ce60af3a56dc1f4d84e6d1d9315dafff327371a92bd50cfdf8dfce4455`，Linux 镜像 `sha256:1d25e6d2019ebc4d133446eddf77b30bd25b26fcb939ed254f3746d6e362c9b6`。旧 23 条 SQL、14 快照、五个迁移运行模块、15 个依赖和 lockfile 不变；迁移工件变动只涉及新增 0023 SQL/快照及 schema/journal/baseline。最终按 cuac.rehearsal 标签只读核对容器、网络、运行镜像均无残留。真实提供方、KMS、动作页、调度和云端仍未启用。

51. 密码同步计算与格式容错问题已复现：三个合成样本约 132ms 内没有让出事件循环，旧解析器接受追加的 `$ignored`。替换为共享两任务上限的异步原生 scrypt，注册/登录/重置全链路 await；严格 canonical 三段格式，缺失/停用/损坏登录分支仍做一次有界派生，超载或底层失败脱敏且不产生业务/成功审计写入。9 项常规回归覆盖兼容、让出、格式、并发、失败释放与 HTTP；3 项真库屏障覆盖计算期间另一注册先成功、重置后旧登录证明失效、过期后重置不消费。最终常规 467、PG 333、构建 HTTP 联合 421 通过，各入口重叠。TypeScript、后端 ESLint、离线 schema 通过；初次 lint 把 useKey 回调误识别为 React hook，已改为 consumeKey。迁移包仍为 b0cb03ce60af3a56dc1f4d84e6d1d9315dafff327371a92bd50cfdf8dfce4455，没有 schema/API/前端/依赖锁变动；独立 Linux 未重跑。临时 HTTP/PG 已结束，归属标签检查无容器残留。旧工作因子仅兼容，不是生产强度批准；版本化参数升级、泄露口令筛查、MFA、ECS 容量及完整侧信道仍待完成，见 [密码运行合同](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)。

52. 在异步执行边界上完成固定 `scrypt_v2` 新写入与旧凭据原子升级：v1 保持严格只读兼容，v2 固定 `N=32768,r=8,p=3`，编码中携带受控版本和参数；解析器只接受代码内两种 canonical profile，拒绝任意工作因子。一次登录在同一共享准入槽内依次执行 v1、v2 派生，未知、停用、无哈希、损坏和两版有效身份均走固定两阶段；阶段间清零旧 key，底层错误脱敏且槽位在原生工作结束前不释放。有效 v1 在第二阶段直接形成升级候选；生产仓储锁定用户后，以精确旧 hash 条件把 session、v1 到 v2 更新和最小成功审计置于同连接事务，审计失败、重置竞争和并发旧登录不会留下部分升级或覆盖新密码。首轮完整 PG 中所有生产升级场景通过，但新增测试核对误把文本 request_id 与 uuid 数组比较，PostgreSQL 以 42883 拒绝；只修正测试为 `text[]` 后完整重跑。最终 470/470 常规、335/335 PG（334 子测试加外层）和 424/424 构建 HTTP（同 334 数据库、89 网络/生命周期及外层）通过，TypeScript、完整后端 ESLint、离线 schema 与演练内生产构建通过。无 schema、迁移、公开 API、前端或依赖锁变更，迁移包仍为 `b0cb03ce60af3a56dc1f4d84e6d1d9315dafff327371a92bd50cfdf8dfce4455`；独立 Linux 本轮未重跑。旧二进制不能读取 v2，发布必须停止 Auth 写入并排空整个旧实例群后整批切换；写入 v2 后不得回滚到只读 v1 的旧代码。泄露口令筛查、MFA、ECS 容量/延迟/超载和更广侧信道仍是生产门槛，见 [密码运行合同](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)。

53. `0024_application_submission_authorization` 将学生确认固定在一个 choice 的精确 `school + program + intake`，保存材料选择/四个来源版本、选择与内容摘要、当前告知版本/发布 revision/摘要、固定确认方式和数据库时间；不复制姓名、教育/考试正文、Agent 对话或支付数据。本人 GET/POST/DELETE 支持原键恢复、同范围复用、范围变化 supersede 和明确 withdraw；choice 移除在同事务结束 active 证据。preflight 在同一只读快照判断证据是否仍 current，只解除授权 blocker，`canSubmit=false`。首次完整 HTTP 演练暴露两项历史迁移夹具在旧 schema 上调用当前 preflight，导致预期缺少 0024 表；保留生产 fail-closed，改由历史夹具按当时表直接读取版本后完整复跑。最终 476/476 常规、341/341 PG、433/433 构建 HTTP、7/7 Linux 通过；当前 25 条迁移、16 快照、49 表/669 列/208 约束/166 索引，包摘要 `4d83e461eef878f9e8e0f6d37486751d6998ca989bf1f6cd26f8bc1c04cdd088`。没有正式材料快照、费用权益、school application、通知、Agent 工具、前端修改或云端发布。

54. `0025_application_material_snapshot` 为每条逐项目授权最多保存一份 AES-256-GCM 认证 payload，关联数据和复合外键同时绑定 user/set/choice/school/program/intake/authorization；数据库没有第二份材料/选择明文列。本人 GET/POST 只返回证据 DTO，preflight 仅返回 `{id,authorizationId,capturedAt,current}`，密文篡改或缺失旧 key 均脱敏 503，绝不回退明文。非空 through-0024 升级逐字段保留旧授权且不自动创建快照，升级后显式创建和迁移 replay 通过。真实 PG 验证不同键并发收敛、原键恢复、同校项目隔离和审计失败回滚密文/收据；构建 HTTP 的并发门禁最初被前一条超限上传遗留 keep-alive 连接干扰，现测试客户端完整排空响应并让故意 413 上传独立关闭连接，随后通过真实账号锁观测两条重叠 POST，未降低数据库并发断言。最终 484/484 常规、348/348 PG、444/444 构建 HTTP、7/7 Linux 通过；schema 为 26 条迁移、17 快照、50 表/694 列/224 约束/170 索引，包摘要 `4e09262ad56ebaf7fea139b0d3f7e44977ccffedfeaa554392439326403f6b24`，Linux 运行镜像 `sha256:e12924e6db4497bc2e124288bd1f837927ad9a0025c287e2881107ecf67c0a78`。没有官方递交政策/分组、费用权益、school application、通知、Agent/学校读取、前端修改或云端发布。

55. `0026_official_submission_policy` 新增不可变政策版本、精确 `school + program + intake` targets 和按显式 `admission_route_key` 管理的 CAS publication 三表。内部 prepare/approve/publish/withdraw 强制 Ops/Admin 正向身份、不同审核者、admin step-up、规则/target/review 摘要绑定和原子审计；最小 reader 逐项复核目标、版本、发布 revision 和摘要，损坏时失败关闭。7 项新业务真库、1 项 through-0025 非空升级及 8 项常规测试通过；HTTP 全套确认没有新增 policy endpoint。首轮真实迁移暴露生成 DDL 在复合外键前尚未创建被引用唯一索引，修正未封存 0026 的依赖顺序并加入静态回归；另修复测试 helper 未接受数据库 `revision` 字段，以及分数断言误匹配时间戳的小概率波动。最终 493/493 常规、356/356 PG、452/452 构建 HTTP、7/7 Linux 通过；schema 为 27 条迁移、18 快照、53 表/732 列/242 约束/178 索引，包摘要 `46ac18d3f2846837ce5e0eee495b3d4257d8dc50538be4d7fcf4c6d74f327a8c`，Linux 运行镜像 `sha256:4ca9efb3d9f31c0a2d97001aab2e5e33077738251aeef429de8016e0ca727c33`。没有默认 route、自动 policy seed、preflight 接线、official group、费用权益、正式提交、Agent/学校访问、前端修改或云端发布。

56. `0027_application_choice_admission_route` 为每个 choice 增加 nullable、无默认/回填/推断的 `admission_route_key`，并把精确政策 reader 接入现有 choice POST/PATCH 与单项目 preflight。非空 route 必须在同一业务事务内匹配当前 active reviewed `program + intake + route` policy；路径变化推进集合 revision、清空旧 requirement snapshot，让旧材料准备证据 stale 而不改写历史。preflight 只读持久化 route，忽略 Header、拒绝 query 覆盖，只返回最小政策 DTO；Billing 与 submit blocker 仍在，`canSubmit=false`。专用 populated through-0026 升级逐字段保留授权、加密快照、政策发布及所有旧列，全部旧 route 保持 null；升级后显式 route、政策解析和 replay no-op 通过。修正九个历史迁移夹具，使其按各自旧 schema 建 choice/收据/审计，不让测试误用 0027 列；生产 repository 未为兼容测试而降级。最终 498/498 常规、362/362 PG、459/459 构建 HTTP、7/7 Linux 通过；schema 为 28 条迁移、19 快照、53 表/733 列/243 约束/179 索引，包摘要 `5d72bdf67932948dd11ac13a7e45f394286c613050feddcd4afccecaee113f0e`，Linux 运行镜像 `sha256:75320f191d7c88460fb6c4303417b48f5c76eef9e1c0a7c8e611f2155e5d82d9`。没有 route/policy-bound authorization v2、官方分组、费用权益、正式提交、Agent/学校访问、前端修改或云端发布。

57. `0028_application_policy_bound_authorization` 为授权表增加 v1/v2 format、choice route、policy version/publication revision 和 document/target-set/approval 摘要，完整形状 CHECK 与精确 policy-version target 复合外键。迁移只把旧行标为 v1，不推断回填 route/policy、不重算 scope、不重写密文快照；默认随后切换 v2，使旧 writer 在迁移后因缺少 policy binding 失败。新授权在同一事务锁住精确 policy publication/version/selected-target 至提交；route 或政策撤回/替换使旧授权和快照 non-current。真库通过同校多项目、route 变化、政策撤回/重发布、null 约束、审计回滚和真实撤回锁等待；HTTP 验证伪造 policy 字段拒绝及内部 approval/target-set 证据不出网。历史 through-0027 升级证明 v1 授权/快照可读但不 current，学生明确重授权后才生成 v2 和新快照。最终 499/499 常规、366/366 PG、463/463 构建 HTTP、7/7 Linux；schema 为 29 条迁移、20 快照、53 表/740 列/245 约束/180 索引，SQL/快照摘要分别为 `ec5a0dbc13bc828e73da6785aea3da299f342d5f1d3b15eef931f02ceaae4d30` / `635e6159e122cd9ad0ef6146ed6e9ad6ab54ace2fe0c6d74fc8f30b19e789a70`，最终发布包为 `2fd17085ec59b1cdef1e79064b425f309c2189d8457a654f4526ddd8d6687749`，Linux 运行镜像为 `sha256:40f8939d89048ffbb3a84b05bb9eb652592563ecbb9f3a8fc08c8da7868149b6`。没有正式分组、费用权益、提交、Agent/学校访问、前端修改或云端发布。

58. `0029_application_fee_entitlement` 将 invoice line 区分历史 v1 与 exact v2；新 application fee line 必须绑定 `user + set + choice + school + program + intake + route`、金额/币种/费用代码和 pricing-basis 摘要，service fee 不能冒充项目权益。内部 Billing service 锁定并复核 invoice、line、payment、success event 和 choice 后，在同一事务写 entitlement 与审计；没有 public/Ops/Agent grant route。真库通过同校两个项目分别生成两条 line/两份 entitlement、完整 choice 集合拒绝、并发 grant 收敛、route 单项目失效、退款 currentness、审计故障回滚及数据库拒绝旧 writer/跨项目证据；HTTP 只返回最小 entitlement 投影。非空 through-0028 升级保留旧 line 为 v1、exact 字段为空且不自动授予，迁移 replay no-op。最终 508/508 常规、370/370 PG、467/467 构建 HTTP、7/7 Linux；schema 为 30 条迁移、21 快照、54 表/778 列/277 约束/192 索引，SQL/快照摘要分别为 `354a0cf62271c0c9b7151519e0b26ab926ba238fa8c5df07a4a202d1c4d090a7` / `b15e7bc991d8be412fbcc496784c8978e960da484f335e05f843b86269a4add6`，最终发布包为 `5c8ca96f9340af629be162441b386746673e4c19344221a7575ae55b53244db3`，Linux 运行镜像为 `sha256:6ee9a0e891d00da7058bdb357c98bca8258e92688857437040321c1fbe6e7676`。没有 official group、正式 submit、真实 provider/refund、Agent/学校访问、前端修改或云端发布。

59. `0030_application_atomic_submission` 新增 `application_submissions`、Program Application v2 evidence、`official_submission_groups`、`official_submission_group_members` 和 `official_submission_outbox`。内部 step-up 学生命令锁定完整 Application Set，在同一数据库时钟复核每个 `student + program + intake + route` 的 requirements、notice、v2 authorization、认证快照和 exact entitlement；随后原子写 submission、逐项目申请、policy-driven groups/members、每组一条 inert outbox、状态、receipt 与 audit，并冻结 set/choices。`one_program_per_form` 下同校两项目形成两申请两组；`multi_program_form` 下仍形成两申请，但只建一个含两个有序成员的 transport group。同键并发收敛，stale evidence 整批拒绝，审计故障不留部分记录。非空 through-0029 升级保留历史 Program Application 为 v1，不推断证据、不创建新对象，旧 writer 失败。最终 514/514 常规、473/473 PG + 构建 HTTP、7/7 Linux；schema 为 31 条迁移、22 快照、58 表/864 列/309 约束/207 索引，SQL/快照摘要分别为 `c20ba118ee9e7f5fe6b75c8b1a95b3d667981b926c2528a4e13b60aa241489fe` / `f401598ac2e07c7af685c68b688f9ec2cb4cac46aab18bff3fcf23508ef88da0`，最终发布包为 `4cf967f076948aa196fb45c007ab879fde09c1ef8a9624db8bfd93cd09056864`，Linux 运行镜像为 `sha256:96eb6141bad03c27ace4a8823ea8fb05ea50b0c018d43fdd78f36392163adcb8`。没有公开 submit、真实 payment/provider、outbox worker、Agent/学校/Ops 写入、前端修改或云端发布。

60. `0031_agent_memory_retention` 不新增表，为 active、无 tenant、student、`low_sensitive_preference` 记忆增加有限创建/到期约束和部分清理索引。新确认使用 PostgreSQL `clock_timestamp()`，期限固定为创建后最多 365 天，调用方不能提供或延长 expiry。非空升级保留 101 条历史 summary、structured payload、来源、ID 和所有其他业务表，只将 null/无限/超长期限收敛到创建后 365 天；更早有限期限保持不变。内部 `sweepExpiredStudentMemories` 每批 1..500，使用 `FOR UPDATE SKIP LOCKED`，仅擦除精确 student namespace 到期正文及安全归属可证明的旧候选副本，并与 metadata-only 审计原子提交；没有 route、Agent tool 或调度器。最终 521/521 常规、475/475 PG + 构建 HTTP、7/7 Linux；schema 为 32 条迁移、23 快照、58 表/864 列/310 约束/208 索引，SQL/快照摘要分别为 `5814d6c114019fe4b38d7c636419a9067ee075d70880459aa89a1a1e1f616661` / `6a72fdba08b71e7ff248eb1d3cc6d7e8c6d6877192a4d6691f98078383d34ef4`，最终发布包为 `07c1f88cd024ee217690d66deb5ba01aeb9ecd51e5f046be1f1d76c792fd81d4`，Linux 运行镜像为 `sha256:98bbf1c988ba3402d34ba296ad478542b1099216ac15fd00cd0cb7fec10a107d`。本地持久库 31 before / 1 now / 32 total，health 与逐项目 smoke 通过；没有生产长期记忆、自动调度、前端修改或云端发布。

61. `0032_agent_candidate_capacity` 不新增表或列，只为 guest/student active pending candidates 增加两个精确 scope 的部分索引。服务端初始上限为每个签名 guest 浏览器绑定 12 条、每个 student 账号/namespace 24 条；只计未擦除、`proposed`、有限且未到期的精确 owner 记录。创建先在同一事务按 `guest:` 或 `student:` namespace 获取 advisory lock，再用第二个 statement 的新 READ COMMITTED snapshot 计数并插入，避免等待锁的单 statement 保留旧 MVCC snapshot 而双穿最后名额。真库最后一格并发严格 1 成功/1 个 429，其他浏览器/账号与过期候选均独立；构建 HTTP 验证响应和拒绝审计不泄露正文。最终 523/523 常规、379/379 专用 PG、477/477 PG + 构建 HTTP、7/7 Linux；schema 为 33 条迁移、24 快照、58 表/864 列/310 约束/210 索引。SQL/快照摘要分别为 `3ec80be7f5fb440eccc457da94cc4c406f85c398f65cf84593b8ececc3121ad9` / `cde55939b6190ecd0c449a4c992e1f3ba9cac39285364456335fcd004a80bf38`，最终发布包为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`，Linux 运行镜像为 `sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`。本地持久库 32 before / 1 now / 33 total，health 与逐项目 smoke 通过；没有完整 Agent、生产长期记忆、自动调度、前端修改或云端发布。

## 4. 迁移注意

0032 只增加候选容量扫描索引，但容量安全依赖新 writer 的同事务两段式 advisory lock + count/insert。部署时必须暂停并排空旧候选 writer，先执行迁移，再整体切换新 writer；不能让无事务直接 repository 调用或旧无限制实例与新实例混跑。回退时先关闭候选创建，保留索引和历史记录，不以删除候选绕过容量。生产 WAF/滥用控制与清理调度仍须独立审批。详见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)。

0031 强制学生低敏记忆有限期限。发布前暂停并排空候选确认/记忆控制 writer，完成备份恢复点并审查非法创建时间；迁移后整体切换使用数据库时钟的有限期 writer。旧 null/无限/超长期限只收敛 expiry 元数据，不改正文；旧 writer 不能继续写 null 期限。回退关闭相关写入和维护任务并保留 expiry、约束、索引及墓碑，不删除约束或恢复已擦除正文。生产清理调度须单独审批、监控和演练。详见 [记忆保留合同](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md)。

0030 新增内部原子接收和 Program Application v2。发布前暂停并排空 application set/choice、authorization/snapshot/Billing entitlement 和旧 school-application writer；迁移后整体切换完整 v2 writer 与内部 submission service。旧 writer 会因默认 v2 但缺少完整 evidence 被 CHECK 拒绝，不能混跑。迁移保留历史 v1 行，不从当前系统事实批量补证据。回退须关闭新内部接收和 outbox 消费，保留全部 submission/group/evidence 历史，不删除 pending 记录、不把 accepted/pending 改称学校已收件。详见 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)。

0029 扩展 Billing exact identity 并新增逐项目 entitlement。发布前暂停并排空旧 Billing writer、checkout、payment-state worker 与 preflight reader，迁移后整体切换 v2 line writer、内部 entitlement currentness 和新 preflight projection；旧 writer 会因新默认 v2 但缺少完整 target/pricing 字段而被 CHECK 拒绝，不能混跑。迁移保留历史 v1 line 原字节和 null exact 字段，不从 metadata/当前 choice 推断、不自动授予。回退关闭新写入/读取并保留所有列、外键和 entitlement 历史，不放宽默认或批量补证据。详见 [逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)。

0028 扩展逐项目授权证据。发布前暂停并排空 choice/authorization/snapshot/preflight 相关实例，迁移后整体切换 v2 writer、policy-aware snapshot 与 preflight；旧 writer 会因新默认 v2 但缺少完整 policy 字段而被 CHECK 拒绝，不能混跑。迁移保留 v1 授权/快照原字节和 scope，不从当前 route/policy 推断回填；v1 永远 non-current。回退关闭新写入并保留所有列、外键及 v1/v2 历史，不改默认绕过护栏、不批量补证据。详见 [政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)。

0027 新增 choice 的 nullable 招生路径列、约束和部分索引。发布前暂停并排空 choice writers 与 preflight readers，迁移后整体切换 route-aware create/edit/read 和精确政策 preflight；旧实例可能丢字段、使用旧摘要或漏掉 revision 失效，不能混跑。回退关闭 route 写入和政策-aware preflight，保留新列及已显式选择的值；不删、不默认、不批量填充，也不把学校级表单当申请身份。详见 [招生路径合同](CUAC_APPLICATION_ADMISSION_ROUTE_CONTRACT.md)。

此前 0026 新增官方递交政策三表，旧 choice、目录、授权、材料快照、收据、学生资料和邮件任务不改写，且不自动生成政策或默认招生路径。发布前暂停任何未来的内部 policy writer；当前没有管理 HTTP writer。0026 迁移后整体切换内部 governance 和 reader，0027 再显式接入 preflight；仍不开放公开政策 HTTP 或 Agent。回退关闭内部能力并保留版本、target、publication 和审计证据，不删历史、不 seed 猜测规则，也不把 policy publication 当学校收件。详见 [官方递交政策与分组合同](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md)。

0025 新增逐项目认证材料快照表并扩展申请命令收据操作约束；旧 choice、选择、授权、收据、学生资料和邮件任务不改写，不自动生成快照。发布前暂停并排空 choice/material-selection/authorization/snapshot 写入者，迁移后整体切换快照服务、敏感命令账号锁与 preflight reader；旧代码不能和已有快照写入混跑。回退关闭新路由并保留密文、收据、key 引用和约束，不删历史、不丢弃仍需的旧 key，也不把快照当学校收件。详见 [材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)。

此前 0024 新增逐项目授权证据表并扩展申请命令收据操作约束；旧 choice、选择、收据、学生资料和邮件任务不改写，不自动生成授权。发布前暂停并排空 choice/material-selection/authorization 写入者，迁移后整体切换授权、choice 移除与 preflight reader；旧移除代码不能和已有 active 授权混跑。回退关闭新路由并保留证据表/收据/约束，不删历史或把授权当学校收件。详见 [逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)。

此前 0023 先增加 challenge 的 (id,user_id) 唯一索引，再增加邮件队列复合外键；旧数据和 hash-only proof 不变，新表为空。迁移后保持投递关闭，待动作页面、密钥和提供方/Worker 验收后显式启用。暂停 Worker 和新入队配置可停止新投递，但不能召回已受理邮件；结果不明任务禁止盲目重发，不能删队列表或回退到事务内发送。

此前 0022 新增材料选择表。发布前暂停并排空旧 choice 移除写入者，迁移后整体切换选择与关联清理服务；旧移除代码会漏掉新选择，不能混跑。回退关闭受影响保存/移除入口并保留表、版本及约束，不自动删选择或生成授权，详见 [材料选择合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)。

前序 `0021_student_memory_control_revision.sql` 只新增记忆设置 revision（默认 1、正整数）。旧开关、reset_at 和所有正文保持，缺失设置不创建，101 条旧记忆仍可浏览。部署先暂停/排空旧记忆写入者，迁移后整体切换到版本、角色锁及容量感知的新管理/确认服务，不能新旧写入者混跑；回退关闭相关写入并保留新列。详见 [记忆管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md)。

新增：`frontend/drizzle/pg/0007_school_invite_pending_unique.sql`。

约束：同一个 `school_id + email_normalized`，最多一条 `status = pending` 且未接受、未撤销的邀请。过期但仍为 pending 的行也占用该唯一位置，后续创建会先撤销它。

如果历史数据库已经有重复 pending invite，这个迁移会失败。需要通过受控流程审查邀请、处理重复记录后再重跑；迁移不自动删记录或撤销邀请。不要为通过迁移而关闭唯一约束。

新增：`frontend/drizzle/pg/0008_application_scope_integrity.sql`，约束 choice 的集合/学生、program 的学校，以及 school application 的 choice/集合/学生/学校组合。遇到历史错配记录同样失败，不自动改学生或 tenant ID；先受控审查，再补正迁移。这个关系约束不是数据库 RLS，也不赋予任何新访问权限。

历史已执行迁移保持不变。手写增量至 `0011` 已完成 Drizzle 快照与真库结构核对；当前快照链为 `0000 -> 0001 -> 0011 -> 0012 ... -> 0032`。自 0012 起不允许快照缺口，每次变更仍须审查新 SQL、运行 `db:pg:schema:check` 和真库演练，不能把本次检查点当作未来所有变更已批准。

此前 `0010_agent_memory_controls.sql` 增加账号开关/清除时间点、候选 payload_cleared_at 与清理索引，不自动擦除历史正文。`0011_student_application_commands.sql` 仅增加申请命令收据及唯一/检查约束，该阶段共 12 个迁移。先前 0009 的来源唯一性继续保留。业务与收据必须同点备份恢复；不能仅删除收据后接受迟到重试。初次快照和执行器改进本身未增加 SQL；后续 `0012_application_draft_revision.sql` 才使总数变为 13。ledger 核验在本地连接测试中通过，但尚未连接阿里云验证。

`0012` 使旧集合 revision 默认为 1，并限制正整数。新接口上线前必须先迁移、部署所有会推进版本的草稿写入口并排空旧实例/脚本，不能混跑不推进版本的旧写入；回退须暂停相关写入，保留新增列及已有版本。完整顺序见 [提交合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md) 与 [迁移 runbook](CUAC_POSTGRES_MIGRATION_RUNBOOK.md)。

`0020` 升级先锁定两张申请表，发现旧记录的项目不一致即停止并回滚，不猜测修复。仅从既有 choice 复制已明确批次；所有既有列值保留，新增生成键约束当前目标关系。部署前暂停并排空写入者，真实 staging 另验证表重写、索引、WAL/磁盘与锁等待预算；旧脚本不得继续省略已绑定批次。回退暂停相关入口，保留新列/约束，不放开错项目写入；详见 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。

## 5. 下一步与边界

截至 `0045_ops_catalog_quality_reviews.sql` 当前共 46 条迁移、72 表；稳定 CUAC external application reference、授权绑定的限时 Ops 支持会话、账号范围通知核心、隔离支付事件双人复核、隔离官方递交 outbox 复核与四类目录来源质量复核已完成。学生申请、私有文件、学校工作流、官方递交、hosted payment/退款结果对账、密码 step-up、公开原子 submit 和站内通知后端均已有本地证据。公开返回固定区分 `accepted + cuac_internal`，不代表法律充分、真实收费、高校已收件或外部消息已投递。下一步推进真实来源/文案/价格、学校纠错与通用目录编辑、自动 freshness 调度、route/payload 受控修复、退款补偿、前端接线，以及邮件/OSS/学校/商户的阿里云 staging 闭环；Agent 在这些稳定项目能力之上继续完善。见 [CUAC 申请编号合同](CUAC_APPLICATION_REFERENCE_CONTRACT.md)、[Ops 支持访问合同](CUAC_OPS_APPLICATION_SUPPORT_CONTRACT.md)、[Ops 账务复核合同](CUAC_OPS_BILLING_REVIEW_CONTRACT.md)、[Ops 路由复核合同](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md)、[Ops 数据质量复核合同](CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md)、[通知投递合同](CUAC_NOTIFICATION_DELIVERY_CONTRACT.md)、[密码二次验证与公开提交合同](CUAC_AUTH_STEP_UP_AND_PUBLIC_SUBMISSION_CONTRACT.md)、[支付与对账合同](CUAC_HOSTED_PAYMENT_AND_RECONCILIATION_CONTRACT.md)、[原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md) 与 [迁移 runbook](CUAC_POSTGRES_MIGRATION_RUNBOOK.md)。

`0038` 封存证据：常规后端、TypeScript 和生产构建通过；`db:pg:rehearse` 为 398/398；带真实构建服务的 `db:http:rehearse` 为 497/497。真库结构为 961 列、341 个约束、236 个索引。SQL/快照摘要分别为 `eebf9055a1d480fce4d130ad82aa23b069afb5d9d141a4fa12e1c563fb67efd8` / `585504fc2c2f592286c477c124b1835f793918a8d11f3a187790372e39128214`，detached release 为 `d834652cb7d4df5f459131a2143ed37ea74c802f847140cc80da1636937dc8cf`。全部一次性数据库与 HTTP 子进程已清理。

`0039` 封存证据：两次完整 `db:pg:rehearse` 均为 399/399，第二次同时封存基线；`db:http:rehearse` 为 498/498。真库结构为 970 列、350 个约束、242 个索引。并发 12 路编号、历史回填、invoice 快照、v2 学校必填、错误编号复合外键及生产构建 API 均通过 PostgreSQL 16.13。SQL/快照摘要分别为 `8b166104adf7674881e2374498938751402ffd55468c782704d2f1617a516eee` / `ff6c0920b50851b23501de4764b58fca44b527aaac050aa3d32e6398f9b3edbf`，detached release 为 `8e39e51c3aae5e8456f14e68a0e98e8631fa722ddbd0c699029aca4b6d92922a`。一次性数据库和 HTTP 服务均已清理。

`0040` 封存证据：聚焦测试 47/47、全量后端和 TypeScript 通过；`db:http:rehearse` 为 501/501，封存 `db:pg:rehearse -- --write-schema-baseline` 为 401/401。真库结构为 64 表、970 列、356 个约束、244 个索引；迁移总数 41、快照 32。真实 Cookie 会话、角色匹配的限时员工授权、精确 CUAC ID、最小申请状态投影、固定 reason、事务审计、撤权后拒绝、重复/不完整授权数据库拒绝均通过 PostgreSQL 16.13。SQL/快照摘要分别为 `978471a696463363badd4c18e189d452e7e0076aeebc039c68c9d41e59751ac1` / `dce9ad52db50dce04926bd361bfa7b07dbdc4ced8ffaa29e657e43c197872c20`，封存后的 detached release 为 `5a9b787faf9c987ba2b17752ee8990847b13ac9b4a6a621e840735bce916d614`。一次性数据库和 HTTP 服务均已清理；未编辑产品前端、未开放 Agent 工具，也不代表真实 Ops IdP/MFA 或云端验收。详见 [Ops 申请支持查询合同](CUAC_OPS_APPLICATION_SUPPORT_CONTRACT.md)。

`0041` 封存证据：全量后端 661/661、迁移/快照 35/35、真实 PostgreSQL 403/403、构建 HTTP 503/503，TypeScript 通过。真库结构为 65 表、981 列、363 个约束、248 个索引；迁移总数 42、快照 33。支持会话最长 15 分钟并受原员工授权到期约束，精确绑定 actor、role、grant、Application Set 与 CUAC ID；创建、读取和关闭均事务内重锁当前授权，真实并发证明授权撤销等待正在提交的审计读取，随后旧会话被拒绝。演练先后暴露并修复 PostgreSQL 关键字 CTE 名冲突及审计 PAN 脱敏误判 canonical UUID。SQL/快照摘要分别为 `2acbf25209b18a594d005a6becd11dcd3d3ffa5f62eb79c59b7d04841ecb73f2` / `8fe3f42ec2710b7b05a5fd28bcdc0eef7ded7b5963db53f8c7d26f12d1da87f4`，schema baseline 摘要为 `c2f4bb0598737a6fe608761cde4fc8e833fd9698a233ad00d57f054a8296ee8c`，detached release 为 `d1b2a7950f59434bfe56bce1cf217c7da18fbac8308e8dd0d5d7d830ef2664d9`。未编辑产品前端、未开放 Agent 工具，也不代表完整 Ops 岗位权限/写流程、真实 IdP/MFA 或云端验收。

`0041` 后续本地运行证据（不新增迁移或变更封存包）：密码登录已从只生成 student session 扩展为请求 student、school_staff 或 cuac_internal 表面，并在同一事务内按当前角色、精确学校 membership/学校状态或匹配的已批准员工授权推导最终 persona。持久化本地运行器现生成三类 `.invalid` 合成账号、学校队列申请和 Ops 授权，自动处理非 CUAC 端口占用且不终止外部进程；真实 API smoke 覆盖 public catalog、学生登录/申请、学校登录/队列和 Ops 支持会话打开/查询/关闭。最终全量后端 666/666、TypeScript、真实 PostgreSQL 404/404 和生产构建 HTTP 505/505 通过；结构仍为 65 表、981 列、363 个约束、248 个索引，detached release 仍为 `d1b2a7950f59434bfe56bce1cf217c7da18fbac8308e8dd0d5d7d830ef2664d9`。HTTP 总门禁按实际完整套件耗时保留 8 分钟上限；所有一次性容器与服务已清理。

`0042` 封存证据：新增通知偏好、审核模板、事件和投递四表，学校状态变更与状态事件、学生通知及 metadata-only 审计原子提交。API 固定当前 persona 范围，支持 cursor 分页、单项/全部已读与按 topic revision 更新偏好；`account_security` 的站内和邮件通道不可关闭。外部 worker 只处理已提交任务，稳定 delivery ID，明确拒绝有限退避，未知结果终态隔离，超过次数进入 dead-letter。最终全量后端 680/680、TypeScript、真实 PostgreSQL + 生产构建 HTTP 510/510 通过；结构为 69 表、1048 列、386 个约束、264 个索引，detached release 为 `161acf06e323e3b9f554cba56f1e2c134651414b8dc6a6eb027364fa3266abf8`。随后持久本地库从 42 升至 43 条迁移并通过扩展 smoke：学生申请/通知/6 项安全偏好、学校队列和 Ops 支持会话均经真实 API 验证。没有真实邮件/SMS、调度器或阿里云验收；本轮未编辑产品前端页面。

`0042` 后续通知运行证据（不新增迁移或改变上述封存包）：新增独立 `CUAC_NOTIFICATION_*` 配置族、固定区域到 SMTP 主机映射、TLS 1.2+ 与证书校验、确定性 Message-ID、同源 action URL、HTML/头注入防护、提供方接受/明确拒绝/未知结果映射、常驻恢复/批处理循环及单独受监管启动入口。staging/production 离线门禁现拒绝 disabled、任意 provider、缺失配置和未同时确认 supervision/staging acceptance；两个环境模板仍默认 disabled。学校状态、CUAC 接受提交和支付成功/取消/退款现均在各自业务事务中发布最小通知；提交文案明确未发生学校收件，支付通知不保存金额、提供方引用或支付凭据。通知专项 24/24、完整后端 693/693、真实 PostgreSQL + 生产构建 HTTP 510/510、TypeScript、聚焦 ESLint 和生产构建通过；无配置启动在打开 PostgreSQL 或 SMTP 前以脱敏错误退出 1。真实邮件未发送，真实提供方投递/退信和云端监督仍待按 [通知 Worker runbook](CUAC_NOTIFICATION_WORKER_RUNBOOK.md) 验收。

`0042` 后续 Ops 运营监控证据（不新增迁移或改变上述封存包）：新增固定注册表 `cuac.ops-operations-registry.v1` 和私有 `GET /api/v1/ops/operations/summary`。一个受代码控制的 SQL 使用同一数据库时钟聚合账号邮件、通用通知、学生文件、官方递交及支付对账五队列；不接受动态指标、时间窗、筛选或 SQL。生产 repository 在读取前重锁当前员工授权，service 严格验证五行顺序、计数和时刻并在损坏时以脱敏 503 失败关闭；审计失败时不返回摘要。最终 Ops 监控专项 8/8、全量后端 702/702、真实 PostgreSQL 407/407、生产构建 HTTP 513/513、TypeScript 和聚焦 ESLint 通过。持久本地运行器随后在 `http://127.0.0.1:53855` 通过扩展 smoke：三角色、五队列摘要、申请/通知/偏好、学校队列和 Ops 支持会话均经真实 API 验证；端口仍以每次启动输出为准。结构保持 43 条迁移、69 表、1048 列、386 个约束和 264 个索引，detached release 仍为 `161acf06e323e3b9f554cba56f1e2c134651414b8dc6a6eb027364fa3266abf8`。一次性演练容器已删除，持久本地服务保留运行；未编辑产品前端页面。

`0042` 后续 Ops 目录要求治理证据（不新增迁移或改变上述封存包）：把既有要求治理事务服务接入六个私有 HTTP 能力，program/intake/version 只由路由决定，列表只接受严格正整数游标。`cuac_ops` 可读取/起草；审批、发布和撤回收紧为 `cuac_admin + step_up`，且起草人不能自审。Auth step-up 同时扩展为保留 student、school 或 Ops 当前 persona，并在最终事务重锁 live role/membership/grant；真实 PostgreSQL 验证 Ops grant 撤销后拒绝。最终定向 11/11、全量后端 706/706、真实 PostgreSQL 408/408、生产构建 HTTP 515/515、TypeScript、聚焦 ESLint及持久本地 smoke 通过。HTTP 网络场景完整覆盖起草、普通管理员会话拒绝、密码 step-up、双人审批、发布、公开读取、防 body 身份注入、撤回、metadata-only audit 和授权撤销。结构及 detached release 不变；未编辑产品前端页面，也未向 Agent 注册治理工具。详见 [Ops 目录要求治理合同](CUAC_OPS_REQUIREMENT_GOVERNANCE_API_CONTRACT.md)。

`0043` 封存证据：新增 `ops_payment_event_reviews`，每个隔离 provider event 唯一，认领绑定精确员工 grant；升级仅允许当前认领人，关闭仅允许不同的 `cuac_admin + step_up`，并以 revision CAS 与数据库 lifecycle check 阻止并发覆盖和职责合并。四个私有 HTTP 路由只接受 route event UUID、固定代码和有限 ASCII evidence reference；列表不返回 payload hash、provider payment/session ID 或 grant ID。关闭状态固定为 `resolved_no_change`，不改变 provider event、payment、invoice 或 entitlement，不提供重放、人工结算或退款发起。专项 11/11、全量后端 718/718、真实 PostgreSQL 411/411、生产构建 HTTP 519/519、TypeScript、聚焦 ESLint及持久本地 smoke 通过。结构为 44 条迁移、35 份快照、70 表、1066 列、394 个约束、268 个索引；detached release 为 `5a4b6d399cca251b02d39c414731bd29ccf0692b0ef88f0f293b53b4bd40e306`。持久本地库从 43 升至 44，应用在 `http://127.0.0.1:53129` 通过三角色及账务复核队列 smoke；端口仍以每次启动输出为准。本轮未编辑产品前端页面，也未向 Agent 注册账务能力。详见 [Ops 账务复核合同](CUAC_OPS_BILLING_REVIEW_CONTRACT.md)。

`0044` 封存证据：新增 `ops_submission_delivery_reviews`，以 outbox 和微秒级 `source_quarantined_at` 唯一绑定每个隔离 generation。认领绑定精确员工 grant，升级仅允许当前认领人，关闭或重试仅允许不同的 `cuac_admin + step_up`。`unknown` 和 `invalid_payload` 不可重试；只有无 receipt 的 `attempt_limit + ATTEMPT_LIMIT + 5` generation 可原子恢复原 outbox/group 为 pending，且每个 outbox 终身最多一次人工批准，不改变 provider/payload、申请或 route 绑定。真库演练曾暴露 JavaScript Date 毫秒精度无法回传比较 PostgreSQL 微秒时间，已改为在同一 SQL 内比较 review 与锁定 outbox generation 后复验。专项 12/12、全量后端 732/732、聚焦真实 PostgreSQL 3/3、生产构建 HTTP 522/522、TypeScript、聚焦 ESLint及持久本地 smoke 通过。结构为 45 条迁移、36 份快照、71 表、1088 列、402 个约束、273 个索引；detached release 为 `114bf612ee84ff1b4cceed731c3802ffa703fa3dfbc1670c4cfebd53d2456f65`。持久本地库从 44 升至 45，应用在 `http://127.0.0.1:52118` 通过三角色、五队列 summary、账务与路由复核队列 smoke；端口仍以每次启动输出为准。本轮未编辑产品前端页面，也未向 Agent 注册路由能力。详见 [Ops 路由复核合同](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md)。

`0045` 封存证据：新增 `ops_catalog_quality_reviews`、四类目录实体 verifier/next-review 字段及 source-evidence 复合身份。当前队列从数据库时钟、实体核验状态和最新 evidence 推导六类固定问题；review 绑定精确 entity/evidence generation，认领和升级受当前员工 grant 约束，最终处置要求不同的 `cuac_admin + step_up`。确认来源原子更新实体 verified 元数据并强制 30 至 366 天复核期限；争议/无效清除核验元数据；无来源只允许无变更关闭。审计失败、授权撤销、旧 revision、旧 generation 和直接 SQL 生命周期绕过均失败关闭。专项 12/12、全量后端 746/746、聚焦真实 PostgreSQL 3/3、生产构建 HTTP 525/525、TypeScript 与聚焦 ESLint通过。结构为 46 条迁移、37 份快照、72 表、1121 列、416 个约束、278 个索引；baseline 已从历史 `0041` 积压按显式 4-migration 精确声明封存到 `0045`，默认封存仍只允许一个迁移。最终 detached release 为 `c9527e5cd654e27182ef38e323e8bb9c41b54f8564dad767e04b8713fca3ea80`。第一次生产 HTTP 回归与正在运行的 Vinext dev 共用构建目录而受污染；停止 dev 后隔离重跑 525/525 通过。持久本地库从 45 升至 46，应用在 `http://127.0.0.1:52118` 通过三角色、申请、通知、五队列、目录治理、账务、路由、数据质量 8 项队列和 Ops 支持 smoke。本轮未编辑产品前端页面，也未向 Agent 注册数据质量能力。详见 [Ops 数据质量复核合同](CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md)。

1. 两个学生、两个学校、两个老师、CUAC role 与 guest 的隔离用例已落地，学校状态/contact 工作流及三角色本地密码登录已有真实 PostgreSQL/构建 HTTP 证据；真实学校身份、Ops 完整工作流和云上 HTTP smoke 仍待补齐。
2. 当前 Auth/学生/Agent 输入和事务、owner-scoped pending capacity、记忆管理/候选及到期清理服务、有限保留及两个申请命令幂等通过本地回归。下一步对齐控制 UX/API、Gateway/WAF 滥用与模型预算控制、生产调度/监控、备份删除与在途撤权，继续 Auth 等命令的结果恢复、收据保留/限额、生产凭据、浏览器和阿里云验收。
3. BE-0713 本地 schema、执行保护、独立发布包和非 root/只读 Linux 运行已通过，见 [Linux 运行合同](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md)。下一步接可信 CI/签名、补丁审查和云端运行保护，补领域回填和 RDS 恢复。BE-0714 本地连接、网络恢复、受控排空/期限及 Linux OS 信号已通过，见 [应用生命周期合同](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md)；完整云端应用/信号/负载均衡、监控、独立 liveness、实际 TLS/连接预算和 RDS 切换仍待验证。
4. 阿里云 staging RDS 按迁移 runbook 演练：TLS、最小权限账号、云上迁移、真实 HTTP smoke、备份恢复和回滚。当前本地结果不能替代此项。
5. 外部邮件、真实商户支付、OSS/ClamAV、真实学校接收方、学校纠错/通用目录编辑、自动 freshness 调度、route/payload 受控修复、退款补偿和完整 Agent 仍按生产计划分阶段接入与验收。

当前 Student/Auth、Agent 确认、pending capacity、记忆管理、候选清理和到期记忆清理批次均有事务审计证据；两个申请命令另有幂等与断连恢复证据。候选容量、记忆控制与有限保留已本地验收但未接完整前端或生产；控制 UX、Gateway/WAF 滥用控制、调度/监控、备份删除、在途权限变化、其他命令幂等和外部副作用 outbox 仍需验收。

前端仍由用户调整。本轮未编辑 `design-lab/home-v3.html`、学生 Hub、申请中心或其他前端页面；产品基准仍仅为用户指定的 V3 demo。

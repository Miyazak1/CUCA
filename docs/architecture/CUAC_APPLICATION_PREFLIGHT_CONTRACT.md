# CUAC 逐项目提交前检查合同

日期：2026-09-01。学生本人、单个项目选择的只读准备报告现已接入逐项目披露授权、认证材料快照、显式招生路径、精确官方递交政策及逐项目费用权益的最小状态；不创建收费、不实现正式分组或正式提交，不修改前端。

## 1. 目的与范围

GET /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/preflight?locale=en

每次仅检查一个属于当前学生的 choice，保留学校、项目及具体入学批次身份。同校项目不合并；不依据学校名称、项目名称或申请组 targetIntake 文案猜测目标。locale 必填且仅支持 en/zh-CN，未知或重复查询参数拒绝，不允许客户端指定身份、时间、资料版本、已同意或已付费。

报告包括当前集合 revision、数据库 checkedAt、目标及窗口、choice 中持久化的 `admissionRouteKey`、基本资料缺项和独立资料版本/记录数量、已发布要求及告知的版本引用、最新逐项目授权的 `{ id, status, confirmedAt, current }` 最小投影、最新材料快照的 `{ id, authorizationId, capturedAt, current }` 最小投影、精确当前政策的最小投影、逐项目费用权益的 `{ id, status, grantedAt, expiresAt, current }` 最小投影、项目问题和平台尚未完成的提交门槛。政策最小投影只含版本、publication revision、document SHA-256、form/ordering/channel 模式和审核时效，不含内部来源正文、准备者/审核者身份或 review evidence。报告也不含姓名、邮箱、国籍值、教育/考试正文、选择 JSON、材料摘要、密文/envelope、密钥信息、私有备注、invoice/payment/provider 证据或其他选择。空教育/考试集合只是准备信息，不自动等于不符合项目资格；记录存在也不等于成绩有效或官方核验。响应 no-store，不签发 Cookie；浏览器 Fetch Metadata 仅接受 same-origin/none 或缺省，明确的跨源读取在查 session 前拒绝，不能以此代替浏览器 SameSite、TLS 和 CORS 验收。

## 2. 权限与一致性

仅当前 student 角色、student surface、student_action purpose、session/step_up、无学校 tenant，且具有 student_pii、education_record、public_catalog、public_notice、payment_business 分类权限可以访问。身份来自服务端 session，数据库另核验 active 账号、未撤销 student grant、父集合归属及精确 choice 关系；跨账号、错误父组、不存在或已移除选择统一脱敏 403。

所有领域读取在独立 REPEATABLE READ READ ONLY 事务中进行。第一次数据库读取固定毫秒精度 checkedAt 与 MVCC 快照，后续资料、目录要求、告知及窗口判断使用同一快照/时刻；数据库禁止该事务修改业务表。要求和告知读取的内部 snapshotTime 只来自该数据库时钟，公开接口不能传入。请求开始后的变更在下一次检查中可见，不声称这会撤销所有在途读取。报告不锁定资料或保留名额，任何未来提交都必须重新核验权限、版本、时钟及状态。事务语义见 [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/16/sql-set-transaction.html)。

学校/项目必须 active，批次必须匹配项目且 open。明确完整窗口按 opensAt <= checkedAt < deadlineAt 判断；未来开放、已过期、未知或矛盾窗口分开报告。仅 open 状态或仅有截止日都不等于允许递交。奖学金选择必须仍在有效范围；已有学校申请记录及同一学生其他集合的相同目标收件需要进一步处理，不自动视为可重复投递，也不推断高校实际已收件。

要求与告知复用既有发布指针、内容/审核绑定和时效校验，无旧版本或语言回退；损坏已发布数据返回脱敏 503，不能吞掉错误当成“未填写”。要求仅 information_only，逐条返回稳定 key、类别、阶段、required/conditional/recommended 及 unassessed，不解析自然语言或伪造满足情况。告知只返回指定语言的版本引用；可读不代表学生授权。授权 `current` 还要求 active v2、精确学校/项目/批次/choice route、材料选择及四个来源版本/内容仍一致、同语言告知发布指针及摘要仍一致，并与 preflight 独立验证的精确当前政策 version/publication/document/target-set/approval 绑定完全相同；草稿须可编辑、窗口开放且尚无学校收件。v1 永远不 current，任一变化只让证据失效，不改写历史行。

## 3. 不可越过的边界

当前固定 `assessmentMode=preparation_only`、`canSubmit=false`。平台阻塞项包括逐项目授权、最小材料快照、招生路径/正式投递政策、费用权益及提交服务。没有当前授权时返回 `SUBMISSION_AUTHORIZATION_UNAVAILABLE`；精确 active/current 授权只移除这一项。只有最新快照完成 GCM 认证、payload/目标重建且对应授权仍 current，才移除 `MATERIAL_SNAPSHOT_UNAVAILABLE`。未选路径返回 `ADMISSION_ROUTE_REQUIRED`；只有 choice 中持久化的 route 对应精确 `program + intake + route` 的 current、active、审核及时且摘要完整政策，才移除 `OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE`。只有与该 choice 的学生、集合、学校、项目、批次、route、金额、币种及 pricing basis 完全一致，且来源 invoice/payment/success event 仍有效的 current entitlement，才移除 `BILLING_ENTITLEMENT_UNAVAILABLE`；同校兄弟项目不能共享。`SUBMISSION_UNAVAILABLE` 始终保留，因此不会提前放行正式提交。前端、query/header 或 Agent 都不得覆盖这些权威状态。基本资料缺项只是当前申请资料字段的准备提示，不宣称所有高校要求完全一致。

preflight 本身无写操作、操作收据、成功写审计、Cookie 签发、申请冻结、学校收件、outbox 或 Agent 工具。它读取 `application_submission_authorizations` 的受限元数据投影，在服务端验证最新 `application_material_snapshots` 的认证密文和精确目标，从 choice 的持久化 route 解析精确官方政策，并只通过受限 Billing reader 读取 exact entitlement 的状态和 currentness；不接受客户端提供 route，也不把解密正文、选择、target-set/approval 摘要、政策内部证据、invoice/payment/event 或 provider 数据返回客户端。它不会读取旧 `consent_summary_json`、`profileCompletion`、要求快照、原始支付信息或聊天内容来解除门槛。后续正式分组和提交服务必须各自接入权威记录，不能用环境开关直接把 `canSubmit` 改为 true。

## 4. 验收与推进

验证本人/角色/用途/tenant/分类、同校项目和批次隔离、缺失目标、冻结及现有收件、目录/窗口/奖学金变化、资料版本和数量、损坏发布失败关闭、明确的 READ ONLY 保护、跨查询一致快照以及真实构建路由。全表快照确认检查不写业务、同意或审计；错误响应不含原始数据。

授权基础由 `0024_application_submission_authorization` 提供，认证材料快照由 `0025_application_material_snapshot` 提供，route-explicit 政策治理由 `0026_official_submission_policy` 提供，choice 的显式路径与 preflight 接入由 `0027_application_choice_admission_route` 提供，route/policy-bound authorization v2 由 `0028_application_policy_bound_authorization` 提供，逐项目费用权益由 `0029_application_fee_entitlement` 提供；preflight 仍是纯读取。既有 choice 不设默认、不回填、不推断路径；历史账单行不猜测补成 v2，也不自动产生 entitlement。精确政策、精确 v2 授权与 exact current entitlement 分别只移除自己的 blocker。真实文案、首批年龄范围/监护流程、跨境路径、保留期限、撤回后处理、首发 route 发布数据及生产价格/退款规则仍待审核配置。下一步补正式分组，再设计原子 submit/receipt/audit/outbox。生产进度见 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)，结果见 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

当前全量本地验收：`test:server` 523/523、真实 PostgreSQL + 构建后 HTTP 477/477、Linux 迁移 7/7。schema 为 33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引。preflight 仍固定 `canSubmit=false`，因为 `0030` 的接收 service 是内部能力，没有公开 submit route；`0031` 的记忆保留和 `0032` 的候选容量不改变此边界。演练临时资源已清理；另有只含纯合成 fixture 的持久开发卷和 Node API 正在本机回环运行。不是 V3 完整页面联调、法律结论、真实支付或阿里云上线验收。

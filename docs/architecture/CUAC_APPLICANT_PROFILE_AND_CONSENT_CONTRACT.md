# CUAC 申请资料、同意与提交快照合同

日期：2026-09-01。范围：BE-0716 的申请准备流程。本文区分已实现的基本资料、逐项目披露授权证据和认证材料快照，与尚未开放的官方递交策略、费用权益及正式提交；技术授权和加密快照都不构成法律合规、学校收件或生产上线证明。

## 1. 稳定边界

- `student_profiles` 继续保存展示昵称和选校偏好，不当作高校申请表；其 completion/consent JSON 不是提交许可。
- `student_applicant_profiles` 是本人编辑的申请基本资料，一名学生一条，拥有独立 revision。它不是 Agent 记忆、学校收件或已核验身份。
- 每个项目正式接收的材料将是独立白名单快照，不实时读取全局资料。修改基本资料不能覆盖已提交材料，不能隐式向学校发补件。
- 同意不是账户上的一个永久布尔值。后续记录必须绑定明确目的、告知版本、接收学校/项目、字段范围和提交版本；新增接收方或扩大范围必须重新确认。
- 原始材料、护照、出生日期、支付信息和完整对话不属于本轮基本资料。Agent 不获得新工具或原始资料访问权限。

## 2. 本批基本资料接口

`GET /api/v1/student/applicant-profile`

返回 `200 { data: null }` 表示当前学生尚未创建资料；否则只返回 id、userId、revision、fullName、contactEmail、citizenshipCountry。未配置 repository 返回 503，不伪装成空资料。

`PATCH /api/v1/student/applicant-profile`

JSON 必须包含 expectedRevision 和至少一个可编辑字段：

| 字段 | 约定 |
| --- | --- |
| fullName | 本人填写的申请姓名，最多 200 个 UTF-16 code units；保留 Unicode 和姓名顺序，不根据昵称猜测，不擅自拆分姓/名，不代表护照核验 |
| contactEmail | 复用已有邮箱格式校验，保留输入大小写、去除首尾空白；仅为自报联系地址，不更新登录邮箱、验证状态或密码找回渠道，不触发发送 |
| citizenshipCountry | 大写两字母代码；格式校验不等于国籍证据或录取资格判断 |
| expectedRevision | 0 表示仅在资料不存在时创建；已有资料必须使用读取到的正整数版本 |

遗漏保留原值；null 或有界空白字符串清空。未知字段和 userId/role/tenantSchoolId 等身份字段全部拒绝，不接受客户端 revision、verified、consent、profileCompletion 或任意 JSON。非文本、超长、非法控制字符、非单行或无效 Unicode 输入在入库前拒绝。无需 Idempotency-Key，不能把此 PATCH 当作申请创建命令。

首次创建为 revision 1。实际修改推进版本和 updated_at，并写一条仅含字段名与新版本的成功审计；当前版本且值相同为 no-op，不推进版本或重复审计。旧版本即使内容相同仍 409；上限 2147483647 时拒绝实际修改，不能复用版本。全部字段清空仍保留记录和版本，避免删除重建导致旧版本再次有效；这不是完整账号删除或历史审计清理功能。

## 3. 权限、事务与恢复

仅 activeRole=student、本人、无学校 tenant 且具有 student_pii 数据权限可读写。GET 在同一 SQL 快照内检查有效账号/当前 student grant 和本人资料；无账号/角色返回 403，而不是空资料。写入在生产 service 工厂的同连接事务内按账号、角色、资料的顺序持锁，并重查当前权限。

已有资料使用行锁后比较 revision；并发首次创建由 user_id 唯一约束和 ON CONFLICT DO NOTHING 决定唯一赢家，失败方 409，不能覆盖赢家。业务修改与成功审计同事务；审计失败全部回滚。权限撤销先提交，等待中的写入拒绝；写入先取得权限锁，撤销等待至事务结束。会话在途撤销仍受既有 Auth 生命周期边界约束，不声称这些行锁撤销所有已开始请求。

409 或网络/COMMIT 确认不明时，重新 GET 并保留本地未保存内容供比较，不自动把 expectedRevision 改成最新值覆盖；相同 PATCH 重试可能 409。没有操作收据，读取到相同值不证明某个特定请求已成功。任何情况下都不自动修改另一账号或换目标。

学校端、Ops 端、公共目录和 Agent Gateway 均不读取此表。联系邮箱/姓名/国籍不得进入日志、审计 metadata、错误正文或公开 DTO。`0025` 已能为学生本人冻结逐项目认证密文，但没有学校/Ops/Agent 解密投影；学校未来只能经正式提交和 tenant-safe projection 读取明确获准的项目材料。

## 4. 数据与升级

第 15 条迁移 `0014_student_applicant_profiles.sql` 新增一张表，不回填现有 student_profiles、users 邮箱、Agent 记忆或 school_visible_profile_json，不改旧迁移。仅在学生明确提交本接口时创建。users 外键的删除级联仅针对这份当前可编辑资料；未来提交记录及同意证据必须单独制定保留/删除策略，不能照搬此行为。

新表只保存当前版本，revision 是并发控制标记，不是版本历史。历史内容仅在将来的明确提交快照中按最小范围保存，不因每次输入都复制个人资料。数据库加密、备份权限与保留期限、账号删除、生产限流和阿里云验收仍是上线门槛。

迁移先于新读写实例启用；回退可暂停本接口并保留新表，不能通过删表使已保存资料静默丢失。该增量不改变草稿、批次、原 v1/v2 申请幂等收据或费用。

## 5. 后续实施顺序

材料选择草稿已有独立实现：每个项目通过本人 GET/PUT 保存字段/记录引用和来源版本，显式清空保留独立 revision，移除 choice 同事务清理，见 [材料选择合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)。`0024` 在此基础上记录本人逐项目披露授权：绑定选择 revision、四个来源版本、接收学校/项目/批次、当前告知发布证据和内容摘要，不复制材料正文，见 [逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)。保存选择本身仍不是授权；技术记录也不替代法律审查。

1. 最小学业记录及学校项目要求模型：多条教育经历及独立集合版本已本地验收，见 [教育经历合同](CUAC_EDUCATION_HISTORY_CONTRACT.md)；考试/语言自报记录的原始分项和独立版本也已实现，见 [考试记录合同](CUAC_ASSESSMENT_RECORDS_CONTRACT.md)。项目批次要求版本存储与只读投影已实现，见 [要求合同](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md)；内部受控审核/发布/撤回服务也已实现，见 [审核发布合同](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md)。真实来源保全/复核、受控 Ops 入口、受控考试定义/分制映射、必要的课程成绩/GPA、官方成绩核验及适用条件判断仍待交付。不从 demo 文本反推必填字段；自报资料齐全或要求 coverage=complete 均不表示已通过资格核验或申请完整。
2. 告知和授权：告知版本库已实现内部准备/独立审核/发布/撤回和公开只读接口，正文与完整审核摘要固定在发布记录中，见 [告知发布合同](CUAC_NOTICE_PUBLICATION_CONTRACT.md)。本人逐项目授权 API 已能在服务端重算材料并记录精确确认事件，拒绝测试文案、公开 GET、旧 `consent_summary_json` 或 `consent=true`。生产前仍须确认真实用途/接收方、未成年人/监护、保存期限、跨境路径、撤回后处理和最终文案；一条数据库记录不自动证明全部法律义务满足。
3. 材料核对与正式快照：本人逐项目材料预览已实现，明确选择基本资料字段和教育/考试记录，四个来源版本一致时在一个只读数据库快照生成有界白名单内容；不默认全选，不复制私有备注、Agent 或支付数据。`0025` 以当前授权为唯一来源重新构造同一白名单，使用 AES-256-GCM 保存一份与 user/choice/program/intake/authorization 绑定的不可变 payload；数据库不另存材料明文，学校仍不可读取。内容变化会让授权/快照失效，必须重新核对、确认并生成新快照。见 [材料预览合同](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md) 和 [材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)。
4. owner-scoped 只读 preflight：准备报告已实现，逐个项目选择在同一 READ ONLY / REPEATABLE READ 快照中检查归属、集合版本、资料版本/数量、目录窗口、要求/告知发布引用、最新授权和材料快照，以及 choice 中持久化 route 对应的精确当前政策最小状态，见 [逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)。不接受 query/header route 覆盖，不返回原始成绩、授权范围正文、密文/密钥、政策内部证据、私有备注或支付数据。精确且当前的授权、认证快照和政策分别只解除各自 blocker；费用权益及提交服务仍不可用，`canSubmit=false`。
5. 正式提交：事务内复核上述条件，逐项目创建独立申请、收据、审计和 outbox。`0020` 已补 school_application 与 choice 的项目/批次精确关系约束，`0024` 已补披露授权证据，`0025` 已补不可变材料快照，`0026` 已补官方政策治理，`0027` 已补显式 choice route 和 preflight 接入，`0028` 已补 route/policy-bound authorization v2；这些仍不是费用权益、官方递交分组或正式提交。

这些步骤不启用真实支付、邮件、文件上传、学校/Ops 完整写入口或 Agent 自主操作。2026-09-03 起，`frontend/public/application.html` 与 `application.js` 已读取申请基本资料、教育经历和考试记录的本人接口；申请基本资料 PATCH 使用服务端返回的 revision，409 保留未保存输入并要求显式重读。页面已移除演示姓名、电话、预算、静态材料状态和永久同意复选框。文件、材料选择、逐项目授权和 preflight 尚未接入页面，因此支付和发送必须保持锁定，不能把基础资料齐全解释为可提交。

## 6. 验收门槛

必须覆盖严格输入、本人/角色/tenant/data-class、资料与偏好隔离、并发首次创建、同版本单胜、旧版本/no-op、撤权双向等待、审计回滚、COMMIT 确认丢失后的显式重读、空值清除及版本上限。使用真实 PostgreSQL 与构建后的 HTTP 路由验证，不以纯 mock 代替。非空旧库升级必须证明不自动复制姓名/邮箱/记忆，不改旧集合/选择/收据；全量结构对比和重复迁移仍适用。当前验收结果统一记录于 [PostgreSQL 演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

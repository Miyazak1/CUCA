# CUAC 按项目申请与提交后端合同

更新：2026-09-01。BE-0715 草稿添加/移除/编辑/排序已有本地验证；BE-0716 已增加项目批次身份、逐项目准备检查、材料选择/授权/认证快照、版本化官方递交政策、显式 choice route、policy-bound authorization v2、逐项目费用权益，以及 `0030` 的内部原子接收、Program Application v2、官方 transport 分组和 inert outbox。学生公开 submit HTTP、真实支付、outbox worker、学校写入及正式门户适配仍未启用，不是上线批准。最新实现与验收见 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)、[批次合同](CUAC_APPLICATION_INTAKE_CONTRACT.md)、[招生路径合同](CUAC_APPLICATION_ADMISSION_ROUTE_CONTRACT.md)、[政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)、[逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)、[逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)、[逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)、[材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)、[目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md) 和 [统一演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)，末节保留前一轮草稿编辑/排序的历史验收记录。

## 1. 已确认的申请粒度

用户明确选择：**同一申请人针对一个具体项目及入学批次形成独立申请，不把同一所学校的不同项目合并为一份申请。** 这替代旧产品/API 草案中的同校合并规则，是 CUAC 自身的领域决策，不宣称所有中国高校官方系统都采用同一种规则。

| 对象 | 含义 | 约束 |
| --- | --- | --- |
| Application Set | 学生管理本次申请选择的集合 | 是组织和批量操作容器，不是一份学校申请，也不代表所有项目状态一致 |
| Application Choice | 一个学校下的一个具体项目意向 | 同校两个不同项目是两个 choice；当前草稿可暂缺 program，但正式提交必须补齐有效项目 |
| Program Application（当前存储为 `school_applications`） | 一个 choice 对应的独立项目申请记录 | 独立 ID、项目、批次、状态、时间线和学校处理记录，不按 school_id 去重合并 |
| School Tenant | 接收及处理所属项目的学校权限范围 | 老师只能访问本校记录，不能看学生其他学校选择、私有 Agent 记忆或跨校费用 |

例如学校 A 的项目甲、乙和学校 B 的项目丙，对应三条学校申请，分属两个学校租户。对项目甲的处理不能隐式推进项目乙或丙。列表可以按学校分组，但分组不是合并实体，也不能把学校作为唯一状态键。

术语上以 **Program Application / 项目申请** 表示领域粒度。当前 `school_applications` 表名和学校只读 API 标识描述的是学校租户投影，不表示“每校一条”；本轮不为术语做破坏性改表或改 API。正式提交 API 冻结前应单独决定是否迁移物理名称及兼容标识，新合同不得再用 `school_id` 推断申请唯一性。

明确目标的完整身份是具体项目及入学批次，不能只存学校名或专业名称文本。独立的是 CUAC 的项目申请记录，不承诺每个目标都能在高校官方系统独立递交；`0030` 已增加受控 Official Submission Group 映射：若某校一套表单包含多个志愿，只在 transport 层合组，仍保留每个项目的明细、证据、状态和结果。当前仅完成内部数据库接收，没有学校适配器或官方收件确认，不能把 group 或 pending outbox 伪装成所有项目均已递交、审核或录取。

官方规则核对（2026-09-01）：[北京大学 2026 年外国留学生研究生申请 FAQ，第 20、21 问](https://www.isd.pku.edu.cn/cn/detail.php?id=732)说明，申请两个专业需分别提交申请并分别支付申请费，部分院系另有限制。这是特定学校、学段和年度的规则证据，不是中国高校统一标准。CUAC 保留独立项目记录；允许申请数量、志愿顺序/互斥、官方递交方式与收费规则按学校、项目、招生批次和生效版本另行配置并核验。共享学生资料不等于合并申请；提交时为每个项目形成获准范围内的资料快照。

同日补充核对：[清华国际研究生招生 FAQ](https://yzbm.tsinghua.edu.cn/publish/s05/s0504/list)说明两个志愿非平行，第一志愿淘汰后才开放第二志愿；[浙江大学 2026 汉语授课国际本科专业目录](https://iczu.zju.edu.cn/_upload/article/files/57/c7/eff437c745f685758d8bb440f0c0/32486209-d917-498b-9067-2422bf661b67.pdf)仅标星专业接受第二志愿；[南开大学 2026 国际本科招生简章](https://sie.nankai.edu.cn/info/1097/1162.htm)允许两个按顺序投递的专业志愿。不同学校、学段和适用人群的规则只用于证明不能预设全国统一流程，不自动导入为 CUAC 已审核的规则。平台应区分“已保存项目意向”“允许正式递交”“官方已接收”和“项目结果”，不能因同校或一份表单就联动状态。

原有 `school_applications.application_choice_id` 唯一约束支持一项目一记录，但 choice/set/student/school 复合外键只保证归属，不能阻止同校错项目。`0020_school_application_target_identity` 补充学校批次列及非空数据库生成目标键，通过复合外键精确匹配 choice 的项目/批次，包括 null 的一致性；旧项目错配必须停止升级，不自动修复。已有学校记录引用的项目改为禁止硬删除，只有无学校记录的未绑定草稿继续保留原目录删除置空行为。详见 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。这仍不是提交时材料或项目名称快照，不能让未来目录修改重写已发送的材料。

## 2. 已实现的草稿冻结边界

公开的添加入口仍为 `POST /api/v1/student/application-sets/:applicationSetId/choices`，必须带原有 `Idempotency-Key`。冻结轮次未改变请求结构；后续批次轮次新增可选 programIntakeId，选择响应也增加该 nullable 字段，原无批次请求/收据仍兼容。

- 新写入只允许 `status = draft`、`locked_at IS NULL`、`submitted_at IS NULL` 三者同时成立。未知状态同样拒绝；客户端不能写这些服务端字段。
- service 在新建分支检查状态；PostgreSQL repository 在同一 SQL 中对 owner-scoped 父申请组 `FOR UPDATE`，再从锁后版本计算可编辑性。不能只靠请求开始时的读取或按钮禁用。
- 有归属但不可编辑返回脱敏 409；另一学生或不存在的申请组仍按原归属合同返回 403，不泄露其冻结状态。
- 原键命中已提交成功的收据时，允许恢复同一原 choice 的当前 owner-scoped 表示。这是找回结果，不是新的写入；新键或改变输入不能绕过冻结。
- 正式服务工厂在同连接事务内持有父行锁，直到 choice、成功审计和收据一起提交或回滚。拒绝不能遗留未完成收据或成功审计。
- 没有新增“锁定”“解锁”或“提交”公开 API；不接受浏览器自报已付费、已提交或可编辑作为授权依据。

并发约定：冻结先提交，添加等待后拒绝；冻结回滚，添加可继续；添加先取得父锁，冻结必须等它提交或回滚，再用后续 SQL 读取选择。后续提交/编辑/移除服务必须遵守同一父行锁顺序。READ COMMITTED 的锁后行版本及后续语句快照行为见 [PostgreSQL 事务隔离](https://www.postgresql.org/docs/16/transaction-iso.html)，行锁冲突与事务持有范围见 [显式锁](https://www.postgresql.org/docs/16/explicit-locking.html)。

这不是数据库 RLS 或防 DBA 篡改机制。持有直接表写权限的脚本仍须受控；不能给 Agent SQL 权限。普通学生资料继续可以更新，但将来的学校收件必须读取提交快照，不能实时拼接学生后来修改的全局资料。

### 2.1 按项目移除草稿

已实现 `DELETE /api/v1/student/application-sets/:applicationSetId/choices/:choiceId`。仅登录学生可以操作自己的目标 choice，不支持按学校删除或隐式批量移除。

- 请求体必须完全为空，不发送 `{}`，不要求 Content-Type 或 Idempotency-Key。Origin、Fetch Metadata、Cookie 身份、两个路径 UUID 和教育记录权限仍强制检查；压缩请求拒绝，空流读取仍有 5 秒期限。
- 首次移除要求父集合为未锁定/未提交的 draft、choice 本身为未移除的 draft，且没有任何关联 school_application。非本人、错误父集合和不存在的目标统一脱敏 403；本人不可修改的目标返回 409。
- 生产工厂同事务锁定有效账号和 student role，再依次锁定 owner-scoped 父集合、具体 choice。更新 `status = removed`、`removed_at`、`updated_at`，清空 `student_notes`、`requirement_snapshot_json` 和 `metadata_json`，不硬删标识、关系和原添加收据。
- 只有首次变化写一条 `application_choice_status_events` 的 draft -> removed 事件及一条 `student.application_choice.remove` 成功审计；两者与软删除一起提交或回滚。事件不复制备注，审计 metadata 仅含申请集合 ID。重复请求不重复写事件或成功审计。
- 首次及重复成功均为 `200 { data: { id, applicationSetId, status: "removed" } }`。不暴露内部 changed、学生备注、账号、收据和原始数据；当前集合详情/列表不再返回该 choice。
- 原目标已移除时，可重复确认相同结果，包括父集合后来被冻结；仍须验证当前身份、角色和归属。它不执行新删除，不能当作撤回已提交申请的接口。
- 重新添加同一个项目是新意图，必须使用新添加键并生成新 choice ID。迟到的旧 DELETE 只识别旧 ID，不能删除新 choice；原添加键命中已移除资源时返回 409，不复活资源。

重复安全依赖不复用 choice ID 和保留软删除标记，不依赖请求缓存或专用删除收据。后续统一版本迁移使首次移除同时推进父集合 revision，重复确认不推进。COMMIT 确认丢失仍返回不明结果，不自动改目标或重试事务，调用方可明确重发同一 DELETE 恢复确认。未来硬清理、账号删除和备份恢复必须另定重试与保留规则；软删除不是完整的个人数据删除承诺。

关联 school_application 的检查是现有受控服务/脚本协议的一层保护，不是跨表并发约束或 RLS。将来提交必须先锁同一父集合并设置冻结标记，再通过后续语句复读有效选择，不能只插学校记录却不冻结草稿。会话在途撤销、生产限流/容量、RDS 故障及浏览器联调仍按原安全门槛推进。

### 2.2 版本化编辑与原子排序

`0012_application_draft_revision.sql` 增加 `application_sets.revision`：正整数、默认 1。旧集合迁移后为 1，原有状态、冻结时间、选择和备注不变。集合创建/列表/详情响应新增 `revision`，不接受客户端自行设置版本。

| 接口 | 请求 JSON | 成功响应 |
| --- | --- | --- |
| `PATCH /api/v1/student/application-sets/:applicationSetId/choices/:choiceId` | 必填 `expectedRevision`，以及至少一个 `studentNotes` / `scholarshipId` | `200 { data: ApplicationSetDto }`，包含保存后的 revision 和当前有效 choices |
| `PUT /api/v1/student/application-sets/:applicationSetId/choice-order` | 必填 `expectedRevision`、按目标顺序排列的完整 `choiceIds` 数组 | 同上，整组原子成功或失败，没有部分排序成功 |

- 两个接口使用默认同源 JSON 安全入口，核验登录学生、教育记录权限和数据库当前 active 账号/student role；不要求 POST 的 Idempotency-Key。
- PATCH 只修改备注和奖学金。遗漏字段保留，显式 null 清空；备注最多 2000 字符并规范化空白，奖学金必须是有效 UUID。拒绝 schoolId/programId/userId/status/rankOrder 等其他字段，不把同一申请 ID 改成另一项目；学校意向补为具体项目也走移除后重新添加。
- 奖学金必须 active 且属于当前学校/项目范围，允许全局奖学金；不合格选择返回 403。实际改变奖学金时清空旧 requirement snapshot，后续提交前重新计算；修改备注不清空其他字段。
- 排序最多 1000 个唯一 UUID，必须恰好覆盖该集合全部未移除 choices；空集合允许空数组。重复 ID 返回 400；遗漏、多出、其他集合或已移除 ID 返回同一 409，不按外部 ID 查询并暴露其归属。按数组顺序保存 `rankOrder = 0..n-1`，不修改已移除记录。
- 排序是学生内部选择顺序，不代表高校录取规则；现有添加命令的 rankOrder/default 语义暂不改动。后续添加/移除会改变集合版本，前端重新读取后再排序。
- 父集合必须 draft、未 locked/submitted，目标 choice 必须 draft 且没有 school_application；排序要求所有有效 choices 满足此条件。目标/父组不属于当前学生或不存在返回 403；版本过期、被冻结、已移除/已形成学校收件等返回脱敏 409。
- SQL 按账号权限锁、owner-scoped 父行、choice 行的顺序执行。先取得父行锁后的 revision，再决定能否更新；完整排序使用相同父锁和版本，能发现等待期间新添/移除但不在语句初始快照中的选择。
- 创建集合为 revision 1；实际添加、首次移除、实际 PATCH、实际排序各推进一次版本并更新集合 updated_at。新旧值相同且版本当前时是 no-op，不推进版本、不写成功审计；旧 POST 收据恢复和重复 DELETE 也不推进。旧版本即使提交同样的值仍返回 409，避免值改回原样后接受过期意图。
- 修改、版本推进、事务内重新读取和成功审计一起提交/回滚。PATCH 审计只记录字段名、集合 ID 和新版本；排序只记录选择数量和新版本，不记录备注、完整顺序或资料正文。未发生状态转换，因此不伪造 draft -> draft 状态事件。
- revision 上限为 2147483647；到达上限拒绝新变更，不能溢出、清零或复用历史版本。已移除目标的重复 DELETE 仍可确认原结果。

**冲突与不明结果**：先读取集合取得 revision，再发编辑/排序。409 或网络结果不明时重新读取当前集合，保留本地未提交修改供用户比较，不自动把 expectedRevision 更新成最新值后覆盖。这里没有新增编辑/排序操作收据，不能仅凭当前值一致就断言原请求曾成功；需要恢复的是当前状态和明确的新意图。POST 创建/添加仍使用原幂等键，DELETE 仍用固定目标确认，不混用三种协议。

revision 只覆盖受控学生草稿变更，不覆盖目录、学费、账号权限、全局 profile、同意版本或其他系统事实。后续 preflight/submit 必须重新核验这些独立权威来源。直接 SQL 脚本必须采用同一父锁并推进版本；它不是触发器、数据库 RLS 或防 DBA 篡改机制。

**发布顺序**：备份与 staging 演练通过后，先执行第 13 条增量迁移，再部署会推进 revision 的所有草稿写入口；排空旧写入进程，确认没有不推进 revision 的脚本/旧实例后，再启用编辑/排序及前端对接。不能新旧写入版本混跑，也不能上线新接口后回退到不推进 revision 的旧后端。迁移保留旧字段但不代表行为上支持混合部署；回退需暂停相关写入并保留数据库新增列，不能删除 revision 或改写旧 SQL。

## 3. 提交状态机设计

下表同时描述已实现的内部 D2 接收边界和仍待实现的外部学校生命周期。`0030` 已实现“正式接收”行的数据库事务基础，但公开命令、worker、学校适配和后续状态仍未实现；不能把演示页面文案直接当数据库 enum。

| 阶段 | 后端行为 | 不可越过的边界 |
| --- | --- | --- |
| 草稿 | 管理自己的项目、入学批次及非文件资料 | 当前实现创建/添加/移除、备注/奖学金编辑、整组排序及明确批次绑定；旧草稿不自动回填批次 |
| 提交前检查 | 返回逐项目阻塞项；核验账号、项目及批次开放、必填信息和同意范围 | 只读检查不是提交许可，最终写入必须再查 |
| 准备提交 | 锁定父集合，按明确 choiceIds 生成带版本的提交批次和逐项目快照 | 防止检查后修改；不能以整个全局 profile 或 Agent 对话作为快照 |
| 费用确认 | 后端报价/免费资格或支付权益绑定该批次及选择版本 | 是否有费用和是否支付由 Billing 权威记录决定，不能用浏览器 paymentId/paid=true |
| 正式接收 | 学生明确确认；重验权限、版本、资料、同意及费用权益 | 同事务保存提交收据、每项目 school_application、审计和 outbox，避免部分项目静默丢失 |
| 学校可见与通知 | 按项目、学校租户读取已接收记录；异步通知由 outbox 重试 | 通知失败不能再次创建申请；邮件送达、门户可见和学校已读不是同一状态 |
| 学校处理/撤回 | 每项目独立事件与权限；批量命令逐项核验范围 | 不自动做录取决定，不把一个项目的处理复制到同校其他项目 |

建议首版一次明确提交批次在数据库中原子接收全部所选项目：任何一项不满足则整批不接收，并返回逐项阻塞原因。是否允许分批提交、提交后加项目以及补充资料，需要在批次/费用规则确认后实施；不能通过清空 locked_at、改回 draft 直接修改旧收件。

新项目后续追加应成为显式新提交版本/批次，保留旧项目收件和原同意证据。免费名额及增量费用必须按批准的计费周期计算，不能靠另建一个 application set 任意重置。

## 4. 数据与接口缺口

新增已实现基础：0022 逐项目材料选择草稿与本人 GET/PUT，只保存字段/记录 ID、四个来源版本及独立选择 revision；0024 逐项目披露授权保存精确目标、选择/来源版本、当前告知证据及服务端摘要，并提供本人 GET/POST/DELETE；0025 为每条精确授权最多保存一份 AES-256-GCM 认证的不可变材料 payload，并提供本人 GET/POST；0026 保存精确 target + route 的版本化官方政策；0027 保存 choice 的显式 nullable route 并接入只读 preflight；0028 将所有新授权升级为绑定 route、精确政策版本/发布修订及服务端政策摘要的 v2；0029 将新 application fee line 绑定 exact user/set/choice/school/program/intake/route/pricing basis，并由内部 Billing authority 原子授予逐项目 entitlement；0030 在一次事务中重验全部当前证据，创建 application submission、逐项目 Program Applications、policy-driven groups/members、每组一条 inert outbox、命令收据和审计，并冻结 set/choices。选择保存不推进集合 revision；route 变化会推进集合 revision，并使旧准备证据和对应费用权益 stale。资料、route、政策、账单证据或记录变化后旧证据只能失效，不能改写历史；见 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)、[材料选择合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)、[政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)、[材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)、[招生路径合同](CUAC_APPLICATION_ADMISSION_ROUTE_CONTRACT.md) 和 [逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)。

开工顺序如下，各项必须有真实事务与越权测试，不仅是 schema 存在：

1. **项目与批次身份**：`0013` 已增加 choice.program_intake_id、项目/批次复合外键和有效目标唯一约束；`0020` 进一步约束学校记录与 choice 的目标完全一致，学校只读投影新增 programIntakeId。不同批次可分别准备，旧未绑定草稿保留；正式提交仍须补齐身份、检验完整窗口、学校数量/互斥及跨集合重复投递。详见 [批次合同](CUAC_APPLICATION_INTAKE_CONTRACT.md) 和 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。
2. **申请人信息与授权**：独立版本化基本资料已实现姓名、联系邮箱、国籍 GET/PATCH，不自动复制偏好、账号或 Agent 信息。多条教育经历及考试/语言自报记录已实现，后者保留原始分项且不代表官方核验，见 [考试记录合同](CUAC_ASSESSMENT_RECORDS_CONTRACT.md)。告知版本库、独立审核发布及公开只读接口，以及绑定接收学校/项目、目的、选择/来源版本、告知发布证据和确认时间的逐项目披露授权技术记录均已实现。它仍不自动证明真实文案、未成年人/监护、跨境、保留与撤回后下游处理等法律要求充分；不把 `consent_summary_json`、读取告知或客户端 profileCompletion 当证据。见 [申请资料与同意合同](CUAC_APPLICANT_PROFILE_AND_CONSENT_CONTRACT.md) 和 [逐项目授权合同](CUAC_APPLICATION_SUBMISSION_AUTHORIZATION_CONTRACT.md)。
3. **版本、快照与内部接收**：申请集合 draft revision、本人材料预览和逐项目不可变材料快照均已实现。0025 保存与 user/choice/program/intake/authorization 绑定的认证密文，不保存第二份明文；0026/0027 补精确政策与 choice route；0028 让新授权绑定 policy 证据；0029 补 exact 逐项目费用权益；0030 补 Program Application v2、正式 transport group、收件唯一键和原子收据。学校可见投影及外部材料解密/递交仍未实现，只能在后续受控适配器中从获准快照派生，不得包含其他项目备注、其他学校信息或原始支付数据。不能把草稿 revision、预览摘要、密文存在、费用权益存在、绿色 preflight、accepted submission 或 pending outbox 单独当成学校已收到。见 [原子接收合同](CUAC_ATOMIC_APPLICATION_SUBMISSION_CONTRACT.md)、[材料预览合同](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md)、[材料快照合同](CUAC_APPLICATION_MATERIAL_SNAPSHOT_CONTRACT.md)、[政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md) 和 [逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)。
4. **只读 preflight API**：已实现 `GET /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/preflight?locale=en`，每次针对本人单个项目选择，返回目标/窗口、持久化 route、资料版本与数量、要求/告知引用、最小授权/快照/精确政策/费用权益状态及明确的项目问题/平台阻塞项。同一个只读数据库快照中复核归属和当前权威来源，不接受 query/header route 覆盖，不返回姓名、分数、SQL、授权正文、密文/密钥、政策内部证据、invoice/payment/event/provider 证据或其他项目数据。精确 current 授权、认证快照、current policy 和 exact current entitlement 分别只移除各自 blocker；submit 仍不可用，`preparation_only` 与 `canSubmit=false` 保持。详见 [逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)，前端稳定后再对接。
5. **Billing 权益**：0029 已实现 application fee line v2、内部 entitlement grant/currentness 和 preflight 最小投影；同校两个项目不能共享账单行或 entitlement，旧 v1 行不猜测回填。当前 fee preview 仍是受控本地基础公式，并没有批准旧草案的“首校免费、额外学校收费”规则或高校收费规则，不得据此开放真实收费。生产前仍须确认计费单位、免费周期、加项、价格版本、税务、撤回/退款和有效期，并完成真实 provider、签名 webhook、对账与恢复设计。
6. **提交命令**：内部 `application.submit` 已实现并要求 step-up、完整 choice 集合、expected revision、明确确认和独立幂等键；原草稿命令的幂等不覆盖 submit。支持确认丢失后的原键数据库结果恢复，严禁自动换键补发。学生 HTTP、Agent tool 和 worker 均未开放。
7. **学校处理与联调**：学校队列/详情按 schoolApplicationId + tenant 查询，项目粒度处理；补浏览器、学校/Ops 权限和阿里云验收。完整学校写接口、真实支付/通知仍按阶段推进。

申请单位和收费政策是两个独立维度。用户确认按项目申请；0029 因此按项目保存“该项目已满足当前费用条件”的精确 entitlement，但没有据此批准按项目定价，也没有更改生产费用公式或支付 provider。未来可由受审核 pricing policy 按项目、按官方表单、按学校套餐或豁免计算，但最终 entitlement 仍必须精确覆盖每个允许提交的项目。中国高校的官方提交方式、项目数量限制和官方费用由各校最新要求单独校验，不能把 CUAC 内部收件等同于已完成高校官方申请。

## 5. 本轮验收

当前全量本地验收通过 `test:server` 523/523、真实 PostgreSQL 与构建后 HTTP 477/477、Linux 迁移 7/7。当前 schema 为 33 条迁移、24 份快照、58 表、864 列、310 个约束和 210 个索引；同校不同项目分别保留目标、route、授权、认证密文、费用权益、Program Application、状态和结果，不能共享证据。`0031` 的 Agent 记忆有限保留和 `0032` 的候选容量不改变这些申请关系。内部已创建 policy-driven group 与 pending outbox 地基，但没有开放 public/Ops/Agent submit、真实支付、worker/provider、学校写入或官方门户递交，也未修改 V3 产品页面。最终迁移发布摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。

以下为草稿编辑/排序轮次（2026-08-31）的历史结果；后续批次轮次的当前结果以统一演练记录为准：

- `test:server` 347/347；新增十项输入、service、SQL 条件和 HTTP 合同测试。显式 HTTP 导出共 40 个，统一安全入口检查通过。
- `db:pg:rehearse` 143/143，142 个子测试和外层。新增十六项草稿版本/编辑/排序场景，以及一项独立旧数据升级测试；原添加/移除/幂等/冻结和其他领域回归继续通过。
- `db:http:rehearse` 180/180，142 个数据库子测试、37 个网络子测试和外层；新增四项编辑/排序的实际路由、越权/输入/旧版本/冻结拒绝、真实并发单胜和审计故障回滚场景。上述两入口有重叠，不能相加计算独立用例。
- TypeScript、后端 ESLint、实际构建、`db:pg:schema:check` 通过。13 条迁移、4 份快照、36 表、515 列、112 个约束、134 个索引一致；0000..0011 历史字节不变，基线清单只追加已验收的 0012 条目及 SQL/快照哈希，保留原全部条目与工具版本。
- 最终迁移候选摘要 `41e37fc9943ef599542855d39251bd74366467229b401911f06825c54ddb4d4a`；追加已审查基线后，常规、真库、网络与 Linux 四个入口均完整复跑通过。`db:linux:rehearse` 7/7，包含非 root/只读运行、迁移/no-op、SIGTERM 中断后结构/ledger 不变及显式重试。
- 奖学金样本最初误用 name_en 而非 title，Linux 旧锁屏障仍指向上一条迁移的表；均已修正并完整重跑，没有跳过失败用例。所有 HTTP/数据库/Linux 临时资源已清理，未连接阿里云或真实学生数据。

以下是上一轮移除功能的历史记录，不是当前总计：

- 常规后端 `test:server` 337/337 通过。先前冻结修复的三项测试继续通过；本次移除新增十项，覆盖 service 权限/审计、repository 条件、HTTP 目标与空请求体安全边界。
- `db:pg:rehearse` 126/126，125 个子测试加外层。原八项冻结/按项目关系测试继续通过；移除新增十二项覆盖字段擦除、同校选择隔离、旧 ID/旧添加键/新资源、重复与冻结后确认、归属、冻结与已收件拒绝、账号/角色复查、真实并发双向锁等待、事件/审计回滚与 COMMIT 确认丢失恢复。
- `db:http:rehearse` 159/159，125 个数据库子测试、33 个网络子测试和外层。新增四项通过实际构建路由验证 DELETE、重复和替换隔离、输入/来源/归属拒绝、真实冻结竞争及审计故障回滚。与真库入口重叠，不能相加当作独立测试总数。
- TypeScript、后端 ESLint、实际 API 构建通过；12 条迁移、36 表及迁移包摘要不变。
- 全部数据来自临时本地 PostgreSQL。学校收件粒度的测试使用受控 SQL fixture 建记录，只证明关系可表达，不冒充完整提交 service 已实现。
- 网络初跑的统计 SQL 出现 UUID/text 比较错误，已显式转换并完整重跑通过；不是通过跳过测试消除失败。临时 HTTP 服务和数据库容器均已停止、清理。

前端只认 `D:\CODE\CUAC\design-lab\home-v3.html` 为产品参考。本轮没有修改任何前端页面、Hub 或申请中心，也没有开放 Agent 写入、真实支付、邮件、上传、完整学校/Ops 写操作或云端发布。

总安排见 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)，现有重试语义见 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。

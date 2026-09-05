# CUAC 学生成绩与语言考试记录合同

日期：2026-08-31。范围：申请准备中的私有考试记录。数据库和 API 已实现，完整本地验收结果以 [统一演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md) 为准；不是成绩核验、自动资格判断、同意、正式投递或上线批准。

## 1. 领域边界

一条记录描述学生自行录入的一次考试或一份明确的成绩报告，可以包含多个原始分项。同一种考试允许多条记录，不按考试名称合并、不自动取最高分、不跨报告拼接。课程成绩单、学校 GPA、成绩换算、官方送分和附件是后续独立工作，不把它们压进一个自由 metadata 字段。

`student_assessment_histories` 每账号一个独立版本头；`student_assessment_records` 通过 user_id 外键归属该版本头。没有记录时读取返回 revision=0、records=[]，不因注册、读取、偏好、教育经历、目录要求或 Agent 记忆自动建档。教育经历、申请基本资料和申请选择各自的版本不因考试记录变化而推进。

考试报告格式不能假定永久不变。例如 [ETS 的评分说明](https://www.ets.org/toefl/test-takers/ibt/faq/score-reports.html) 说明 TOEFL iBT 自 2026-01-21 采用新评分尺度；[IELTS 单科重考说明](https://ielts.org/organisations/ielts-for-organisations/verifying-ielts-results/one-skill-retake) 说明重考报告与原报告可并存，报告含原测试及重考信息。2026-08-31 核对。这些来源说明保留版本、尺度和报告身份的必要性，不是所有学校接收标准，也没有导入为生产招生规则。

## 2. 字段与状态

| 字段 | 约定 |
| --- | --- |
| assessmentCategory | 必填 language / admissions / other；自报分类，不是认可的考试代码 |
| assessmentName | 必填，单行 Unicode，最多 120 UTF-16 code units；保留实际考试名称 |
| assessmentVariant | 可空，最多 160 code units；保留版本、等级、模块或考试形式，不从总分猜测版本 |
| resultStatus | 必填 planned / awaiting_result / reported；reported 只表示本人录入了结果 |
| resultForm | unspecified / single_sitting / combined / partial_retake；默认 unspecified，不自动推断拼分或重考 |
| testDate / reportDate | 可空，严格 YYYY-MM-DD 日历日期，1900..2199；不是时间戳，不补未知日期 |
| components | 完整有序分项数组，最多 20 项；每项只包含 name、value、scale、testDate |
| evidenceStatus | 响应固定 unverified，不接受客户端提交或编辑 |

分项 name/value 必填，分别最多 80 code units；scale 可空、最多 80 code units，testDate 可空。分数按原始短文本保存，例如 `7.50`、`100`、`A*`，不转换成数字、统一百分制、GPA 或能力等级。没有总分推导、有效期计算、数值范围认证或免考结论。名称与尺度组合按 NFKC/小写比较去重，但保留录入的展示文字；同名分项可显式使用不同尺度。不能因为两条分数都叫 Overall 就相加或择优。

reported 至少需要一个分项。planned / awaiting_result 必须没有分项且 reportDate=null。所有已知测试日期不能晚于已知报告日期；single_sitting 的已知总日期及分项日期不能互相矛盾。其他报告类型保留各分项不同的测试日期。修改按合并后的完整记录核验；例如改回待出分必须同时清空旧分项及报告日期，不能保留矛盾状态。

未知名称映射、尺度、报告类型或日期允许作为待补齐的自报记录保留，不代表材料齐全或真实有效。日期范围只是输入界限，服务不证明考试已发生，也不按服务器时区猜测日期。PostgreSQL 使用 date，SQL 输出显式格式化，不能让驱动将日历日期转换成会跨日的时间戳。

所有正文做严格类型、长度、有效 Unicode、单行及控制字符检查；规范化后整条业务正文最多 8192 UTF-8 字节。拒绝未知顶层/分项字段、数值类型分数、任意 JSON、用户/角色/tenant 指定、verified/eligible、证件号、成绩报告号、账号密码、附件和同意标记。可空字段通过 null 清空，空白文本拒绝，遗漏字段保留。components 更新是整个分项数组替换，不是按数组下标隐式合并。

## 3. 权限与 API

只允许 active student 本人，在 student 表面、student_action 用途、session/step_up 身份、空 school tenant 和 education_record 权限下读写。每次读取或最终写入均在数据库重新检查 active 账号与有效 student role；不能用浏览器自报角色或旧会话结论替代。

学校、Ops、公开目录、Agent/RAG 均不新增这些数据的入口。之后只按明确的项目/学校、目的及同意版本形成最小提交快照，不能直接把当前学生全量考试集合交给学校。未注册新的 Agent 工具。2026-09-03 申请页已接入本人读取、新增、编辑和移除，所有结果明确标注为 self-reported；reported 编辑器保留并提交完整有序 components，而不是只显示或覆盖一个总分。

路径前缀：`/api/v1/student`。

| 方法与路径 | 输入 | 返回 |
| --- | --- | --- |
| GET /assessment-records | 无正文 | 当前 `{ data: { revision, records } }` |
| POST /assessment-records | expectedRevision 和新增字段 | 保存后的完整集合 |
| PATCH /assessment-records/:recordId | expectedRevision 和至少一个可编辑字段 | 保存后的完整集合 |
| POST /assessment-records/:recordId/remove | 仅 expectedRevision | 移除后的完整集合，不返回被擦除正文 |

四个方法都经统一 HTTP 安全入口。路径 UUID、来源、正文和领域输入分别校验；私有响应 no-store，错误不输出 SQL 或原始资料。成功为 200；格式错误 400，非本人或不可用目标 403，旧版本/容量/已移除目标等冲突 409。发现损坏嵌套数据或超量的直接写入时返回脱敏 503，不截断或输出未经校验的正文。已知目标 ID 的本人仍可显式移除该损坏记录。

## 4. 版本、并发与生命周期

集合最多 40 条有效记录，按 created_at、id 稳定展示；不是按最好成绩排序。GET 使用同一个 SQL 快照读取当前权限、版本及最多 41 条记录，超量则拒绝。容量在受控集合锁内执行，不是绕过服务也能生效的全库配额；生产速率限制、历史标识保留及备份治理仍需验收。

首次添加 expectedRevision=0，版本头和首条记录同事务生成，结果 revision=1。之后增删改都使用当前正版本；同版本并发首建或跨记录操作只有一个实际变更胜出。当前版本的相同值是 no-op，不能因 JSONB 对象键顺序不同误判变化；数组顺序则保留其表达意义。旧版本即使内容相同也拒绝。版本上限 2147483647，拒绝溢出或归零。

写事务按 active 账号、student role、集合版本头、具体记录顺序加锁，直到内容、集合 revision、回读及成功审计一起提交或回滚。撤权先提交则等待的新增/修改/移除拒绝；写入先持锁则撤权等待其事务结束，不宣称撤销已交付的数据或所有在途会话。

移除擦除全部八个业务字段，保留固定 ID、归属、时间戳和 removed_at。数据库 CHECK 保证移除行正文为空；重加获得新 ID，旧 ID 不能复活或删除替代记录。移除最后一条保留版本头，不重置到 revision=0。旧版本重试仍冲突；明确重读后，用当前版本确认同一已移除 ID 为 no-op。

本模块没有新操作收据。HTTP/COMMIT 确认不明时先读取当前集合，保留本地意图供比较，不自动提高 expectedRevision 重试；读取相同内容不证明原请求的身份或因果归属，也不能自动将某条新记录认作那次请求的结果。正式提交会使用独立的批次、快照与收据协议。

审计动作是 student.assessment_record.add/update/remove，resource 为固定 record ID；metadata 仅含版本及字段名，不含考试名、分数、尺度、日期或分项标签。读取和 no-op 不写成功变更审计。新三种写方法由同连接事务工厂包装，不能以无事务的单独 repository 调用替代生产入口。

## 5. 迁移与发布

`0018_student_assessment_history.sql` 新增两张表，19 条迁移、10 份快照、43 表。旧迁移不可改写。现有账号、教育经历、基本资料、申请、v1/v2 收据和要求审核/发布证据均不回填或推断成绩。记录表归属版本头并随账号级联；已形成的未来学校快照与同意保留要单独治理，软移除不等于备份和审计中的全部个人数据已删除。

先在 staging 完成备份/升级和回退演练，再迁移并启用版本化入口；不自动导入数据。申请页接线同样遵守 revision 协议，409 不自动抬高版本覆盖。脚本必须遵守同一权限、锁序及版本协议。回退停用新入口、保留表和现有版本，不删表、不重置版本或自动重放未知结果。要求服务原有 0017 证据门槛继续有效，不能回退旧 reader 绕过。

## 6. 验证与下一步

测试必须覆盖原始分数/尺度/报告区别、合并后日期/状态检查、JSONB no-op、本人和角色隔离、当前权限及两种撤权顺序、并发首建/混合操作/容量、三类真实审计故障回滚、实际 COMMIT 后确认丢失、日期跨数据库时区、正文擦除/旧 ID 隔离、损坏数据关闭、版本上限、逐旧表升级比较和真实 HTTP。最终结果统一写入 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)，不把单元测试当生产验收。

继续交付受控考试定义/尺度与招生要求映射、课程成绩和 GPA 的适用数据合同、版本化告知与同意、逐项目快照及只读 preflight。preflight 不得按自由文字猜考试类型、换分、拼分或认定已核验；来源、认可形式、时效、官方核验与学校政策须有各自权威版本。费用权益、正式提交/outbox、文件和官方送分、完整学校处理及阿里云验收仍按 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md) 推进。

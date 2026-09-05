# CUAC 学生教育经历合同

日期：2026-08-31。范围：申请准备中的多条教育经历，不是完整学业材料、成绩核验、录取资格判断、同意或正式提交。

## 1. 模型与权限

- `student_education_histories` 每个学生账号一条版本头；`student_education_records` 保存多条经历，通过 user_id 外键归属版本头。没有资料时 GET 返回 revision=0、records=[]，不因注册或读取创建记录。
- 教育版本独立于 applicant-profile 和 application-set revision。增删改一条经历使整个教育集合推进一次版本；以后提交快照必须同时绑定这些独立版本，不能只比对申请组版本。
- 仅本人、active student 角色、无学校 tenant 且具 education_record 权限可读写。GET 在同一 SQL 快照中检查当前账号/角色并读取版本和记录，避免返回不同时间的版本与内容。
- 学校、Ops、Agent 工具和公开目录均不新增对此表的访问。记录尚未向学校披露；将来只经明确的项目范围同意和白名单提交快照接收。
- 不从 Agent、昵称、偏好或已提交学校资料自动生成经历，不把一份教育经历直接归属于某所申请学校。

## 2. 数据合同

| 字段 | 约定 |
| --- | --- |
| institutionName | 必填，最多 200 个 UTF-16 code units，单行 Unicode，不猜测目录学校 ID |
| educationLevel | 必填：secondary / vocational / associate / bachelor / master / doctorate / other；自报层次，不等于认证学历或跨国等值认定 |
| institutionCountry | 可空，大写两字母代码，仅格式检查 |
| qualificationName / fieldOfStudy | 可空，最多 200 个 UTF-16 code units；实际资格名称和专业名称，不从教育层次自动推断 |
| attendanceStatus | unknown / in_progress / completed / discontinued；默认 unknown，不能默认已毕业 |
| startYear / endYear | 可空，1900..2199 的整数；endYear 表示实际结束就读，不一定已获得资格 |
| expectedCompletionYear | 可空，1900..2199 的整数；只允许 in_progress，不能作为实际毕业事实 |

不用虚构月/日补齐只知道年份的信息。年份范围是当前输入边界，不是年龄/招生政策。实际结束和预计完成不能早于开始年份；in_progress 不接受 endYear；其他状态不接受 expectedCompletionYear。切换状态涉及旧值冲突时，必须同一 PATCH 显式清空矛盾字段。completed 只是本人自报，不能由此判断已取得受认可学位；年份真实有效性在项目核验/提交阶段另查。

所有文字做类型/长度、首尾空白、控制字符、单行与有效 Unicode 校验。可空字段只通过 null 清空，空白字符串拒绝；遗漏字段保留。必填字段不可清空。拒绝自报 owner、role、tenant、record ID、verified、GPA、附件、consent 和任意 JSON，不把未知字段静默存入 metadata。

允许同校多段教育经历及并行经历，不按学校名称自动合并或禁止时间重叠。当前最多 20 条有效经历；超过上限返回 409，移除后可增加新记录。此上限由受控服务在集合锁内执行，不是限制所有直接 SQL 写入的触发器；生产配额/限流和历史标识保留仍须验收。

## 3. API

所有路径以 `/api/v1/student` 开头。2026-09-03 已在申请页接入本人读取、新增、编辑和移除。页面展示完整服务端集合，不按“当前学校”单字段覆盖多条经历。

| 方法与路径 | 请求 | 成功返回 |
| --- | --- | --- |
| GET /education-records | 无请求体 | `{ data: { revision, records } }` |
| POST /education-records | expectedRevision、institutionName、educationLevel，及可选字段 | 当前完整教育集合 |
| PATCH /education-records/:recordId | expectedRevision 和至少一个可编辑字段 | 当前完整教育集合 |
| POST /education-records/:recordId/remove | 仅 expectedRevision | 当前完整教育集合，不返回已擦除正文 |

移除使用显式 POST 命令以携带版本 JSON，沿用现有 revoke 类动作风格；不是接受 JSON 的 DELETE，也不是删除整个教育集合。所有写请求经统一同源/正文安全入口，路径 UUID 和业务字段仍分别校验。成功均为 200，格式错误 400，非本人/不可用目标 403，版本、容量、已移除后编辑等冲突 409。当前版本 no-op 不更新 updated_at 或审计。

第一次添加只能使用 expectedRevision=0，创建版本头和首条记录后 revision=1。此后增删改必须使用当前正整数版本，旧版本即使提交相同值也拒绝。上限 2147483647 时只允许当前版本 no-op，不允许溢出、清零或重建版本头绕过。

记录 DTO 仅含 id 及上表九个字段。列表按 created_at、id 稳定排序，不把列表顺序当最高学历或录取优先级。读取有上限保护，发现超过 20 条的异常直接写入数据时拒绝，不静默截断后声称返回完整资料。

## 4. 原子性与移除

生产 service 工厂提供同连接事务。写入依次锁有效账号、有效 student role、教育版本头，再锁目标记录。并发首次创建用 user_id 唯一键竞争，后续各类操作使用同一集合锁和版本，不只保护各自记录。任何操作都在事务内回读集合，和 metadata-only 成功审计一起提交；失败不能留下版本推进、空版本头、部分记录或成功审计。

移除只作用于本人的固定 record ID，设置 removed_at 并清空全部九个教育字段，保留标识和时间戳。数据库 CHECK 要求软移除行正文为空。重复旧版本命令返回 409；明确重读后用当前版本再次确认同一已移除记录为 no-op。重加生成新 ID，迟到的旧 ID 操作不能删除替代记录；不提供复活接口。移除最后一条仍保留版本头，GET 返回新版本与空列表，不重置为 0。

无新增幂等收据：网络或 COMMIT 确认不明时先 GET、保留本地意图供比较，不能自动提升 expectedRevision 重试。读取相同内容不证明某个特定请求已成功，也不能自动判定新记录就是失败请求的结果。正式提交将使用独立收据协议。

权限撤销先提交则等待写入拒绝；写入先持权限锁则撤销等其事务结束。没有宣称行锁可撤回所有在途会话。审计记录操作、record ID、版本及字段名，不包含学校名称、专业或年份正文；失败响应不泄露 SQL/原始输入。

## 5. 迁移与发布

第 16 条迁移 `0015_student_education_history.sql` 新增教育版本头和记录表，旧账号、偏好、申请基本资料、项目选择和申请收据保持不变。旧库升级不自动创建教育记录或用 targetDegreeLevel 反推已获学历。历史迁移不可改写；新表与约束已通过独立 schema 对比、全部旧表非空升级比较、no-op 和 Linux 中断恢复。已审查基线仅追加 0015 条目和哈希，不改此前 SQL。

先迁移，再启用所有会推进教育版本的写入口；内部脚本遵守同一锁序与版本协议。回退停用新入口并保留表和资料，不删表或重置版本。账号删除对当前教育资料级联，未来提交快照/同意记录的保留与删除需要单独政策；软移除标识、审计、备份不等于已完成全部个人数据删除。

## 6. 后续门槛

本轮不收成绩、GPA、语言成绩或文件，不自动换算学历/分数，不输出“可申请”判断。项目要求及来源/生效版本的存储与只读基础现已本地验收，见 [项目要求合同](CUAC_PROGRAM_REQUIREMENTS_CONTRACT.md)；内部审核/发布/撤回服务也已补齐，见 [审核发布合同](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md)；真实来源复核、生产权限及后台入口仍待交付，学生侧现有独立考试记录模块可保留原始自报分项、尺度和报告形式，见 [考试记录合同](CUAC_ASSESSMENT_RECORDS_CONTRACT.md)，它不修改教育经历字段或版本。课程成绩/GPA、考试定义映射和官方核验仍须以真实证据单独交付。告知同意、逐项目最小快照、preflight、费用权益、原子提交/outbox 和云端验收继续按 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md) 推进。

验收必须覆盖多记录独立编辑、部分更新的合并后校验、跨用户/角色/tenant/data-class、集合版本一致性、并发首建/编辑/移除/容量、权限撤销、审计回滚、COMMIT 不明、正文擦除、旧 ID 隔离、版本上限和非空升级。真实 HTTP 验证不能由 mock 代替。结果见 [统一演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。申请页覆盖读取、新增、编辑和移除，使用当前集合 revision 并对 409 保留用户输入。

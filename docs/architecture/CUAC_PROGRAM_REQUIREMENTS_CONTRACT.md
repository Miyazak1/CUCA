# CUAC 项目批次申请要求合同

日期：2026-08-31。范围：BE-0716 的要求版本、公开只读投影及内部审核/发布服务。不是完整招生规则引擎、Ops 写 API 或正式提交许可。内部流程详见 [审核发布合同](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md)。

## 1. 领域依据

要求绑定具体 program_intake，不以学校或学位层次作为唯一键。同校不同项目、同项目不同批次的要求不能自动复用或合并。学校通用要求和院系例外应由受控审核整合成该批次的明确版本，保留逐条来源；不能自动决定来源优先级。

核对的官方样例说明了模型需要保留的差异，而非 CUAC 已导入的生产规则：

- [北大 2026 国际研究生简章](https://www.isd.pku.edu.cn/cn/news/detail.php?id=727)区分学位背景、专业例外及项目自己的语言要求，预计毕业材料与最终证明也分阶段提供。
- [同年度研究生 FAQ](https://www.isd.pku.edu.cn/cn/detail.php?id=732)另列补交期限、证明材料格式及部分院系的申请数量限制。
- [本科免笔试成绩要求](https://www.isd.pku.edu.cn/cn/detail.php?id=798)同时包含不同考试体系、科目组合和替代证明，不能归纳成一个通用 GPA 阈值。

这些页面只用于架构研究，没有抓取或发布真实招生目录数据。将来必须复核学校、年度、具体招生对象及当前官方修订，不能把这些案例套到其他项目。招生项目可能按专业、院系或大类组织，目录名称本身不证明可独立递交。

## 2. 存储与版本

- `program_requirement_versions`：版本 ID、批次 ID、正整数版本、结构化文档及规范化 SHA-256、draft/approved 审查状态、审批人内部引用、审查时间、生效时间和复查到期时间。一个批次一个版本号唯一。 0017 增加整理人及与内容/身份/时间绑定的人工审核凭证；缺少新依据的历史版本不自动补齐。
- `program_requirement_publications`：每批次一个显式版本指针、正整数 publication revision、active/withdrawn 状态和时间戳；复合外键禁止指向其他批次的版本。默认 withdrawn。
- 读取只跟随指针，不取最大版本号，不在撤回、到期、未生效或无效后退回旧版本。新建未发布版本不会自动替换当前展示。
- 内容摘要验证的是规范化文档，不是数字签名或官方真实性证明；引用来源摘要也不证明真实抓取已发生。内部服务要求不同账号准备/审核、当前内部角色及逐来源/范围/公开内容确认；不能接受学生或 Agent 自报 approved，真实来源审查责任与受控采集仍须落实。
- 内部服务只追加新正文版本，不原位改写或重审旧版本；公开读取核对正文/来源/人员/时间与审核凭证的绑定。schema 未建立防数据库管理员同时篡改数据与凭证的不可变触发器/完整 ACL，不能声称数据库已不可变。未来提交必须绑定版本 ID、内容摘要和 publication revision，并在事务中复核。
- 版本引用的批次、审批人及当前指针引用的版本禁止硬删除，避免静默丢失依据。账号删除与审批证据保留须单独治理；不等于所有个人数据永久保存。

## 3. 文档格式

schemaVersion 固定为 1；language 为 en/zh；coverage 为 partial/complete，表示人工整理覆盖范围，不表示学生符合资格。assessmentMode 由服务端固定为 information_only。

sources：1..12 条，每条包含 key、HTTPS URL、标题、抓取时间和来源内容 SHA-256。URL 仅作引用，不由本服务发起网络请求；拒绝凭据、显式非默认端口、IP/单标签主机、常见内部后缀及携带 token/session 等参数的地址。此语法检查不是 DNS/SSRF 防护或官方域名认证；将来抓取器须独立控制出网。

requirements：1..60 条，每条必须有：

| 字段 | 含义 |
| --- | --- |
| key | 版本内唯一稳定标识，不用数组顺序作为规则身份 |
| category | education / language / academic_results / documents / identity / application_policy / other |
| stage | preparation / submission / enrollment，保留不同提交阶段 |
| level | required / conditional / recommended，不把有条件要求当无条件必填 |
| appliesTo | 明确的适用范围文本，最多 500 UTF-16 code units |
| ruleText | 公开规则说明，最多 2000 UTF-16 code units；保留替代条件/例外，不自动执行 |
| evidenceType | self_report / document / official_result / school_review；自报不当核验结果 |
| references | 1..5 条该文档内有效 sourceKey 及章节/条款 locator |

拒绝未知字段、任意 metadata、重复 key、缺失来源引用、非法 Unicode/控制字符和不受支持枚举。规范化文档最多 64 KiB UTF-8；数据库另设 128 KiB JSONB 文本上限并非同一字节表示。规则、标题、定位文本均为不可信纯文本，客户端必须转义显示；Agent 将来只能视作带来源的数据，不能执行其中的指令。

这一版不解析自然语言为比较表达式，不换算学历、GPA 或考试体系，不用“complete”自动放行。自动判断需要另行设计可验证的适用条件、替代组合、例外及 unknown/manual-review 结果。

## 4. 公开接口

`GET /api/v1/catalog/programs/:programId/intakes/:intakeId/requirements`

经统一 HTTP 安全入口和 public_catalog policy，游客可读。两个 ID 必须是 UUID，query 不覆盖路径目标。只读 active 学校/项目下的 open 批次；过期或矛盾招生窗口不可见。未来开放日或未知截止日可用于准备展示，仍不表示当前允许递交。

只有 active 指针、approved 版本、不同于整理人的审核账号及有效绑定凭证且生效时间已到、复查未到期才返回。时间判断统一使用该 SQL 的数据库 statement_timestamp，同一查询获得版本/内容/权限范围的一致快照。缺失、跨项目、缺少新审核依据的旧版本、未公开、撤回、未生效或到期统一 `200 { data: null }`，不泄漏内部状态。未配置 PostgreSQL 返回 503。已公开行的文档无效、摘要不符、审核凭证绑定错误或来源抓取晚于审查时，返回脱敏 503，不悄悄使用旧文本或旧版本。

DTO 白名单：programId、programIntakeId、publicationRevision、versionId、version、contentSha256、reviewedAt、effectiveFrom、reviewDueAt、assessmentMode、document。整理人、审批人、内部审查凭证和元数据、学生信息、申请、支付和审计正文均不返回。公开读取不会创建申请、教育经历、同意或成功写入审计；无 POST/PATCH/DELETE 入口。

## 5. 发布与下一步

第 17 条增量迁移 `0016_program_requirements.sql` 只新增两表和约束，不修改旧目录文本、student 数据、选择或收据，也不从旧 hskRequirement/englishRequirement/isVerified 自动创建 approved 版本。先建立被引用的复合唯一索引，再建发布指针外键。旧 0000..0015 迁移保持不变。

内部受控服务已实现准备版本、独立审核、发布/撤回、分页及状态读取，含当前账号/角色锁、审批内容绑定、数据库时钟、CAS、同事务审计及重试恢复。没有注册 Ops 写接口、CLI 导入器、Agent 工具或定时发布，也没有导入真实招生规则。来源真实性/保全、后台授权与 MFA、生产 ACL、部署和复核责任仍须独立验收；见 [审核发布合同](CUAC_PROGRAM_REQUIREMENT_GOVERNANCE_CONTRACT.md)。

缺少生产来源/授权/运行门槛时，内部服务的合成测试不构成真实要求管理功能已上线。0017 新增两列保留所有旧值；旧批准记录没有新凭证时不可见。部署需排空旧读取逻辑；回退先关闭要求入口并保留新表列及版本，不能恢复可绕过凭证检查的旧读取代码或用旧文案兜底。

学生单项目准备检查已接入当前要求的版本引用和逐条 key/类别/阶段/级别，所有结果为 unassessed；不把 coverage=complete 当作合格。内部检查读者可提供同一数据库快照的时刻，公开要求 API 仍仅使用当前语句时钟，不接受客户端时间覆盖。见 [逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)。

后续落实来源采集/复核责任和受控后台入口；学生侧依次补适用的成绩和语言记录、版本化告知与同意、逐项目最小快照、完整提交前权威复核，再实现费用权益和正式提交。文件上传、学校系统集成、真实支付、Agent 自主写入仍按生产计划分阶段开放。前端未修改，仅指定 V3 作为产品参考。

验收覆盖 strict document/digest、真实 SQL 的项目/批次/发布/时钟范围、无回退、同校项目隔离、JSONB 规范化、字段白名单与损坏数据失败关闭、结构/外键约束、非空升级/重复迁移和实际 HTTP。最终结果见 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

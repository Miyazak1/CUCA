# CUAC 学生与候选记忆输入合同

更新：2026-08-31。状态：BE-0706 当前学生/Agent 候选部分已实现并本地验证；当前 Auth 入口见另附 [Auth 输入合同](CUAC_AUTH_INPUT_CONTRACT.md)。生产验收未完成。

本合同补充 [HTTP 安全入口](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md) 与 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)。只涉及后端，不变更用户正在调整的 V3、学生 Hub 或申请中心。

## 1. 共同规则

- JSON 结构安全由统一 HTTP 入口处理；领域服务另做对象字段、类型、枚举、长度、数组数量和 UUID 校验。
- 不把对象/数字强制转成字符串，不用 TypeScript 类型断言代替运行时验证。
- 顶层 `userId/actorUserId/role/activeRole/tenantSchoolId/selectedSurface` 为非权威兼容字段：丢弃，不入业务参数。其他不支持字段返回 400，错误消息不回显字段值。
- 嵌套 preferences/structured 没有兼容字段，任何未知键均拒绝。客户端身份字段不能藏在其中保存。
- 这些规则属于当前有限合同，不表示任意业务输入均已覆盖。服务端脚本若直接使用 repository，仍须遵守相同领域合同；数据库约束只是额外保护。

## 2. 学生资料

`PATCH /api/v1/student/profile`

| 字段 | 当前合同 |
| --- | --- |
| displayName | 最多 120 字符的文本，去首尾空白；null/空白表示清除 |
| citizenshipCountry | 两位大写字母或 null；只验证代码形式，不证明国籍或国家代码真实性 |
| targetDegreeLevel | 下述 degreeLevel 枚举或 null |
| targetIntake | 最多 40 字符的文本或 null；不是对招生批次有效性的验证 |
| preferences | 下述结构化学习偏好对象，不接受 null |

至少包含一个可写字段。未提交的字段保持原值；显式 null 清除可空文本。`preferences` 未提交则保留，提交时整体替换，`{}` 明确清空该对象，不做隐式深层合并。

PostgreSQL 使用单个 upsert 和字段存在标志决定更新项，避免“只改姓名却抹掉国籍、学位或偏好”。并发修改两个不同顶层字段的 HTTP/真库测试已通过；同字段冲突仍为最后写入者生效，没有实现版本锁或 ETag。

## 3. 结构化偏好

`preferences` 与候选的 `structured` 使用同一语法。所有字段可选，但候选必须至少有一个非空有效值。

| 字段 | 值域 |
| --- | --- |
| degreeLevel | associate / bachelor / master / doctoral / diploma / certificate / foundation / language / non_degree |
| subjectAreas | 最多 8 个不重复的领域代码，见下方 |
| teachingLanguage | english / chinese / bilingual |
| preferredCityIds | 最多 10 个不重复 UUID，统一小写 |
| fundingIntent | scholarship_required / scholarship_possible / self_funded / undecided |
| intakeYear | 2000 至 2100 的整数，不接受数字字符串 |
| intakeTerm | spring / summer / fall / winter |

领域代码：`computer_science, engineering, business, economics, medicine, health_sciences, natural_sciences, social_sciences, humanities, law, arts, education, agriculture, architecture, mathematics, interdisciplinary`。

这是后端初版受控词表，不是最终招生分类。以后需要扩展时通过服务端版本化变更，不接受自由文本作为兜底。现有 demo 的 `major/subjectArea/preferredCity/targetCities/budget` 等临时字段不能原样透传；应在前端合同稳定后显式映射，未知值提示重新选择，不静默猜测。

preferredCityIds 当前仅验证 UUID 语法，不证明城市存在、已发布或适合用户。后续展示/检索必须经公开 catalog 与 Tool Gateway 再核验，不能凭该 ID 获取私有对象。精确预算、联系方式、成绩、证件、原始聊天与支付信息都不在此词表内。

## 4. 收藏与申请选择

- 收藏 `entityType` 仅允许 school/program/scholarship/city；entityId 必须是 UUID；notes 可空，最多 2000 字符。写入时用固定 SQL 验证对应表的对象存在且 active。不可用对象统一 403，不因不存在外键而暴露数据库错误。
- 申请集合 name 为 1 至 120 字符的非空文本；targetIntake 可空、最多 40 字符。客户端不能设置 submitted/paid/locked 等状态。
- 添加选择时 applicationSetId 来自路径并重新做 owner 校验；schoolId 必填 UUID，programId/scholarshipId 可空 UUID；rankOrder 为 0 至 1000 整数；studentNotes 最多 2000 字符。
- SQL 最终写入同时检查学校 active、项目 active 且属于该校、奖学金 active 且其非空学校/项目限制与当前选择匹配。没有项目选择时不能挂入只限某项目的奖学金。
- 同一集合重复添加同一个非空 programId，数据库唯一约束仍生效，API 返回 409 CONFLICT，不自动覆盖原选择，也不返回 500。创建申请组和添加选择现要求 HTTP `Idempotency-Key`，相同键/有效输入重试返回原资源，见 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。不同键的无项目学校选择仍是不同操作，不宣称跨意图语义去重或完整提交幂等。

这些检查不代表奖学金资格、招生时间和所有学校业务规则已验证，也不替代申请提交状态机。备注是学生私有业务文本，不因此成为 Agent 可读数据；未来界面必须按文本安全呈现，不直接当 HTML 渲染。

## 5. Agent 候选合同

`POST /api/v1/agent/context/candidates` 当前只有一个已注册类型：study_goal。允许已验证的 guest 或 student persona，拒绝学校/Ops 使用此学生偏好类型。学校与管理员的信息整理仍走以后受控脚本/投影，不开放任意摘要存储。

```json
{
  "candidateType": "study_goal",
  "structured": {
    "degreeLevel": "master",
    "subjectAreas": ["computer_science"],
    "teachingLanguage": "english",
    "fundingIntent": "scholarship_possible"
  }
}
```

客户端不得提交 summary、dataClass、contextScope、confidence、sourceEntityIds、expiresAt 或 memoryNamespace。服务端负责：

1. 按当前有效身份派生 guest_page/student_account，学校 tenant 不可混入。
2. 固定分类为 low_sensitive_preference，用枚举与结构规则限制实际内容，绝非相信客户端标签。
3. 从已验证字段生成短摘要，不复制原始对话或旧 summary。城市只记数量，引用单独保存；引用不等于已核实的来源证据。
4. 新候选 confidence 为 inferred；只有后续确认才成为 user_confirmed，不声称候选一定是用户明确表达的事实。
5. 游客候选期限 24 小时，学生候选 7 天，客户端不可延长。
6. API 只返回候选预览所需字段，不返回 anonymousSessionHash、userId、tenantSchoolId、memoryNamespace 等内部绑定。

`POST /api/v1/agent/context/carry-forward` 必须提交 UUID candidateId 和 `confirmed: true`。这表明明确调用确认命令，不证明前端已经正确呈现确认界面；前端验收仍待对齐。

继承时重查原游客绑定、当前学生、候选状态/有效期，再按新词表验证存量 structured 并重新生成摘要。旧的任意 JSON 候选拒绝继承；旧 summary 不被复制，即使其中存在敏感文本。不会自动迁移旧候选、改写 profile、收藏或申请。

拒绝候选时审计只记录服务端固定动作及错误 code，不回显攻击者指定的 candidateType、dataClass 或 summary。保存成功的审计也不包含摘要和偏好正文。

## 6. 验证与未完成项

本地证据：308 项后端测试，115 项数据库/HTTP 测试（94 个数据库子测试、20 个网络子测试及外层测试），当前 12 个迁移。学生/Auth/Agent 同事务成功审计也已验证，见 [事务审计合同](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md) 和 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

新增真库验证覆盖资料遗漏字段保留/明确清空/不同字段并发更新、无效输入不改变资料、收藏/奖学金范围、重复项目 409，以及候选正文拒绝、摘要重建、顺序重复确认拒绝和不写入正式学生资料/申请。

已完成：原子候选确认、SQL 归属、锁后过期、每个 guest 浏览器 12 条/每个 student 账号 24 条 active pending 容量、student_action 专用记忆控制 API、设置/reset 版本、数据库微秒游标、100 条未清除记忆确认上限、角色锁、停用防恢复、候选副本擦除、365 天确认记忆保留和内部有界清理，见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)、[记忆管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md) 和 [记忆保留合同](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md)。尚未完成：控制 UX、Gateway/WAF 滥用控制、生产调度/监控、备份删除、历史异常审查、其他请求幂等、在途会话撤销、浏览器和阿里云验收。

memory、accepted 标记和成功审计现在共用生产事务，已有真实并发和故障回滚证据，但不代表清理、保留策略和完整身份生命周期已验收，仍不开放生产长期记忆。学生自由文本是否包含敏感信息不能仅靠长度校验判定，Agent 不得直接读取这些原始业务字段。

# CUAC 逐项目提交授权合同

日期：2026-09-01。范围：BE-0716 的学生逐项目资料披露授权基础。`0024` 建立证据表与本人 GET/POST/DELETE，`0028` 已把所有新授权升级为绑定 choice route 与精确审核政策的 v2；preflight 动态状态和 choice 移除联动均已本地实现。它不等同于高校已收件、支付权益、法律合规结论或生产上线批准。v2 细节见 [政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)。

## 1. 领域决定

授权粒度固定为一个申请人、一个 `application_choice`、一个具体 `program + program_intake` 和一个接收学校。同校不同项目必须分别授权；列表可以按学校分组，但不能共享授权状态、材料版本或结果。

四个对象继续分离：

| 对象 | 作用 | 不代表 |
| --- | --- | --- |
| Program Application | CUAC 内一个项目及批次的独立申请 | 高校官方表单一定逐项目提交 |
| Submission Authorization | 学生明确确认当前项目、接收方、告知版本和所选资料范围 | 已创建学校收件、已付款或已录取 |
| Official Submission Group | 未来适配高校一表一项目、多个有序志愿或项目组的递交规则 | 合并项目状态或复制录取结果 |
| Billing Entitlement | 未来由版本报价、免费规则或已确认付款产生的提交权益 | 授权本身收费或客户端 `paid=true` 有效 |

当前 `school_applications` 仍是学校租户的逐项目投影。授权不会创建或更新它，也不会锁定收费单位。正式提交以后只能引用一条当前有效授权，并在同一事务重新验证材料、政策和 Billing 权益。

## 2. 告知与同意边界

技术设计支持“充分告知后的自愿、明确确认”、目的/方式/种类变化后重新确认、便捷撤回、向其他处理者提供信息时的单独确认，以及未成年人和敏感信息的额外流程。这些要求可见于[《个人信息保护法》第十四至十七条、第二十三条、第二十八至三十一条](https://www.npc.gov.cn/WZWSREL25wYy9jMi9jMzA4MzQvMjAyMTA4L3QyMDIxMDgyMF8zMTMwODguaHRtbD9yZWY9aW1i)和[国家网信办 2026 年数据出境问答](https://www.cac.gov.cn/2026-07/24/c_1786638883119336.htm)。CUAC 仍须由合格法律/隐私负责人确认适用法、处理基础、真实处理者和接收方、保存期限、未成年人阈值、跨境路径及最终文案；数据库有一条确认记录不自动证明法律义务全部满足。

首版只接受已由现有独立审核流程发布且仍有效的 `application_disclosure` 告知版本。学生必须先查看本人当前逐项目材料预览，再提交与该预览完全相同的内容摘要。授权命令不接受任意 purpose、接收人、字段 JSON、学校 ID、program ID 或 notice 正文；这些都由受控关系和当前发布指针决定。

## 3. 数据模型

新增 `application_submission_authorizations`，每一行保留一次明确授权及其后续状态：

- 精确归属：`user_id`、`application_set_id`、`application_choice_id`、`school_id`、`program_id`、`program_intake_id`，并通过 choice scope 和生成 `target_key` 复合外键锁死目标；
- 范围版本：材料选择 revision，以及 application set、申请基本资料、教育经历、考试记录四个来源 revision；
- 范围内容：复制有界的 `selection_json`，保存 canonical selection SHA-256 和服务端重新生成的材料内容 SHA-256，不在授权表复制姓名、邮箱、学校经历、成绩正文、Agent 对话或支付数据；
- 告知证据：固定 purpose、接收学校、locale、notice scope/version/publication revision/content SHA-256；
- 政策证据：`authorization_format`、choice 中显式 route、精确 policy version/publication revision，以及服务端验证的 document/target-set/approval SHA-256；
- 确认证据：服务端 canonical scope SHA-256、固定确认方式、受控 request ID、数据库确认时间；
- 生命周期：`active / withdrawn / superseded`，结束时间及固定原因。每个 choice 最多一条 active；新授权可显式取代旧授权，历史行不覆盖。

授权表对账号、choice、项目、批次、学校和告知版本使用受限外键，避免普通级联删除抹去证据。未来账号删除/数据主体请求必须走单独保留与删除决策，不能靠直接删 users 绕过。授权正文属于 `student_pii + education_record`，学校、Ops 普通汇总、Agent Gateway、Billing 和公共 API 均无读取权限。

`student_application_command_receipts` 增加 `application_authorization.record` 操作，仅保存哈希键、规范化请求哈希和资源 ID。它不保存材料、告知正文或明文幂等键。

## 4. API 合同

集合路径：`/api/v1/student/application-sets/{applicationSetId}/choices/{choiceId}/submission-authorization`。

### GET

只向当前登录 student 返回最新授权的最小投影或 `data: null`。返回目标、状态、范围 revision、告知引用、摘要、确认/结束时间和当前 freshness；不返回实际材料正文、其他项目、支付、学校内部状态或审计记录。

### POST

必须带 16..128 字符 canonical `Idempotency-Key`，JSON 只允许：

```json
{
  "locale": "en",
  "expectedMaterialSelectionRevision": 2,
  "expectedVersions": {
    "applicationSet": 5,
    "applicant": 3,
    "education": 2,
    "assessments": 1
  },
  "expectedNotice": {
    "versionId": "00000000-0000-4000-8000-000000000000",
    "publicationRevision": 4,
    "contentSha256": "64-lowercase-hex"
  },
  "expectedPolicy": {
    "admissionRouteKey": "direct_university",
    "versionId": "00000000-0000-4000-8000-000000000000",
    "publicationRevision": 2,
    "documentSha256": "64-lowercase-hex"
  },
  "materialContentSha256": "64-lowercase-hex",
  "confirmation": "share_selected_application_materials_with_target_school"
}
```

后端必须重新生成材料预览并比较摘要，并锁定/验证 choice 中的 route 和该精确 target 当前 active reviewed policy；客户端只回显已展示的公开政策身份，不能提供 target-set/approval 摘要或内部审核证据。成功返回最小授权 DTO，`confirmation.format` 为 `cuac.application-submission-authorization.v2`，`canSubmit` 仍为 false。原键同输入恢复原资源；原键不同输入 409。不同键但完全相同且仍 active 的范围复用现有授权，不制造重复确认；范围变化则结束旧 active 并创建新行。

### DELETE

同一路径接收严格 JSON `{ "authorizationId": "uuid" }`。只撤回该 choice 下本人当前 active 授权；迟到请求指向旧授权不能撤回后来新建的授权。重复撤回返回同一最小结果且不重复审计。已有正式学校收件后的权利请求属于后续专门流程，不能把删除本地授权冒充召回学校已接收数据。

## 5. 事务与并发

记录授权按以下顺序持锁并在同连接事务完成：

1. active users 行和当前 student role；
2. owner-scoped application set、choice；
3. 当前材料选择、申请资料和教育/考试版本头，以及所选记录；
4. 当前学校、项目、批次、choice route、精确政策 publication/version/selected-target 和告知发布指针/版本；
5. 该 choice 的 active 授权；
6. 幂等收据完成、授权状态变化和成功审计。

最终检查要求草稿仍可处理、目标精确且 active/open、申请窗口明确开放、未有 school application、材料选择和四个来源版本完全相同、所选记录仍存在、当前告知与客户端看见的版本完全相同、服务端材料摘要匹配，并且 policy publication/version/target 行保持 share lock 至事务提交。任何撤权、编辑、route 改变、政策撤回/替换、目录关闭、告知撤回、审计故障或并发改变都整体拒绝/回滚，不留下半条授权、未完成收据或成功审计。

选择、资料或告知后来变化不会改写历史授权；GET/preflight 把它标为 stale，正式提交必须拒绝并要求重新核对。choice 首次移除在同一事务结束 active 授权并保留历史证据；重复移除不重复结束或审计。

## 6. 明确暂缓

- 不创建 `school_applications`、官方递交分组、通知 outbox 或学校写权限；
- 不启用真实支付、退款、provider、Webhook 或把旧“首校免费”demo 公式当权威；
- 不上传护照、证件、推荐信或原始文件，不开放 Agent 读取授权/材料；
- 不声称完成未成年人/监护人、敏感信息、跨境传输、撤回后下游处理或保存期限合规；
- 不修改 Hub、申请中心或其他前端。唯一产品参考仍是 `D:\CODE\CUAC\design-lab\home-v3.html`，但最终前端须经过明确告知、非捆绑确认和撤回 UX 设计，不能直接照搬 demo。

## 7. 验收门槛

常规、真实 PostgreSQL、非空升级和构建 HTTP 必须覆盖：严格输入、owner/role/surface/purpose/data-class、同校多项目隔离、目标/窗口/notice/selection/source 版本、材料摘要重算、原键恢复/不同输入冲突、不同键同范围复用、新范围 supersede、明确撤回/迟到撤回、choice 移除联动、撤权双向锁、目录/告知/资料竞态、审计失败完整回滚、COMMIT 确认不明后的同键恢复，以及学校/Agent/Billing 无新增读取。迁移历史只追加，不改旧 SQL；旧数据不自动生成授权、同意、学校收件或费用权益。

## 8. 当前实现与证据

- `application_submission_authorizations` 由 `0024` 建表；`0028_application_policy_bound_authorization` 追加 format/route/policy 绑定列、完整形状 CHECK、精确 policy target 复合外键和索引。v1 只读保留且永不 current，不从现状推断回填；新写入必须是完整 v2。
- preflight 现在返回最小 `submissionAuthorization` 投影。只有 active v2 同时匹配精确学校、项目、批次、choice route、当前政策绑定、材料选择/来源版本和告知证据，且目标仍可编辑、窗口开放、尚无学校收件时，才移除 `SUBMISSION_AUTHORIZATION_UNAVAILABLE`；其余平台门槛保留，`canSubmit` 始终为 false。
- 本授权切片推进至 `0028` 时的历史门禁为 `test:server` 499/499、真实 PostgreSQL 366/366、构建后 HTTP 463/463、Linux 7/7；`0029`、`0030` 和 `0031` 的数字也保留为历史。当前完整链为 523/523、477/477、7/7；schema 为 33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引，迁移发布包摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。后续费用权益、Program Application、transport grouping、Agent 记忆保留和候选容量都不改变本授权仍须逐项目独立的边界。
- 演练只使用合成数据和一次性 PostgreSQL。没有连接阿里云 RDS、真实学校、真实支付或真实学生数据；没有修改 Hub、申请中心或其他前端页面。

# CUAC 官方递交政策与分组合同

状态：Slice A 政策地基、Slice B choice 路径/preflight、Slice C policy-bound authorization v2、Slice D1 逐项目费用权益及 Slice D2 内部原子接收/分组已分别由 `0026` 至 `0030` 在本地实现并封存。仍未开放管理/公开政策 HTTP、学生 submit HTTP、outbox worker、真实支付、学校写入或官方门户适配。日期：2026-09-01。

本合同承接 [按项目申请与提交后端合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md)。CUAC 的领域真相固定为：一个学生对一个具体 `program + program_intake` 形成一条独立 Program Application；学校只是租户和展示分组。高校官方系统若要求一张表包含多个志愿，只能通过 Official Submission Group 做外部流程适配，不能合并项目申请、授权、材料快照、状态或录取结果。

## 1. 规则事实与产品决定

[北京师范大学留学生本科 FAQ](https://admission-is.bnu.edu.cn/cjwt/sq/bk/index.html)允许填报两个专业志愿；[广东工业大学国际学生申请流程](https://iec.gdut.edu.cn/EN/Home/Admission/Admission_procedure.htm)允许每轮申请最多两个项目，并按项目数量收申请费；[清华大学 2026 年国际研究生简章](https://yz.tsinghua.edu.cn/info/1015/3056.htm)说明不同院系和项目可能有不同截止时间、批次及附加材料要求。这些官方样本证明学校、学段、年度和申请路径存在差异，不构成全国统一规则，也不能把一张页面表单当成一个学校级申请实体。

因此：

- `ApplicationSet` 是学生组织选择的容器，不是学校申请，也不是官方表单。
- `ApplicationChoice` 在正式准备前必须精确绑定一个 `school + program + program_intake`。
- `ProgramApplication` 一对一对应一个有效 choice，独立保存状态、学校处理事件和结果。
- `OfficialSubmissionGroup` 是递交传输容器，可包含一条或多条 Program Application；它只有表单/通道状态，没有项目审核或录取状态。
- 计费是独立维度。学校按项目收费、按表单收费或 CUAC 的服务费规则都由 Billing 版本和权益表达，不能从申请或分组粒度推断。

## 2. 版本化官方政策

`0026` 已实现的政策模型先于正式分组和 submit 存在。政策不从页面文案、Agent 对话、学校名称、当前目录字段或现有 choice 临时推断。

### 2.1 稳定范围

一个已发布政策至少绑定：

- 一个学校；
- 一组经过审核的 `program_intake` 目标；
- 一个明确的 `admission_route_key`，例如学校直申、指定奖学金通道或其他受控路径；
- 一个不可变版本及有效/复核时间；
- 来源证据、内容摘要、准备者和不同的审核者。

`0027` 已为 choice 增加 nullable、无默认值的稳定 `admission_route_key`。既有数据不回填，不把“学校直申”隐式写入 choice，也不从学校、目录、奖学金、Agent 或 demo 推断；学生只能在精确 `program + intake + route` 的 current active reviewed policy 已存在时显式选择。preflight 只读取该持久化字段，未选路径时失败关闭并返回 `ADMISSION_ROUTE_REQUIRED`，不能从 query/header 覆盖或任选规则。首发覆盖仅学校直申，还是同时覆盖 CSC/奖学金等路径，仍属于受审核产品数据配置，不由 schema 猜测。

### 2.2 机器可执行文档

首版政策文档只表达稳定的结构化规则：

| 字段 | 首版语义 |
| --- | --- |
| `schemaVersion` | 固定为 1；未知版本拒绝 |
| `formMode` | `one_program_per_form` 或 `multi_program_form` |
| `maxProgramChoices` | 该政策范围内允许的项目数，必须为受控正整数 |
| `orderingMode` | `none` 或 `ranked` |
| `admissionRouteKey` | 后端解析的受控路径，不接受客户端自由文本 |
| `externalChannelType` | `university_portal` 或 `approved_manual_handoff`；不保存凭据 |

`one_program_per_form` 下每个官方组只能有一个项目；`multi_program_form` 可按 `maxProgramChoices` 显式加入多个成员。`ranked` 要求连续、唯一的成员顺序，但这个顺序不自动成为项目优先录取逻辑。院系例外、互斥组合等尚未形成稳定机器规则时，政策保持未发布或标记需要人工复核，不能藏在说明文本里放行。

### 2.3 治理和发布

`0026` 已新增不可变版本、版本目标和当前发布指针三层：

- `official_submission_policy_versions`：学校、政策键、版本、结构化文档、SHA-256、审核证据和生效窗口；
- `official_submission_policy_version_targets`：版本覆盖的精确 `school + program + program_intake`；
- `official_submission_policy_publications`：每个精确 target + route 的当前 active/withdrawn 指针和 CAS revision。

准备者与审核者必须不同；发布、替换和撤回写事务审计，读取时继续检查有效/复核窗口。旧版本不修改、不复活、不自动复制到下一招生年度。目录目标、来源证据、审核引用、规则摘要或 target 摘要损坏时读取失败关闭。当前只开放内部 service/repository 和最小已发布读取器，不开放 Ops 通用写 HTTP、公开读取 HTTP 或 Agent tool。

## 3. Official Submission Group

`0030` 已把分组放在内部原子接收事务中创建；它不作为 `0026` 的前置空表，也不从已有 choice、学校或目录自动回填。只有内部 `application.submit` service 在全部项目证据复核通过后，才会同时写 Program Applications、groups、members、幂等收据、审计和 inert outbox。

已实现对象：

- `official_submission_groups`：学生、申请集合、学校、政策版本、递交路径、不可变成员摘要和 transport 状态；
- `official_submission_group_members`：group、Program Application、项目、批次、成员顺序和材料快照引用；
- `official_submission_outbox`：每个 group 一条最小 pending 事件；当前没有 worker，也不保存凭据、材料正文或 provider 回包。

数据库与事务约束：

- 一个组只能包含同一学生、学校、申请集合、政策版本和路径下的项目；
- 每个成员继续引用自己的 authorization、material snapshot 和 Program Application；
- 成员集合在锁定后不可增删、换序或换项目，修正必须形成显式新版本/新递交命令；
- 成员数量、是否可多项目及排序必须匹配提交时锁定的政策版本；
- 官方表单 acknowledgment 只更新 transport evidence，不批量写入项目 `reviewed/admitted/rejected`；
- 一个项目失败不能被同组另一个项目的成功状态掩盖；外部部分结果须逐成员记录并进入人工处置，不静默补发。

## 4. 提交时序

内部 D2 `application.submit` 已在一个受控数据库事务中完成数据库接收：

1. 锁定当前账号、学生角色、ApplicationSet 和目标 choices；
2. 复核精确项目/批次、目录窗口、当前发布政策及招生路径；
3. 逐项目验证披露授权、AES-GCM 材料快照、要求/告知版本和费用权益；
4. 每个 choice 创建一条独立 Program Application；
5. 按锁定政策确定一项目一组或多项目有序组，并保存成员摘要；
6. 同事务写幂等命令收据、成功审计和 transactional outbox；
7. 事务提交后 outbox 保持 `pending`；受限 worker 和学校适配器尚未实现，Agent 无执行权限。

任一项目不满足时，首版整批不接收。网络确认不明只允许用同一幂等键恢复数据库结果，不能自动换键创建第二个数据库接收批次，更不能据此重发官方申请。当前没有公开 HTTP 路由，因此这里仍是内部受控命令合同。

## 5. 权限与数据边界

- 学生只能读取本人项目的最小政策/分组状态，不能读取审核人、内部证据或外部凭据。
- 学校员工只能读取本校已正式接收的项目投影；不能因同组看到学生其他学校、全局资料或 Agent 记忆。
- Ops 后续写操作必须经过独立审核、step-up、实时角色和审计，不提供自由 SQL 或任意 JSON 发布。
- Agent 只能调用只读解释工具，接收已经过 role/tenant/purpose/data-class/projection 限制的政策摘要；不能选择招生路径、创建组、授权、支付或提交。
- Billing 只接收稳定业务标识、金额和权益状态；不读取材料密文、学生成绩或政策审核正文。

## 6. 实施切片与门禁

### Slice A：政策地基

本地已完成：

- `0026` 新增版本、target、publication schema；所有 route 必须显式提供，不设默认值；
- 已增加内部 prepare/approve/publish/withdraw governance 和最小已发布读取器，不开放管理/公开 HTTP 或 Agent tool；
- 非空 `through-0025` 升级保留既有 Auth、目录、申请、授权和快照数据，三张政策表保持空，不自动生成政策；
- 真库已覆盖版本/发布 CAS、独立审核、同校多项目、跨校/错批次、撤回、竞态、审计回滚、摘要篡改及损坏失败关闭；
- Slice A 封存时 schema 为 27 条迁移、18 份快照、53 表、732 列、242 个约束和 178 个索引。

首发招生路径覆盖范围仍是上线数据配置决定，不阻止 route-neutral 的 Slice A 地基或显式选择的 Slice B 存在。

### Slice B：preflight 接入

本地已完成：

- `0027` 为 choice 增加 nullable route、约束和查询索引；非空历史升级保留 through-0026 数据且所有既有 route 仍为空；
- 新增/编辑 choice 的非空 route 必须在事务中匹配精确 active/current policy，路径变化推进 set revision 并让旧材料准备证据 stale；
- preflight 只对 choice 中持久化的精确 `program_intake + admission_route` 读取政策，拒绝 query/header route 覆盖；
- 返回版本 ID、publication revision、document SHA-256、form/ordering/channel 模式和审核时效，不返回内部来源正文或人员证据；
- 只有唯一、有效、审核完整的政策才移除 `OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE`；Billing 与 submit blocker 继续保留，`canSubmit=false`；
- Slice B 封存时常规 498/498、真实 PostgreSQL 362/362、构建 HTTP 459/459、Linux 7/7 已通过；当时 schema 为 28 条迁移、19 份快照、53 表、733 列、243 个约束和 179 个索引。

### Slice C：政策绑定授权

- `0028` 把所有新学生授权绑定到 choice 的持久化 route、精确 policy version/publication revision 和服务端校验的 document/target-set/approval 摘要；
- v1 授权/快照保留为可读历史但永远 non-current，不从当前 route/policy 推断回填；旧 writer 在迁移后失败；
- 新快照只接受 current v2 授权；route 或政策撤回/替换会让对应项目证据失效，不影响同校兄弟项目；
- 真库、HTTP、升级、审计回滚和实际政策撤回锁竞争已通过，详见 [政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)。

### Slice D1：逐项目费用权益

- `0029` 把新 application fee line 绑定 exact `user + set + choice + school + program + intake + route`、金额、币种、费用代码和 pricing-basis 摘要；同校兄弟项目必须各有独立 line 和 entitlement；
- 历史 v1 line 原样保留，不从 metadata 或当前 choice 推断身份，也不自动授予 entitlement；旧 writer 在迁移后失败关闭；
- 只有内部 Billing authority 可在锁定 exact invoice/line/payment/success event/choice 后原子写 entitlement 与审计；没有 public、Ops、学校或 Agent grant route；
- preflight 只返回 `{ id, status, grantedAt, expiresAt, current }`，exact current entitlement 只移除本项目的 Billing blocker；退款、过期、撤回、route/target 变化或支付证据失效均不会改写历史；
- 费用定价粒度仍由受审核 pricing policy 决定；逐项目 entitlement 不等于已经批准按项目收费。详见 [逐项目费用权益合同](CUAC_APPLICATION_BILLING_ENTITLEMENT_CONTRACT.md)。

### Slice D2：正式分组与提交

- `0030` 已新增 `application_submissions`、Program Application v2 证据、`official_submission_groups`、成员表和每组一条 inert outbox；
- 内部 step-up 学生命令在一个事务中创建逐项目申请、官方组、收据、审计和 outbox，并冻结 set/choices；
- `one_program_per_form` 与 `multi_program_form` 均保留逐项目身份；并发同键、陈旧证据、审计回滚和 through-0029 非空升级均有真实 PostgreSQL 证据；
- 尚未实现公开 submit、provider 模拟/真实适配、部分外部结果、worker 租约 fencing、学校写入或阿里云演练。

`0026` 至 `0029` 依次建立政策、显式 route、v2 授权和逐项目费用权益；`0030` 只在内部受控事务中把这些当前证据接收为独立 Program Applications，再按锁定政策建立 transport groups。这些迁移都不 seed 生产政策或价格，也不会从 demo、目录、metadata 或当前 choice 猜测历史证据。v1 历史证据不回填且不再 current。内部 D2 已通过，但真实支付/退款、公开 submit、outbox worker、学校写操作和 Agent 动作工具仍保持关闭。

当前本地证据：`test:server` 523/523、真实 PostgreSQL 与构建后 HTTP 477/477、Linux 迁移 7/7；schema 为 33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引，发布包摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。`0031` 仅增加 Agent 记忆有限保留，`0032` 仅增加候选容量索引，都不改变本合同的逐项目/transport 边界。本地 Node API smoke 已通过，但这不是 V3 完整页面联调、法律/PCI 结论、真实支付、学校官方收件或阿里云/RDS 上线验收。

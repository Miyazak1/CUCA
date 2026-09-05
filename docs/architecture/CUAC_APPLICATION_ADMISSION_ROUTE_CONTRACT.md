# CUAC 逐项目招生路径与 Preflight 接入合同

状态：Slice B 已在本地实现、全门禁验证并封存。日期：2026-09-01。

本合同承接 [官方递交政策与分组合同](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md)。内部申请粒度保持 `student + program + program_intake`；`admission_route_key` 是该项目 choice 当前选择的递交路径，不是学校级申请、第二个项目，也不是支付或学校收件。

## 1. 稳定决定

- `application_choices.admission_route_key` 可空、无数据库默认值；既有 choice 升级后保持空，不从学校、奖学金、目录文案、Agent 对话或 demo 推断。
- 一个 choice 同一时刻最多选择一条路径。修改路径不会复制或合并 Program Application，也不会允许同一集合以不同路径重复添加同一项目/批次。
- 路径 key 只接受受控 ASCII 标识；非空选择必须对应精确 `program + program_intake + route` 的当前 active 官方政策发布。
- 路径是草稿字段。只有本人、student persona、无 school tenant、可编辑申请集和 choice 才能新增、修改或清空。
- 路径变化推进 `application_sets.revision` 并清空旧 requirement snapshot。依赖旧 set revision 的材料选择、披露授权和材料快照因此变为 stale；历史证据不删除、不改写。

## 2. 写入和竞态

- 新增 choice 可省略路径；省略与显式空值都表示“尚未选择”，绝不解释为学校直申。
- 非空路径要求 program 和 intake 已明确。创建/修改在同一业务事务内复核当前账号、student role、父集合、choice、目录目标和 active policy publication。
- 修改使用申请集 `expectedRevision`；同版本并发只有一个成功。路径发布在写入前被撤回时写入拒绝；写入后被撤回时保留学生选择，但下一次 preflight 失败关闭。
- 原幂等键可以恢复已经成功的 choice，即使政策随后撤回；新键不能借历史结果绕过当前政策检查。
- 成功审计只记录 choice、set revision、路径字段发生变化及受控 route key，不记录政策来源正文、学生材料、Agent 内容或支付数据。

## 3. Preflight 投影

preflight 从 choice 读取路径，不接受 query/header 覆盖。只有精确 target、route 和同一只读快照中的有效政策通过完整摘要、审核、时效和 publication 校验时，才移除 `OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE`。

学生最小投影可包含：

- `admissionRouteKey`；
- policy `versionId`、`version`、`publicationRevision` 和 `documentSha256`；
- `formMode`、`maxProgramChoices`、`orderingMode`、`externalChannelType`；
- `reviewedAt`、`reviewDueAt`。

不得返回准备者/审核者身份、来源正文、内部 review evidence、其他 targets、portal 凭据或 Ops 注释。未选路径增加 `ADMISSION_ROUTE_REQUIRED`；未发布、撤回、过期、错 target 或损坏政策都保留平台 blocker。Billing 与 submit blocker 始终保留，`canSubmit=false`。

## 4. 后续授权边界

后续 `0028_application_policy_bound_authorization` 已实现 route/policy-bound authorization v2。所有新授权把 choice 中的 route、精确政策 version/publication revision 及服务端校验的 document/target-set/approval 摘要写入不可变 scope；新快照只接受仍 current 的 v2 授权。既有 v1 授权/快照保留为可读历史，不推断回填 route/policy，也永远不能解除当前授权门槛。详见 [政策绑定授权合同](CUAC_APPLICATION_POLICY_BOUND_AUTHORIZATION_CONTRACT.md)。这仍不等于费用权益、正式分组、平台提交或高校收件。

## 5. 发布门禁

- `0027_application_choice_admission_route` 只增加 nullable 路径列、约束和查询索引，不 backfill、不 seed policy、不建 official group。
- 非空 `through-0026 -> 0027` 升级逐表保留既有授权、加密快照、政策发布及所有旧列，并断言所有既有 route 为 null；重复执行为 no-op。
- 本切片封存时的 498/362/459/7、`0028` 的 499/366/463/7、`0029` 的 508/370/467/7、`0030` 的 514/473/7 和 `0031` 的 521/475/7 证据保留为历史；当前 `0032` 链为常规 523/523、PostgreSQL + 构建 HTTP 477/477、Linux 7/7。schema 为 33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引。后续 entitlement、Program Application、transport group、Agent 记忆保留和候选容量都不能由学校级状态覆盖本 choice 的持久化 route。
- 当前已封存迁移发布摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。
- 不开放 Ops policy HTTP、Agent tool、正式 submit、真实支付、学校写操作或文件上传。

首发究竟发布 `direct_university` 还是同时发布 CSC/奖学金路径，属于后续受审核数据配置；代码和迁移不替产品猜测。

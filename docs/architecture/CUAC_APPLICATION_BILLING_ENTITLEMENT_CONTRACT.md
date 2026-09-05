# CUAC 逐项目费用与提交权益合同

状态：`0029_application_fee_entitlement` 已完成本地实现、门禁与迁移基线封存；不是生产支付开通或上线批准。日期：2026-09-01。

本合同承接 [按项目申请与提交后端合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md)、[官方递交政策与分组合同](CUAC_OFFICIAL_SUBMISSION_POLICY_AND_GROUP_CONTRACT.md) 与 [逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)。领域粒度固定为 `student + program + program_intake`；同一学校的不同项目分别报价、分别取得权益，不能因学校相同而合并成一条申请资格。

## 1. 三层对象不能混用

| 对象 | 作用 | 不能代表 |
| --- | --- | --- |
| Fee preview | 根据当前受控配置展示预计金额 | 报价锁定、已付款、可提交 |
| Invoice/payment | 记录账单和托管支付提供方的业务状态 | 原始卡信息、项目提交资格、高校收件 |
| Application fee entitlement | 证明某个精确项目申请已满足当前平台要求的费用条件 | 项目资料合格、学生授权、正式提交或高校已接收 |

`paid` 不能只由客户端参数、Agent、页面状态或一条孤立的 payment 状态推断。只有服务端在同一受控事务中验证精确账单行、invoice、payment 和成功状态事件后，才能产生 entitlement。preflight 只读取 entitlement；它不创建、修复或猜测权益。

## 2. 逐项目收费身份

首版 application fee line 必须绑定：

- 学生、Application Set 和具体 Application Choice；
- 学校、项目和项目批次；
- choice 中持久化的招生路径；
- 费用代码、金额、币种和服务端 pricing-basis 摘要；
- 所属 invoice。

同校项目甲和项目乙必须是两条独立 application fee line，并分别产生 entitlement。集合级 CUAC service fee 可以单列，但不得被冒充为某个项目的 application entitlement。学校官方系统将来即使要求一张表携带多个项目，也只影响 `OfficialSubmissionGroup`，不改变账单行和 entitlement 的逐项目身份。

现有环境变量平价表只是本地受控配置，不是已审核生产价格政策，也不代表高校官方申请费。生产开放前仍需锁定价格所有者、币种、税务/发票、优惠、外部学校费用、退款和有效期规则。

## 3. 账单行 v2

`0029_application_fee_entitlement` 将 `invoice_lines` 明确分为历史 v1 和精确身份 v2：

- 历史行只标记为 v1；不从 `metadata_json`、当前 choice、学校或金额猜测回填身份；
- 新 writer 只生成 v2；application fee 必须具有完整项目/批次/路径身份；
- service fee 只能绑定用户与 Application Set，项目字段必须为空；
- v2 行保存 `pricing_basis_sha256`，但不保存支付凭据或提供方原始 payload；
- application fee 行通过复合外键绑定 exact choice scope/target；invoice scope 也由数据库约束；
- invoice line 一旦成为 entitlement 来源，不允许覆盖金额、币种、目标或路径。

请求中的 choice ID 集合必须与数据库返回的本人有效 choice 集合完全一致。缺失、越权、重复、已移除或未完成 `program + intake + route` 的 choice 都必须整体拒绝，不能对可见子集静默计费。

## 4. Application Fee Entitlement

首版 entitlement 只接受 payment-backed 来源，不先开放人工豁免、优惠券、积分、退款或 Ops 修正入口。每条记录保存：

- exact `user + set + choice + school + program + intake + route`；
- exact invoice、v2 application fee line、payment 和成功 payment status event；
- 金额、币种、费用代码和 pricing-basis 摘要；
- `active` / `revoked` 生命周期、授予/到期/撤回时间；
- 幂等 grant key 和审计记录。

当前 entitlement 必须同时满足：

1. choice 仍属于该学生和集合，且项目、批次和路径完全一致；
2. invoice 仍属于同一学生/集合并处于已结算状态；
3. 来源账单行为 v2 `application_fee`，完整身份、金额、币种和摘要一致；
4. payment 当前为成功且具有结算时间；
5. 引用的成功事件属于该 payment；
6. entitlement 为 active、未撤回且未过期。

任一条件不成立时只返回 non-current/不可用，不自动重授予，不修改历史。route 变化只使对应项目的旧 entitlement 不再 current；同校其他项目不受影响。

## 5. 权限与隔离

- 学生只能通过本人 preflight 获得最小 entitlement 投影：ID、状态、授予时间、到期时间、是否 current；不返回 provider event、内部摘要或账单治理证据。
- Billing 内部 service 可以在已验证的支付状态事务中授予权益；目前不开放 public/Ops/Agent grant HTTP。
- 学校员工不能读取学生 payment、invoice 或 entitlement；正式提交后只读取本校项目投影。
- Agent 不能预览任意学生账单、创建 checkout、写 payment 状态、授予/撤回权益或把对话当支付证据。
- CUAC 不接收或保存卡号、CVV/CVC、银行账号、routing number、支付 token 或 provider 原始 payment source。

## 6. 事务与幂等

- invoice 及其 lines 在一个数据库事务中创建；相同 checkout key 的重放必须验证既有快照完全一致。
- 调用 hosted provider 必须携带稳定 provider idempotency key；响应丢失后只能用同一键恢复，不能自动换键重复收费。
- payment/provider session 建立使用唯一约束收敛并发；不允许重复账单行。
- entitlement grant 在一个事务中锁定 invoice、line、payment、event 和 choice，写 entitlement 与 audit；任一步失败全部回滚。
- provider 调用无法与 PostgreSQL 原子提交，因此真实接入前还必须完成签名 webhook、状态机、恢复 worker、超时/重试 fencing 和 outbox/inbox 设计。本切片不启用真实支付。

## 7. Preflight 行为

preflight 增加 `billingEntitlement` 最小字段。只有 current entitlement 才移除 `BILLING_ENTITLEMENT_UNAVAILABLE`；`SUBMISSION_UNAVAILABLE` 继续保留，`canSubmit` 继续为 false。

费用权益不能移除以下任何 blocker 或 issue：

- 授权、材料快照或官方递交政策不可用；
- 项目、批次、窗口、招生路径、要求或告知不完整；
- 正式 submit 尚未开放。

## 8. 迁移与发布

- `0029` 只追加字段、约束、索引和 entitlement 表；不创建 school application、official group、submission 或 provider credential。
- 所有旧 invoice line 保留为 v1 且不能授予 entitlement；不解析旧 metadata 做权威回填。
- 旧 billing writer 在迁移后必须失败关闭，防止继续写缺少精确身份的伪 v2 行。
- 空库全链、非空 through-0028 升级、重放 no-op、混合 writer、同校多项目、跨用户、并发 grant、退款/currentness、篡改/损坏、审计回滚、真实 PostgreSQL、构建 HTTP 和 Linux 门禁已在本地通过；阿里云 RDS、真实 provider、签名 webhook、退款状态机和生产恢复仍须独立验收。

本 D1 切片封存证据为 `test:server` 508/508、真实 PostgreSQL 370/370、构建后 HTTP 467/467、Linux 7/7；`0029` SQL/快照哈希保持不变，`0030` 与 `0031` 封存数字作为历史证据保留。当前完整链通过 523/523 常规、477/477 PostgreSQL + 构建 HTTP、Linux 7/7。schema 为 33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引，发布摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。后续原子接收、Agent 记忆保留和候选容量都不改变本合同的逐项目边界。

## 9. 明确暂缓

- 真实 hosted payment provider、签名 webhook、退款/拒付和对账；
- 人工 waiver、优惠券、积分、税务发票和多币种换算；
- 生产价格政策与高校外部申请费规则；
- Official Submission Group、正式 submit、学校收件和 Agent 动作工具。

这些能力必须在各自合同、权限、审计、恢复和生产数据审核完成后再开放，不能由前端 demo 或临时按钮反推。

# CUAC 原子申请接收与官方递交分组合同

状态：D2 内部地基已由 `0030_application_atomic_submission` 实现并于 2026-09-01 封存。`0036_official_submission_delivery` 已封存受控 worker 与固定网关适配器；`0038_auth_session_step_up` 又于 2026-09-02 开放可信密码二次验证和学生公开整套 submit HTTP 路由。现行入口见 [密码二次验证与公开提交合同](CUAC_AUTH_STEP_UP_AND_PUBLIC_SUBMISSION_CONTRACT.md)。真实学校网关和 staging 验收仍未完成。

## 1. 不可变领域边界

- 申请身份始终是 `student + program + program_intake`；当前物理记录为一条 `school_applications`，本文称 Program Application（项目申请）。
- 同一学生申请同一学校的两个项目，必须产生两条独立 Program Application。授权、材料快照、费用权益、状态、决定和时间线均不得共享或联动覆盖。
- `OfficialSubmissionGroup` 只是学校官方表单或递交通道的传输容器，不是申请身份。学校政策允许时，同校多个项目可以同组；政策要求一项目一表时，每条项目申请各自成组。
- Application Set 是学生本次明确提交的原子批次，不是学校申请。首版一次接收该集合中全部 active choices；任一项目失败，整批不接收。

## 2. 本轮开放与关闭

本轮实现：

- `application_submissions` 原子接收根记录；
- Program Application v2 的逐项目证据绑定；
- `official_submission_groups`、`official_submission_group_members`；
- 每组一条最小 transactional outbox；
- 内部 step-up 学生 service、强制幂等、事务审计、重放读取；
- `POST /api/v1/auth/step-up` 与 `POST /api/v1/student/application-sets/:applicationSetId/submit`；
- 同校多项目、政策分组、并发、回滚、非空升级和最小返回投影测试。

本轮继续关闭：

- 任何 Agent submit 工具；
- 真实支付、退款、webhook 和自动 entitlement grant；
- 学校门户写操作、Ops 人工补写、文件上传；
- outbox worker、学校 provider adapter、自动重试和通知；
- 对密文材料生成学校可见明文投影。

因此，公开 API 返回的 `accepted` 现在固定带 `acceptanceScope=cuac_internal`：只表示数据库能够原子、可审计地接收一个已准备批次，不表示已经发送到学校或具备生产发布条件。

## 3. 命令合同

内部命令为 `application.submit`，强制 `Idempotency-Key`。解析后的输入只能包含：

```json
{
  "applicationSetId": "uuid",
  "expectedRevision": 7,
  "choiceIds": ["uuid"],
  "confirmSubmission": true
}
```

- `choiceIds` 必须是当前 Application Set 全部未移除 choices 的精确集合；服务端按 UUID 规范化后用于命令摘要，客户端顺序不决定官方排序。
- 项目顺序来自已锁定的 `rank_order`。`orderingMode=ranked` 时该顺序具有官方含义；`none` 时仍保存稳定 transport position，但不得解释为录取志愿顺序。
- 必须是本人 active student、student surface、`student_action` purpose、无学校 tenant、`step_up` 会话，并允许 `student_pii`、`education_record`、`payment_business`、`public_catalog`、`public_notice`。
- 同一 key 和同一规范化请求返回同一 submission；同一 key 改请求返回 409。新 key 不能重复提交已冻结集合。

## 4. 单事务接收顺序

一次数据库事务必须完成：

1. 独占锁定 active user，并共享锁定 active student role；
2. 锁定 Application Set 和按固定顺序排列的全部 active choices，核对 draft、expected revision、完整成员和精确 `school + program + intake + route`；
3. 在同一数据库时钟下逐项目共享锁定并复核当前审核要求、官方递交政策、告知证据、v2 披露授权、AES-GCM 材料快照和 exact 费用权益；
4. 每个 choice 预生成一条独立 Program Application；
5. 仅按当前锁定政策进行传输分组，并计算成员、组和批次的 canonical SHA-256 manifest；
6. 写 `application_submissions`、Program Applications、groups、members、每组一条 outbox、项目状态事件和 choice 状态事件；
7. 将 choices 与 Application Set 冻结为 submitted；
8. 写成功审计并完成幂等 receipt；
9. 一起提交，或一起回滚。

事务内不调用外部网络、支付 provider、学校门户、邮件或 Agent。任何项目证据不满足、数据库证据损坏或审计失败，都不得留下 submission、项目申请、组、outbox、状态变化或已完成 receipt。

## 5. Program Application v2

`school_applications` 继续表示逐项目申请。v2 必须绑定：

- application submission；
- exact choice、student、set、school、program、intake、route；
- current v2 authorization；
- 经解密认证并与 authorization 对齐的 immutable material snapshot；
- exact current application fee entitlement；
- current requirements version/publication revision/content digest；
- current official policy version、逐 target publication revision及 document/target-set/approval digests；
- 数据库接收时间。

复合外键和唯一键必须阻止跨学生、跨集合、跨 choice、跨项目、跨批次、跨 route 或跨证据替换。表中不得保存原始支付字段、provider 凭据、自由 routing JSON 作为权威证据，或第二份材料明文。

历史记录迁移为 `cuac.program-application.v1`，新增证据列保持 null，不从 metadata、当前目录、当前政策或当前付款状态猜测回填。迁移完成后列默认值切换为 `cuac.program-application.v2`；未显式提供完整证据的旧 writer 必须失败关闭。

## 6. 官方递交分组

基础 group key 为 `school + admission_route + policy_version + policy digests + form/order/channel rule`。

- `one_program_per_form`：每条 Program Application 独立成组，即使同校同 route 同 policy；
- `multi_program_form`：同一 group key 内按稳定项目顺序切分，每组成员数不得超过 `maxProgramChoices`；
- 一个成员只能属于一个组；一个组的全部成员必须属于同一 submission、student、set、school、route 和 policy version；
- group 保存不可变成员数量和摘要，member 保存自己的 Program Application、choice、program/intake、authorization、snapshot、entitlement 和 position；
- group transport status 不得批量改写项目审核或录取状态。

## 7. Transactional outbox

每个 group 原子创建一条 `official_submission_outbox`：

- 只保存 group/submission/school 标识、事件/载荷格式、manifest digest、状态和最小租约元数据；
- 不保存学校账号、cookie、access token、材料明文或 provider 回包；
- 初始状态固定为 `pending`，本轮没有 worker 会消费它；
- group 唯一键防止同一官方表单重复排队。

未来 worker 必须另行通过身份、租约 fencing、确认不明隔离、逐成员结果和人工处置门禁，不能将当前 pending outbox 视为已递交。

## 8. 返回与审计最小化

内部 service 返回 submission ID、set ID、source revision、接收状态/时间、Program Application 的项目身份与本地状态、group 的传输规则摘要与 pending 状态。不得返回：

- 授权范围正文、材料选择、密文或解密内容；
- invoice、payment、provider event、金额、币种或 pricing digest；
- 政策来源正文、准备/审核人员；
- outbox lease、错误、provider payload 或凭据。

成功审计记录 root submission、set、choice/group 数量和 manifest digest，不记录材料、成绩、支付标识或项目备注。Agent、学校、Ops 和 Billing 均无本轮 service 入口。

## 9. 发布门禁

D2 本地完成至少要求：

- unit、TypeScript、schema snapshot 一致；
- real PostgreSQL 覆盖同校两项目在 `one_program_per_form` 下两申请两组、在 `multi_program_form` 下两申请一组；
- 每项目独立 authorization/snapshot/entitlement，交叉引用被数据库拒绝；
- stale set、成员缺失、政策替换/撤回、notice/requirements 变化、材料/费用失效均整批失败；
- 同 key 并发只产生一个结果，确认丢失可重放；新 key 重复提交失败；
- 审计失败和插入故障不留部分记录；
- through-0029 非空升级保留 v1 历史行，新 writer 默认失败关闭；
- PG、built HTTP regression 和 Linux migration/release gate 全通过。

只有另行完成公开 HTTP 风险评审、真实 pricing/payment、worker/provider、学校租户投影、阿里云 RDS/ECS 演练和运维批准后，才可讨论生产 submit 开关。

## 10. 封存证据

- schema 当前为 33 条迁移、24 份快照、58 张 public 表、864 列、310 个约束、210 个索引；
- 常规后端：`0030` 封存时 `npm run test:server` 为 514/514，`0031` 为 521/521；当前 `0032` 完整常规套件为 523/523；
- 真实 PostgreSQL 与构建后 HTTP：`npm run db:http:rehearse`，当前 477/477；
- Linux 隔离迁移：`npm run db:linux:rehearse`，7/7；
- `0030` SQL SHA-256：`c20ba118ee9e7f5fe6b75c8b1a95b3d667981b926c2528a4e13b60aa241489fe`；
- `0030` snapshot SHA-256：`f401598ac2e07c7af685c68b688f9ec2cb4cac46aab18bff3fcf23508ef88da0`；
- 当前最终迁移发布摘要：`b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`；
- 当前最终 Linux 运行镜像：`sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`。

演练明确通过两种同校多项目规则：`one_program_per_form` 产生两条 Program Application、两个 group 和两条 inert outbox；`multi_program_form` 仍产生两条 Program Application，但只产生一个含两个有序成员的 group。所有临时 PostgreSQL、HTTP、Linux 容器、网络和运行镜像均已清理。以上是本地后端接收能力证据，不是学校已收到、支付已完成、法律/PCI 结论或阿里云上线批准。

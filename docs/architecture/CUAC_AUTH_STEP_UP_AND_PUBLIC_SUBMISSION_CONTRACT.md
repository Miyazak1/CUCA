# CUAC 密码二次验证与公开整套提交合同

状态：2026-09-03 本地生产地基完成。`0038_auth_session_step_up` 已封存，之后在不改 schema 的前提下扩展为保留当前 student、school 或 Ops persona 的通用密码二次验证；真实 PostgreSQL、生产构建 HTTP、全量后端和 TypeScript 检查通过。本文不代表真实学校、商户或阿里云 staging 已验收。

## 1. 公开接口

- `POST /api/v1/auth/step-up`
  - 只接受 `{ "password": "..." }`；身份和目标会话只来自当前 `cuac_session` Cookie。
  - 成功不更换 Cookie，返回当前 `userId`、`sessionId`、`authStrength=step_up` 和 `stepUpExpiresAt`。
  - 密码、原始会话 token、password hash 和限流 key 不进入响应或审计。
- `POST /api/v1/student/application-sets/:applicationSetId/submit`
  - 必须提供 `Idempotency-Key`，body 只能包含 `expectedRevision`、完整 `choiceIds` 和 `confirmSubmission=true`。
  - 用户、角色、surface、purpose 和 auth strength 全部由当前会话解析；请求头和 body 不能授予身份或 step-up。
  - query/fragment、额外支付或 provider 字段、缺失项目、错误 revision 及非完整 choice 集合均失败关闭。

两个接口都经过统一 HTTP 安全边界，只允许同源 JSON 写入，返回 `no-store` 和请求 ID。Agent、学校和 Ops 没有提交入口。

## 2. Step-up 权限

持久会话的 `auth_strength` 固定为 `session`。二次验证只在 `auth_sessions.step_up_expires_at` 保存短时窗口，数据库约束要求它晚于会话创建且不超过会话到期；有效强度在每次请求解析时动态计算。

密码验证成功后，最终升级事务重新核对：

- 当前 token hash 对应同一未撤销会话；
- active 账号，以及与当前 persona 匹配的 live student role、school membership/学校状态或 CUAC staff grant；
- 同一 active role、surface 和 tenant；二次验证不能切换 persona 或取得新的角色/租户；
- 当前 password identity 仍是刚验证的 hash；
- 会话仍未到期。

窗口由 PostgreSQL `clock_timestamp()` 权威计算，为当前数据库时间后最多 10 分钟，且不得超过会话本身到期。密码重置、会话撤销、学校 membership 失效或员工 grant 撤销都会使后续受保护动作失败。审计 `auth.step_up` 使用真实 active role/tenant 并与窗口写入同事务；审计失败时不留下增强权限。

## 3. 原子提交

提交服务在打开业务事务前要求有效 step-up student。事务内锁定账号、角色、Application Set 和全部 active choices，并逐项目复核当前 requirements、notice、reviewed submission policy、v2 authorization、AES-GCM material snapshot 和 exact paid fee entitlement。

同一事务创建：

- 一条 `application_submissions`；
- 每个项目一条独立 Program Application；
- 按当前审核政策形成的 official submission groups/members；
- 每组一条 transactional outbox；
- choice/set 状态、状态事件、成功审计和幂等 receipt。

任一证据、约束、审计或写入失败则全部回滚。同一 key 和同一规范化请求返回同一结果；相同 key 改请求或新 key 重复提交已冻结集合返回冲突。

## 4. 返回语义

成功响应为 HTTP 201，并明确返回：

```json
{
  "status": "accepted",
  "acceptanceScope": "cuac_internal",
  "cuacId": "CUAC-2026-004218"
}
```

`cuacId` 是服务端为整个 Application Set 分配的稳定外部引用，不是授权凭证。`accepted` 仅表示 CUAC 已原子接收并排入受控递交，不表示学校已收到、查看或接受申请。院校可见必须等待官方递交 worker 获得经验证的接收回执。响应不暴露 authorization、snapshot、entitlement、invoice、payment、provider、材料正文或 outbox 租约。

## 5. 迁移与发布

`0038_auth_session_step_up.sql` 只增加 nullable 到期列、索引和约束，不生成 step-up 权限，不改密码或 token。升级前应确认历史 `auth_sessions.auth_strength` 没有人工写入的 `step_up`；发现异常必须人工审查，不能放宽约束或自动改写为有效权限。

发布必须先迁移，再整体切换会动态解析 `step_up_expires_at` 的 Auth reader 和提交路由；旧 reader 与新 step-up writer 不得长期混跑。回退时关闭 step-up/submit 入口并保留列、审计和提交证据，不删除已接收申请。

## 6. 本地证据与剩余边界

- 定向 unit/contract：72/72；最终相关定向复跑 42/42。
- `npm run db:pg:rehearse`：398/398，PostgreSQL 16.13；包含数据库时钟、过期降级、约束和审计失败回滚。
- `npm run db:http:rehearse`：497/497；真实生产构建服务验证普通会话拒绝、密码 step-up、伪造身份拒绝、整套提交、同 key 重放及无重复记录。
- `npm run test:backend`、`npm exec tsc -b --pretty false`、`npm run build`：通过。
- schema：39 条迁移、30 份快照、63 表、961 列、341 个约束、236 个索引。
- `0038` SQL SHA-256：`eebf9055a1d480fce4d130ad82aa23b069afb5d9d141a4fa12e1c563fb67efd8`。
- `0038` snapshot SHA-256：`585504fc2c2f592286c477c124b1835f793918a8d11f3a187790372e39128214`。
- detached migration release：`d834652cb7d4df5f459131a2143ed37ea74c802f847140cc80da1636937dc8cf`。

仍未完成：真实来源/法律文案/价格批准、外部邮件、真实商户、OSS/ClamAV、真实学校接收方、生产 WAF/MFA、阿里云 RDS/ECS/KMS 和浏览器 staging 闭环。因此本地通过不等于生产发布许可。

## 7. `0042` 后续通用 step-up 证据

Ops 目录要求审批、发布和撤回现要求 `cuac_admin + step_up`。二次验证事务保留原 Ops persona，重锁匹配的 live staff grant，并在 grant 撤销后拒绝继续升级或执行特权命令；student 原子提交规则保持不变。最终全量后端 706/706、真实 PostgreSQL 408/408、生产构建 HTTP 515/515，TypeScript 与聚焦 ESLint 通过。没有新增迁移，也没有把 Agent、school 或普通 Ops 会话提升为目录审批者。

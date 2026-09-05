# CUAC Auth 输入合同

更新：2026-09-02。状态：BE-0706 当前 Auth 入口的字段合同已实现并本地验证；BE-0710 已补异步密码计算、两版严格存储格式、固定 v2 新写入及登录事务内旧凭据升级。密码登录现在可请求 student、school_staff 或 cuac_internal 表面，但实际 persona、学校租户和 CUAC role 必须由数据库当前授权推导，见 [密码运行合同](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)。云端容量、泄露口令筛查、MFA 与更广侧信道门槛仍未完成，不代表账号系统可直接上线。

实现入口：`frontend/src/server/auth/input.ts`；HTTP 与 service 两层校验，不能只依赖 TypeScript 类型。生产数据库仍为 PostgreSQL，部署目标仍为阿里云。本轮不新增迁移、不连接外部邮件，也不改前端。

前端唯一产品参考为 `D:\CODE\CUAC\design-lab\home-v3.html`。以下是后端合同，不要求把 demo 页面或临时交互固定为最终产品。

## 1. 请求字段

所有公开写入口首先经过既有 Origin、JSON 对象、64 KiB/深度/超时保护，见 [HTTP 合同](CUAC_HTTP_SECURITY_AND_GUEST_SESSION_CONTRACT.md)。Auth 层再检查以下字段；未列出的业务字段返回 400，不回显字段名或值。无业务字段的命令发送 `{}`。

| POST 路径（均位于 `/api/v1/auth`） | 可提交的业务字段 | 服务端规则 |
| --- | --- | --- |
| `/guest-session` | `rotate?` | boolean，省略时保留有效绑定；不能指定期限或 token |
| `/register` | `email`, `password`, `displayName?` | 仅创建 student；UA/IP 来自 HTTP 元数据，不接受请求体版本 |
| `/sessions` | `email`, `password`, `selectedSurface?`, `schoolId?` | 省略表面时为 student；school_staff 必须提供 schoolId；cuac_internal 不接受 schoolId。客户端只请求上下文，最终 persona/tenant/role 由当前 role、membership、学校状态或未过期已批准员工授权推导 |
| `/logout` | 无 | 只按当前 Cookie 撤销 session，成功时清除账号及游客 Cookie |
| `/email-verification` | 无 | 目标邮箱取当前账号；提交 `email` 返回 400 |
| `/email-verification/{challengeId}/verify` | `verificationToken` | UUID + 一次性证明，事务最终检查目标和有效期 |
| `/password-reset` | `email` | 正常响应固定 `data.status = accepted`，不返回 deliveryStatus |
| `/password-reset/{challengeId}/reset` | `resetToken`, `newPassword` | UUID + 一次性证明；修改密码与撤销旧会话一并提交 |
| `/school-invites` | `schoolId`, `email`, `role` | 仅当前 CUAC Ops/Admin 可创建，学校必须 active |
| `/school-invites/{inviteId}/accept` | `inviteToken` | 必须是被邀请邮箱所属的当前账号，学校与角色取邀请记录 |
| `/school-invites/{inviteId}/revoke` | 无 | 仅当前 CUAC Ops/Admin 可撤销 |
| `/sign-in-continuations` | `targetRoute`, `actionKey`, `requiredRole?`, `payloadPreview?`, `deviceFingerprint?` | 仅已绑定游客；只允许已登记导航，不执行业务写入 |
| `/sign-in-continuations/{continuationId}/consume` | `continuationToken` | 当前账号、角色、原游客绑定、期限全部满足才单次消费 |

兼容性处理：顶层 `userId/actorUserId/role/activeRole/tenantSchoolId/selectedSurface/schoolId/invitedByUserId/revokedByUserId` 若不是该命令明确接收的业务字段，会被丢弃，不产生权限。例外有两类：创建邀请的 `schoolId/role` 是需授权检查的目标参数；登录的 `selectedSurface/schoolId` 只是所请求的会话上下文，不能覆盖数据库推导出的 persona、role 或 tenant。除此以外的未知字段一律拒绝。嵌套对象不继承这些忽略规则。

## 2. 字段边界

| 字段 | 当前合同 |
| --- | --- |
| 邮箱 | 原始输入最多 320 个 UTF-16 单元；去首尾空白后最多 254 个 ASCII 字符；local-part 最多 64、域名每标签 1..63；禁止空标签、local-part 首尾或连续点、域名标签首尾连字符 |
| 邮箱身份 | 去首尾空白并转小写查询；保留 plus alias 和点，不采用 Gmail 等供应商专有归一化；仅支持非引号 ASCII mailbox 与 ASCII/punycode 域名，不承诺完整 RFC/SMTPUTF8 支持或证明邮箱所有权 |
| 注册/重置密码 | 至少 15 个 Unicode code point、最多 1024 个 UTF-8 字节；可用 Unicode、空白和长口令，不做 trim、截断或 Unicode 归一化；拒绝孤立 surrogate |
| 登录密码 | 至少 1 个 code point、同样最多 1024 UTF-8 字节，仍必须匹配已存 hash；不把新的最短长度追溯应用到旧 8 字符密码 |
| 登录表面 | `student/school_staff/cuac_internal`；省略为 student。school_staff 的 `schoolId` 必须是 canonical UUID，且只接受该账号当前 active membership 所属的 active 学校；内部表面只接受当前已批准、未撤销、未过期且角色匹配的员工授权 |
| 注册 displayName | 省略/null 表示未提供；否则为 trim 后非空文本，原始长度最多 120 个 UTF-16 单元，按共享文本规则检查控制字符；不静默截断 |
| 资源 ID | challenge/invite/continuation/school/catalog reference 都要求 UUID 形状，标准化为小写；有效 UUID 不等于存在或有权限 |
| 一次性 token | 严格 32-byte、无 padding 的 canonical base64url，即 43 字符；不能带空格、换行或 `=`；不做 trim |
| 邀请 role | `admissions/counselor/viewer/school_admin`；不允许邀请授予 CUAC 内部角色 |
| deviceFingerprint | 可省略/null/空字符串，否则 bounded text，最多 256 UTF-16 单元，仅保存 hash；它不决定权限或浏览器归属 |

新密码长度取值依据 [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) 对无 MFA 场景的建议。长度校验只是其中一项，不是完整 OWASP/NIST 合规：同步密码计算已替换为有界异步执行，新写入使用固定版本化 scrypt v2，旧记录在成功登录时事务内升级；泄露口令筛查、MFA、反枚举及云端容量/滥用测试仍未完成。

注册/登录 service 的内部 UA/IP 元数据也做文本边界检查：分别最多 2048/128 UTF-16 单元。HTTP 请求体不能覆盖它们。现有转发 IP header 不能当作已验证身份；可信代理剥离/重写规则和多维限流必须另行验收。

## 3. 登录前待办

目前唯一登记的导航合同为：

```json
{
  "targetRoute": "/application.html#add-choice",
  "actionKey": "application.add_choice",
  "requiredRole": "student",
  "payloadPreview": {
    "programId": "c1111111-c111-4111-8111-c11111111111"
  }
}
```

兼容目标 `/application.html`；其他路由/action/role 组合全部拒绝。`requiredRole` 省略、null 或空字符串时使用 student，它不能给账号授予角色。新增导航须登记固定组合并补测试，不开放任意 URL 或 action 文本。该映射可以随正式路由设计调整，不据此反推数据库表。

`payloadPreview` 仅允许 `schoolId/programId/scholarshipId/cityId`，值必须为 UUID。既有 preview 大小上限仍为 2000 序列化字符；自由文本、嵌套对象、循环对象和敏感字段拒绝。当前不验证目录引用的存在或版本，正式选择写入仍须走学生服务的 active/关系/归属检查。

消费时重验数据库中保存的 action、route、role 和 preview，旧的任意路由/action、slug 或缺失角色不能继续使用。返回只是预览和导航信息，不代表申请提交、支付执行或永久 Agent memory。

## 4. 本地证据

以下保留原字段合同轮次证据。最新异步密码计算和回归结果见 [密码运行合同](CUAC_AUTH_PASSWORD_RUNTIME_CONTRACT.md)，不将历史计数当作当前总数。

- `npm run test:server`：308/308；其中 Auth 文件为 121 项测试，新增 12 项字段合同测试，原有权限场景使用真实格式的 UUID/token，避免只在格式层提前拒绝。
- `npm run db:http:rehearse`：115/115，即 94 个数据库子测试、20 个网络子测试和外层测试，当前 12 个迁移。
- 非法注册不改变 users/identities/sessions/roles；非法验证、重置、邀请和续接不留下相应写入；错误 proof 不消耗 challenge，也不修改密码或撤销会话。
- 1024-byte Unicode 密码可注册及精确登录；去掉其中空白后无法登录。120 字符昵称不截断。
- 真实网络学校邀请创建/接受/撤销通过；伪造 userId/schoolId/role 不提权，错账号和重放被拒绝。证明 token 使用临时库合成 fixture，不发送邮件。
- ESLint、TypeScript 检查及网络演练所需生产构建通过；临时 HTTP 子进程与 PG 容器已清理。

详见 [PostgreSQL 演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。这是本地合成数据证据，不是 HTTPS 浏览器或阿里云预发布验收。

## 5. 仍需完成

1. BE-0707 当前 Student/Auth/Agent 范围已通过同事务成功审计故障回归，见 [事务审计合同](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md)。未来外部副作用 outbox 尚未覆盖；BE-0712 的两个申请命令已经有 [幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)，但不能直接套用于 Auth。会话/邀请等仍需专属结果恢复，不缓存原始密码、Cookie 或一次性明文 token。
2. BE-0708：原子确认、12/24 owner-scoped 待确认容量、学生专用记忆控制 API/版本/分页/100 条确认容量、365 天有限保留与候选/记忆清理批次已本地验证；管理 UX、Gateway/WAF 滥用控制、生产调度/监控、备份删除和完整身份生命周期仍未完成。见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)。
3. BE-0709：真实 HTTPS 浏览器、可信代理、WAF 全 Auth 路由覆盖及阿里云 RDS TLS/恢复演练。
4. Auth 生产凭据门槛：异步 scrypt、共享两操作上限、两版严格解析、固定双 profile 校验、新写入 v2 以及登录事务内旧哈希升级已实现。继续做目标实例容量基准、泄露口令筛查、MFA、账号枚举/耗时侧信道、其余身份竞态和邀请管理并发撤权；不得把本地合成性能或兼容旧参数当成云端生产批准。
5. 兼容性审查：若导入旧账号，审查当前语法不支持的邮箱、超过新上限或含异常编码的密码；不能用静默修改邮箱/密码的方式迁移。真实邮件供应商和故障重试另行批准。

本合同不开放完整 Agent、自然语言落库、真实支付、文件上传或通用学校/Ops 写接口。

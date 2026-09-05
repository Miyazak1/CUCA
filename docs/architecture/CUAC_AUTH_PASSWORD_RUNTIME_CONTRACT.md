# CUAC 密码计算与版本升级合同

日期：2026-09-01。BE-0710 的异步执行、严格编码、版本化工作因子和旧凭据原子升级已通过常规、PostgreSQL 及构建 HTTP 本地回归；完整生产凭据门槛仍未完成。

## 1. 存储格式与固定参数

生产代码使用 `frontend/src/server/auth/password-hasher.ts` 中的 Node 原生异步 scrypt，不自行实现密码派生算法，也不在 HTTP、环境变量或数据库记录中接受调用方指定的算法参数。[Node.js 22 Crypto 文档](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)说明了异步 scrypt 及其参数；异步不等于不消耗 CPU、内存或 libuv 线程池。

| 记录 | 固定编码 | 参数 | 写入规则 |
| --- | --- | --- | --- |
| 旧版 `scrypt_v1` | `scrypt$<salt>$<key>`，116 字符 | `N=16384,r=8,p=1,maxmem=32MiB` | 只读兼容，不再新写 |
| 当前 `scrypt_v2` | `scrypt$v2$32768$8$3$<salt>$<key>`，129 字符 | `N=32768,r=8,p=3,maxmem=64MiB` | 新注册、密码重置和旧版成功登录升级 |

两版 salt 均为 16 个随机字节的无 padding canonical base64url；派生结果为 64 字节的同类编码。旧版继续使用历史上的 salt 文本作为 scrypt salt，不能改成解码后的盐字节。v2 采用 [OWASP 当前列出的 scrypt 组合](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)之一；`maxmem=64MiB` 是 Node 运行上限参数，不是对实际进程内存的容量承诺。

解析器只接受上述两个完整、固定且 canonical 的 profile。尾部字段、空白、padding、非规范末位 bit、其他算法、未知版本以及篡改后的 N/r/p 都拒绝；绝不根据存储字符串执行任意工作因子。损坏记录不能认证，也不会自动猜测修复。

注册/重置仍要求至少 15 个 Unicode code point；旧密码可按原字节登录。密码最多 1024 个 UTF-8 字节，不 trim、截断或 Unicode 归一化。没有表迁移、全库批量重算或强制重置。

## 2. 固定校验工作与资源边界

登录校验在一个准入名额内按固定顺序执行：

1. 先执行旧版 profile；非旧记录使用固定 dummy salt 和不可成功的期望值。
2. 再执行 v2 profile；v2 使用记录 salt，旧版使用新随机 salt 预备可能的升级值，未知/损坏记录也执行同一 profile。
3. 只有 canonical 记录对应的比较可以成功；只有旧版密码匹配时才返回 v2 升级值。

因此账号缺失、停用、无密码、哈希损坏、旧版和 v2 都执行两个固定 profile，再由服务返回相同的账号/密码错误。这减少了旧/新工作因子和“账号不存在就快速退出”的明显差异，符合 [OWASP 对通用响应及处理时间差异的提醒](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-responses)，但不声称完全恒时、消除数据库查询差异或彻底阻止账号枚举。

同一模块实例的注册、登录和重置共享最多两个在途操作。一次登录在两个 profile 之间不释放名额；不建立等待队列。满额返回通用 503，不写账号、会话、凭据或成功审计。底层失败、错误长度和同步抛错同样脱敏，只有全部 native 工作结束才释放名额，不能以 Promise 超时提前释放仍在运行的任务。

派生 Buffer 在比较或编码后清零；第一阶段 Buffer 在第二阶段开始前清零。JavaScript 字符串、Node/OpenSSL 内部副本及操作系统内存不能保证即时擦除，不宣称明文或编码字符串从未存在于内存。

两任务限制是单进程/模块实例的保护，不是集群全局限流或独立密码沙盒。多个副本会叠加 CPU、内存和线程池占用；Gateway/WAF、实例资源预算、监控、过载和拒绝服务验收仍须单独完成。

## 3. 旧凭据原子升级

服务先读取身份并完成密码校验，但该结果不是最终写权限。旧版成功时，会把以下操作放在同一 PostgreSQL 事务及成功审计范围内：

1. 锁定当前 `users` 行。
2. 仅当账号仍 active、student 角色仍有效、密码身份邮箱仍匹配且 `password_hash` 仍等于校验过的旧值时创建 session。
3. 仅允许 canonical `scrypt_v1 -> scrypt_v2`，以 `user_id + provider=password + 精确旧 hash` 更新一行；零行或多行均失败并回滚 session。
4. `auth.login` 成功审计仅记录 `credentialUpgrade: scrypt_v2`，不记录旧值、新值或密码。

外层生产工厂让 session、凭据升级和成功审计使用同一连接事务。审计失败会回滚三者；密码重置先提交时，旧证明不能创建会话或覆盖新密码。表示升级不撤销已有会话；真正的密码重置仍按原合同撤销账号会话。

两个已经完成旧密码计算的并发登录最多一个可以用旧 hash 创建 session 并升级。后到事务因旧证明不再匹配而得到通用 403，不自动用刚生成的新 hash 重放；用户明确再次登录即可使用 v2。这样保留一次性升级的数据库证明，不为隐藏一次迁移冲突而重试凭据事务。

## 4. 发布与回退

v2 仍存入现有 `text` 列，因此没有新 schema 或迁移，也没有公开 API、角色或前端改动。但旧代码只理解 116 字符记录，不能读取 v2；而新代码会立即在注册、重置和旧版成功登录时写 v2。

当前发布必须采用认证入口短暂停写/排空后的整体切换：

1. 在 staging 备份并验证旧版与 v2 样本、会话/重置竞争和目标 ECS 容量。
2. 停止接收新的注册、登录和重置，排空所有旧认证进程及脚本。
3. 部署全部能读两版、只写 v2 的实例，再恢复入口。
4. 观察 503、KDF 时延、CPU、内存、线程池、登录 403 和 `credentialUpgrade` 审计数量。

不能让旧/新认证实例滚动混跑，也不能在已有 v2 记录后回退到旧解析器。回退必须暂停 Auth 并保留能读取 v2 的代码，或前向修复；不得批量降级哈希、恢复旧写入参数或增加客户端可控降级开关。未来若要求无停机滚动升级，需要先交付独立的双读兼容版本和受控发布证据，本轮没有伪装成已支持。

## 5. 本地验收证据

- 本机 Node v22.22.3/Windows 的三个连续合成样本：旧版约 48-58ms，v2 约 247-264ms。它只用于确认参数成本显著变化，不是 ECS 选型或生产 p95/p99。
- 密码运行文件的 9 项定向测试覆盖独立 crypto 互验、两版严格编码、未知参数拒绝、固定两阶段、旧版升级值、共享准入、阶段间不释放、失败清零/脱敏、超载无写入及 HTTP 无 Cookie 503；服务/仓储另新增 3 项升级接线与拒绝测试。
- `npm run test:server`：470/470 passed。
- `npm run db:pg:rehearse`：335/335 passed，即 334 个子测试加外层。真实场景覆盖旧版成功升级且保留旧会话、重置先提交阻止旧升级、两个旧登录单胜，以及审计失败回滚升级和 session。
- `npm run db:http:rehearse`：424/424 passed，即同一批 334 个数据库子测试、89 个构建 HTTP/生命周期子测试及外层；新增网络用例证明旧登录升级、后续 v2 登录、审计标记和响应不泄露凭据。
- TypeScript、完整后端 ESLint、离线 schema 检查和 HTTP 演练内生产构建通过。
- 无新迁移；仍为 24 条迁移、15 份快照、48 表/638 列/190 约束/163 索引。迁移包摘要仍为 `b0cb03ce60af3a56dc1f4d84e6d1d9315dafff327371a92bd50cfdf8dfce4455`。
- 临时 HTTP/PG 已正常停止并清理。独立 Linux 迁移/OS 信号本轮未重跑，不视为本轮新证据；未连接阿里云或真实账号。

首次真库运行中，新测试把 `audit_logs.request_id` 的 `text` 错写为 `uuid[]` 比较，数据库明确以 `42883 text = uuid` 拒绝；修正测试为 `text[]` 后完整 335 项重跑通过，没有放宽生产 SQL 或跳过用例。

## 6. 仍未完成

BE-0710 继续保持 open：目标 ECS 机型和副本数的并发/排队/超载/p95/p99 验收、泄露与常见密码筛查、MFA、真实 Gateway/WAF 限流、HTTPS 浏览器与代理信任、账号恢复和更广枚举/侧信道评估、监控告警、凭据轮换及阿里云 staging/RDS 联合演练仍未完成。

本合同不是账号系统上线批准，不启用真实邮件、支付、完整 Agent，也没有修改用户正在设计的 Hub、申请中心或 V3 页面。

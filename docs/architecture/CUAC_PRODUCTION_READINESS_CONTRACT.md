# CUAC 上线预检合同

日期：2026-09-03。上线预检、hosted payment runtime、通用密码 step-up、公开原子 submit、稳定 CUAC 申请编号、governed Ops 支持查询、固定运营队列摘要、项目要求治理、隔离支付事件双人复核、官方递交路由复核、目录数据质量复核与账号范围通知核心已本地验证；不是部署许可，也没有启用外部服务。

## 1. 检查范围

`frontend/src/server/infra/production-readiness.ts` 及 `frontend/scripts/production-readiness-check.ts` 只执行离线配置与当前实现状态检查。不连接数据库、KMS、邮件、支付或 OSS，不执行迁移或发送消息，也不检查真实云端权限。

报告固定包含 `scope=offline_preflight`、`runtimeVerified=false`。`ready=true` 仅表示该环境下没有离线阻塞项，不能代替浏览器、真实提供方、权限、备份恢复或产品验收。开发环境缺少云配置可以只有 warning；这不意味着产品可上线。

本轮修复了“任意提供方名称/桶名即通过”的误放行。没有增加 `*_READY=true` 一类自我声明的绕过开关，也没有制造可用提供方注册表。

## 2. 实现与配置

| 能力 | 当前实际实现 | 预检规则 |
| --- | --- | --- |
| 账号邮件 | challenge、加密 outbox、验证/重置动作页、固定阿里云 Direct Mail 适配器和常驻 worker 已有本地证据；没有真实提供方验收 | 未配置/disabled：开发 warn，staging/production fail；其他任何提供方名称均 fail。outbox 和适配器通过不等于真实邮箱投递完成 |
| 通用通知 | 站内 API、偏好、事件/投递持久化、学校状态、CUAC 接受提交、支付成功/取消/退款事件源、固定阿里云 Direct Mail 适配器及常驻 worker 入口已有本地证据；模板默认关闭外发 | staging/production 必须配置固定适配器，并同时确认 worker 受监管和 staging 投递/退信验收；任意 provider 名、缺失凭据或任一确认缺失均 fail。站内通过不等于外部投递通过 |
| 支付 | 固定 hosted gateway、双向 HMAC、验签 webhook inbox、成功/取消/退款事务、对账 worker、精确 entitlement/撤权和本人状态查询已实现 | disabled：开发 warn、staging/production fail；production 仅 live；test/live 必须是固定 provider、完整 HTTPS/host/分离密钥配置，并确认 worker 受监管和 staging 签名闭环，否则 fail |
| 敏感上传 | 固定区域私有 OSS 签名、精确对象版本、隔离扫描、owner-scoped 下载、租约删除 worker 和恢复语义已在本地实现；没有真实 OSS/KMS/ClamAV 云端验收 | 未配置/false 表示关闭并阻断 staging/production；true 仍须完整 OSS/KMS/ClamAV/worker 配置及五项 staging 验收，只有桶名不能通过 |
| 官方递交 | `0036` 已实现密文材料复核、固定 HTTPS handoff、HMAC 双向绑定、租约 worker 和原子签收；未配置真实网关 | disabled：开发 warn、staging/production fail；任意 provider 或不完整密钥失败；只有受监管 worker 与签名 staging 回执往返均确认才可通过离线配置门禁 |
| 数据库、KMS、WAF、Agent 边界 | staging/production 强制 `PGSSLMODE=verify-full`，数据库 URL 禁止可覆盖 TLS/host/identity/session 的 query 或 fragment；Agent 可关闭，启用时强制 Gateway/Sandbox，且任何发布都必须显式 `CUAC_AGENT_DIRECT_DB_ACCESS=false/disabled` | 通过不证明连通、证书可信、ACL、入口限流或隔离实际生效，必须单独做运行验收；私网声明不能替代 RDS 证书与主机名校验，Agent 也不能凭环境缺省获得数据库权限 |

代码证据：邮件实际消息配置仍由 `auth/email-delivery.ts` 校验；支付由 `billing/runtime/payment.ts` 只接收固定 provider，并由 `hosted-gateway.ts`、`webhook-http.ts` 与 `postgres-payment-events.ts` 固定外部和事务边界。不能把本预检当作真实消息/支付调用、商户验收或发布批准。

未来接入真实服务时，必须同时更新运行工厂、配置校验、适配器测试和本合同，移除对应“未实现”阻塞。不能只删检查或把提供方字符串加入白名单。

## 3. 命令行退出规则

环境按 `CUAC_ENV`、`DEPLOY_ENV`、`NODE_ENV` 顺序解析，显式空值/拼写错误不回退到后面的变量。兼容已有 dev/test、stage、prod 别名。

| 条件 | gateMode | 退出行为 |
| --- | --- | --- |
| 开发环境，未设置硬门槛变量 | advisory | 输出报告，退出 0；不是发布命令 |
| staging/production，未设置硬门槛变量 | required | 有 fail 退出 1 |
| 缺失/未知环境，未设置硬门槛变量 | required | 环境和门槛检查失败，退出 1 |
| `CUAC_REQUIRE_PRODUCTION_READY=true` | required | 必须是 staging/production，且全部离线检查通过；否则退出 1 |
| `CUAC_REQUIRE_PRODUCTION_READY=false` | advisory | 仅诊断，报告保留全部失败但退出 0；禁止作为 CI 发布批准证据 |
| 显式空值或不是 true/false | invalid | 退出 1，不静默降级 |

布尔值和模式会 trim/lowercase。即使 required 模式退出 0，也仍需单独的运行证据和发布审批。`npm start` 与 `start:managed` 现在只允许显式 development 环境；staging/production 必须使用 `start:reviewed`。三个入口都拒绝 `NODE_OPTIONS`、`NODE_PATH` 与 `NODE_TLS_REJECT_UNAUTHORIZED=0`，但部署平台仍须固定正式 entry command，不能把代码入口保护描述成平台策略已生效。

### 3.1 Staging 运行证据预检

`frontend/config/staging-acceptance.example.json` 与
`npm run infra:staging-evidence-check -- <protected-manifest>` 把分散的云端验收项固定为
16 个有序控制：HTTPS/WAF 限流、应用健康与摘流、RDS TLS/ACL、迁移、备份恢复、
员工 MFA、账号邮件、业务通知、签名支付、私有 OSS、签名正式递交、worker
监督恢复、告警送达、密钥轮换、四角色核心 E2E 和回滚演练。逐项正反例和留证规则见
[Staging 验收操作手册](CUAC_STAGING_ACCEPTANCE_RUNBOOK.md)。

该预检绑定 40 位 commit SHA、不可变容器 digest 与迁移 manifest SHA-256；
每个完成项只能引用一个非占位的 `artifact:sha256:<digest>`；使用
`npm run infra:evidence-artifact -- <protected-redacted-artifact>` 从受保护、已脱敏的普通文件生成引用，不把控制台链接、
临时令牌、日志正文或凭据写入报告。缺项、乱序、额外字段、pending/failed、
未来时间、生成后超过 30 天的清单、超过 30 天的控制证据、重复复用的控制证据摘要和占位摘要全部失败。示例清单故意退出 1。

即使全部结构检查通过，报告仍固定为 `runtimeVerified=false`、
`reviewRequired=true`，只允许进入受保护的人工发布复核，不能自行授权部署。

`npm run infra:release-gate -- <protected-manifest>` 是提供给可信 CI 或人工发布流程的组合入口。
调用方必须另外注入本次待发布工件的 `CUAC_RELEASE_COMMIT_SHA`、
`CUAC_RELEASE_IMAGE_DIGEST` 和 `CUAC_MIGRATION_MANIFEST_SHA256`。门禁要求生产配置预检处于
staging/production 硬模式、staging 证据已可复核，并逐字比较证据清单与本次发布的三项身份。
任一缺失、占位、格式错误或跨版本不匹配均退出 1，因此 30 天窗口内的旧证据不能替另一版工件背书。
即使组合门禁通过，报告仍固定为 `runtimeVerified=false`、`reviewRequired=true`、
`deploymentAuthorized=false`；它只允许进入受保护的人工发布复核。

部署运行入口可显式使用
`npm run start:reviewed -- <protected-manifest>`。该入口在加载受控 HTTP 服务器前调用同一组合门禁；
失败时不会打开监听端口，成功后复用 `start:managed` 的排空、信号与 PostgreSQL 关闭逻辑。
普通开发入口在加载 HTTP server 前拒绝 staging、production 和未知环境。首次 staging 候选必须使用
`start:staging-candidate`，它在监听前绑定非占位 commit/image/migration 身份、远端 `verify-full` PostgreSQL、
硬门禁和 Agent/direct-DB 关闭状态，只用于采集 16 项验收证据；production 及证据完成后的受审启动必须使用
`start:reviewed`。部署平台仍必须通过受保护配置固定正式 entry command，不能把入口保护本身描述成平台策略
已生效或部署已获批准；直接调用框架内部二进制不属于受支持的发布路径。

五个外部副作用 worker 使用相同的双阶段策略：staging 采证期无 manifest，但必须通过候选身份、远端
`verify-full` PostgreSQL 和 Agent 关闭检查；production 启动必须把同一份受保护 staging manifest 作为唯一参数，
并在加载 PostgreSQL 或提供方模块前通过组合发布门禁。worker 受监管、恢复和真实提供方结果仍由 staging
证据控制，入口校验不能替代这些运行验收。

PowerShell，在 `D:\CODE\CUAC\frontend`，使用已批准部署环境注入的配置：

```powershell
$env:CUAC_ENV = 'staging'
$env:CUAC_REQUIRE_PRODUCTION_READY = 'true'
npm run infra:production-check
```

两份 `.env.example` 都保持邮件/支付/上传关闭、迁移批准关闭、硬门槛开启。未接线的完整站点应当检查失败，而不是通过改模板伪装成可上线。不要把示例域名、费用或密钥替换占位符当作已经审核的生产决定。

## 4. 验收证据

当前离线门禁及 payment runtime 收口后的验证证据：

- `npm run test:server`：597/597；全局 API 边界扫描包含外部签名 webhook 的 raw-body 安全模式。
- `npm run test:payment`：11/11；覆盖固定 hosted gateway、双向 HMAC、事件格式、重放、竞态、webhook 和 worker。
- `npm run test:agent-gateway`：17/17；证明支付没有被加入公共 Agent 工具面。
- `npm exec tsc -b --pretty false`、`npm run build`：通过；构建产物包含账单本人状态查询和 provider webhook 路由。
- `npm run db:pg:schema:check`：39 条迁移、30 份快照、63 表一致；不连接数据库。
- `npm run db:pg:rehearse`：398/398，PostgreSQL 16.13；新增覆盖数据库时钟 step-up、过期降级、持久权限约束及审计失败回滚。
- `npm run db:http:rehearse`：497/497；真实生产构建 HTTP 覆盖普通会话拒绝、密码 step-up、伪造身份拒绝、整套原子提交和幂等重放。

`0039_cuac_application_reference` 已在同日封存：当前为 40 条迁移、31 份快照、64 表、970 列、350 个约束和 242 个索引；两次完整 `db:pg:rehearse` 均为 399/399，随后 `db:http:rehearse` 为 498/498。它验证稳定编号的历史回填、12 路并发年度分配、学生读取、invoice 快照、v2 学校投影必填、错误集合编号拒绝及当前生产构建 API，详见 [CUAC 申请编号合同](CUAC_APPLICATION_REFERENCE_CONTRACT.md)。

`0040_ops_access_and_application_support` 随后封存：当前为 41 条迁移、32 份快照、64 表、970 列、356 个约束和 244 个索引。全量后端与 TypeScript 通过；`db:http:rehearse` 为 501/501，封存演练为 401/401。它验证 CUAC 员工角色不能脱离当前已批准授权、完整 CUAC ID 的最小查询、固定 reason、事务内二次授权检查、metadata-only 审计、撤权后拒绝及历史权限不自动修复。它仍不等于完整 Ops、真实 IdP/MFA、云端 WAF/RDS 或支持访问会话验收，详见 [Ops 申请支持查询合同](CUAC_OPS_APPLICATION_SUPPORT_CONTRACT.md)。

`0041_ops_support_access_session` 已继续封存：当前为 42 条迁移、33 份快照、65 表、981 列、363 个约束和 248 个索引。支持会话最长 15 分钟且不超过原员工授权期限，精确绑定 actor、role、grant、Application Set 与 CUAC ID；创建、读取和关闭都在事务内重锁当前授权，授权撤销/重发不会复活旧会话。最终全量后端 661/661、迁移/快照 35/35、真实 PostgreSQL 403/403、构建 HTTP 503/503，detached release 为 `d1b2a7950f59434bfe56bce1cf217c7da18fbac8308e8dd0d5d7d830ef2664d9`。它仍不等于完整 Ops 岗位权限、写流程、真实 IdP/MFA 或云端验收。

`0042_notification_delivery` 已继续封存：当前为 43 条迁移、69 表、1048 列、386 个约束和 264 个索引。账号/角色/学校范围、站内列表/已读、角色绑定偏好、学校状态、CUAC 接受提交和支付成功/取消/退款原子通知，以及 worker 租约/重试/dead-letter/unknown 隔离均通过；构建 HTTP 510/510，detached release 为 `161acf06e323e3b9f554cba56f1e2c134651414b8dc6a6eb027364fa3266abf8`。后续无 schema 变更地补齐固定阿里云 Direct Mail 通知适配器、常驻 worker、启动入口和 fail-closed 配置门禁；通知专项 24/24、完整后端 693/693、TypeScript、聚焦 ESLint 与生产构建通过。默认启动在接触数据库/网络前失败关闭。真实凭据、邮件投递/退信、调度监督、SMS 与云端接受仍是阻塞项，见 [通知 Worker runbook](CUAC_NOTIFICATION_WORKER_RUNBOOK.md)。

`0042` 后续 Ops 运营监控证据（不新增迁移或改变封存包）：`GET /api/v1/ops/operations/summary` 固定返回账号邮件、通用通知、学生文件、官方递交、支付对账五个队列的聚合计数。查询不接受 metric、时间窗、账号或其他参数，事务内重验当前 `cuac_ops/cuac_admin` 授权；响应与审计都不含用户、邮箱、文件、申请或支付标识。全量后端 `702/702`、真实 PostgreSQL `407/407`、生产构建 HTTP `513/513`、TypeScript、聚焦 ESLint及持久本地三角色 smoke 均通过；schema 和 detached release 保持不变。它不是自动告警、队列重放、完整 Ops 写流程或云端监控验收，见 [Ops 运营监控合同](CUAC_OPS_OPERATIONS_MONITORING_CONTRACT.md)。

`0042` 后续 Ops 目录要求治理证据（不新增迁移或改变封存包）：新增按精确 program/intake/version 路由绑定的内部版本读取、起草、审批、发布和撤回 API。`cuac_ops` 可读取/起草，审批、发布和撤回只允许经过密码 step-up 的 `cuac_admin`；二次验证保留当前 persona 并重验 live staff grant，双人复核、摘要绑定、revision CAS 与 metadata-only audit 继续由事务服务执行。最终全量后端 `706/706`、真实 PostgreSQL `408/408`、生产构建 HTTP `515/515`、TypeScript、聚焦 ESLint和扩展本地 smoke 均通过；Agent 工具面未增加。该里程碑当时尚未完成的 billing review 已由后续 `0043` 收口；data quality、routing、真实员工 MFA 和 staging 仍未完成，见 [Ops 目录要求治理合同](CUAC_OPS_REQUIREMENT_GOVERNANCE_API_CONTRACT.md)。

`0043_ops_payment_event_reviews` 已封存隔离支付事件人工复核：每个 quarantined provider event 至多一个 review，认领绑定当前 user/role/grant；只有原认领人可升级，只有不同的 `cuac_admin + step_up` 可按 revision CAS 关闭为 `resolved_no_change`。固定代码、有限证据引用、数据库生命周期约束和 metadata-only audit 禁止自由文本与身份注入；关闭不更新 provider event、payment、invoice 或 entitlement，也不执行重放/退款。最终专项 `11/11`、全量后端 `718/718`、真实 PostgreSQL `411/411`、生产构建 HTTP `519/519`、TypeScript、聚焦 ESLint及持久本地 smoke 均通过。当前为 44 条迁移、35 份快照、70 表、1066 列、394 个约束、268 个索引，detached release 为 `5a4b6d399cca251b02d39c414731bd29ccf0692b0ef88f0f293b53b4bd40e306`。Agent 工具面未增加；退款发起、受控补偿、真实员工 MFA、前端和 staging 仍未完成，见 [Ops 账务复核合同](CUAC_OPS_BILLING_REVIEW_CONTRACT.md)。

`0044_ops_submission_delivery_reviews` 已封存隔离官方递交 outbox 的人工复核：每个 quarantine generation 至多一个 review，认领绑定当前 user/role/grant；只有原认领人可升级，只有不同的 `cuac_admin + step_up` 可关闭或批准重试。`unknown` 与 `invalid_payload` 永不重试；只有明确 `attempt_limit + ATTEMPT_LIMIT + 5` 且无 receipt 的 generation 可复用原 outbox/group、provider/payload 绑定获得一次人工重试，部分唯一索引阻止第二次批准。最终专项 `12/12`、全量后端 `732/732`、聚焦真库 `3/3`、生产构建 HTTP `522/522`、TypeScript、聚焦 ESLint及持久本地 smoke 均通过。当前为 45 条迁移、36 份快照、71 表、1088 列、402 个约束、273 个索引，detached release 为 `114bf612ee84ff1b4cceed731c3802ffa703fa3dfbc1670c4cfebd53d2456f65`。Agent 工具面未增加；真实接收方、data quality、受控 payload/route 修复、前端和 staging 仍未完成，见 [Ops 路由复核合同](CUAC_OPS_ROUTING_REVIEW_CONTRACT.md)。

`0045_ops_catalog_quality_reviews` 已封存城市、学校、项目和奖学金的来源质量人工复核：队列固定识别缺来源、无效 HTTPS 来源、未核验、过期、争议及核验元数据缺失；每个实体/更新时间/最新 evidence generation 至多一个 review。认领绑定当前员工 grant，只有认领人可升级，只有不同的 `cuac_admin + step_up` 可按 revision CAS 确认来源、标记争议/无效，或在确实无 evidence 时无变更关闭。确认来源把实体更新为 verified 并强制 30 至 366 天复核期限；其他处置不伪造核验身份。最终专项 `12/12`、全量后端 `746/746`、聚焦真库 `3/3`、生产构建 HTTP `525/525`、TypeScript、聚焦 ESLint及持久本地 smoke 均通过。当前为 46 条迁移、37 份快照、72 表、1121 列、416 个约束、278 个索引，基线已封存到 `0045`，detached release 为 `c9527e5cd654e27182ef38e323e8bb9c41b54f8564dad767e04b8713fca3ea80`。Agent 工具面未增加；来源真实性、远端抓取、学校纠错/通用目录编辑、自动 freshness 调度、管理前端和 staging 仍未完成，见 [Ops 数据质量复核合同](CUAC_OPS_DATA_QUALITY_REVIEW_CONTRACT.md)。

覆盖开发/staging/production、任意提供方名称、关闭模式、test/live 支付、桶名伪通过、非法模式/布尔值、未知环境、开发环境伪装硬门槛、CLI 真实退出码和输出不回显秘密。CLI 子进程有期限，并只继承 OS 必需变量及合成配置，不读取真实部署凭据。

本轮在既有支付边界上增加了 `0038_auth_session_step_up`、可信密码二次验证和学生公开整套提交 API，但没有连接真实商户/学校、执行真实扣款或递交、启用模板配置或完成阿里云 staging 验收。上述本地证据不能写成学校/商户验收或部署批准，完整记录见 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

## 5. 后续完成条件

这是纠正上线误报，不是缩小产品范围。真实账号/通知邮件、真实商户支付、Ops 流程、前端联调和阿里云部署仍按 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md) 推进。真实学校/项目接收方、接收渠道、价格、材料保留期限和适用人群必须确认；同校项目保持独立，志愿/收费规则另外配置。

# CUAC HTTP 安全与游客会话合同

更新：2026-09-01。状态：后端基础实现及本地验证，不是生产上线批准。

关联：[生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)、[PostgreSQL 演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)、[安全测试计划](CUAC_BACKEND_SECURITY_TEST_PLAN.md)。

## 1. 产品与权限边界

- 前端设计基准只认 `D:\CODE\CUAC\design-lab\home-v3.html`。本轮不修改 V3、Hub、申请中心，也不从其他 demo 页面推导接口。
- 游客可使用公开目录和受限信息辅助能力；游客会话不等于账号，不产生学生、学校或管理员权限。
- 登录身份、有效角色、学校 membership、数据分类与字段投影仍由后端核验。上下文、页面状态和浏览器传来的 role/userId/schoolId 都不是授权凭据。
- 本合同没有开放完整 Agent、自然语言写库、真实支付、外部邮件或学校/Ops 完整写流程。

材料选择新增 GET/PUT，均限本人 student_action；无查询参数，PUT 严格校验选择 revision、四个来源版本及显式数组，GET 不插入默认选择。6 项网络用例覆盖会话权限、跨源/正文限制、并发单胜、审计失败、过期资料和损坏引用。此选择不含材料正文或同意，详见 [材料选择合同](CUAC_APPLICATION_MATERIAL_SELECTION_CONTRACT.md)。

## 2. HTTP 入口合同

实现位置：`frontend/src/server/shared/http-boundary.ts`、`http-config.ts`。当前 `frontend/app/api` 的 61 个显式 HTTP 方法导出统一使用 `secureApiRoute`；测试通过 AST 检查接入。教育经历与考试记录 GET/POST/PATCH/POST-remove 使用相同入口，移除必须携带版本 JSON，不沿用草稿的空正文 DELETE。项目要求 GET 与新增告知 GET 均为公开只读，不授予任何发布写权限，也不生成学生同意。新增单项目 preflight GET 为学生私有只读，另拒绝明确的跨源 Fetch Metadata，不把此规则外推为所有 GET 都检查 Origin。框架自动生成的 HEAD/OPTIONS/404/405 响应需要额外路由验证，不能仅凭导出检查推定全部安全头一致。 记忆控制新增 GET、固定 ID 空正文 DELETE、版本化 clear POST 和开关 PATCH，GET 同样拒绝非同源浏览器 Fetch Metadata；这些入口不授予 Agent 工具权限。

| 项目 | 当前规则 |
| --- | --- |
| 状态变更 | POST/PATCH/PUT/DELETE 必须通过统一入口；GET 不用于业务写入 |
| Origin | 必须与服务端配置的公开 origin 精确相等；缺失、null、外站、同站不同源均拒绝 |
| Fetch Metadata | 有 `Sec-Fetch-Site` 时，只接受 `same-origin`；缺失时仍必须通过 Origin 校验 |
| 请求格式 | 默认未压缩的 `application/json`，可带 `charset=utf-8`；顶层必须为对象，空操作也发送 `{}`。显式声明 `body: "empty"` 的草稿 choice DELETE 例外：必须零字节，不发送 `{}`，不要求 Content-Type |
| 输入上限 | JSON 最大 64 KiB；empty 模式为零字节，任何正文均 400。均按实际读取字节计数，不依赖 Content-Length；应用读取期限 5 秒 |
| JSON 结构 | 严格 UTF-8；拒绝 null/数组/原始值、非有限数字、保留属性名及超过 16 层的嵌套 |
| 路径 ID | UUID 型动态路径在调用业务层前校验；城市 slug 不按 UUID 处理 |
| 响应 | 包含 `Cache-Control: no-store`、`Pragma: no-cache`、`nosniff`、`Referrer-Policy: no-referrer` |
| 追踪 | 服务端生成 request ID，覆盖客户端同名输入；成功和受控错误响应都带该 ID |
| 错误 | 意外异常只返回通用 500，不把数据库地址、密码或内部异常正文返回客户端 |
| CORS | 不开放跨源浏览器调用；入口移除 handler 返回的 allow-origin/allow-credentials |

当前公开 catalog 也使用 no-store。以后若引入缓存，必须单独设计仅公开字段的缓存键与失效策略，不共享私有响应缓存。

统一入口提供请求体边界和 JSON 结构保护，不代表每个业务字段已完成类型、枚举、长度、范围、关联对象与敏感内容校验。各领域服务仍需有独立 DTO 白名单和 policy。empty 模式不绕过来源、权限、压缩或读取期限限制，也不改变其他 JSON 写入口的要求；当前仅草稿项目移除接口显式启用，详见 [申请提交合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md)。

常见状态：400 输入不合法；403 来源或权限拒绝；405 方法不符；408 读取超时；413 大小限制；415 格式不支持；503 部署 origin/签名配置缺失。不得通过放开 CORS、接受 null Origin 或返回内部错误来修复联调问题。

### 配置与前端接入

staging/production 必须设置 `CUAC_PUBLIC_APP_URL` 为单个 HTTPS origin，例如 `https://app.example.invalid`，不带账号、路径、query 或 fragment。Origin 比较不信任客户端的 Host/X-Forwarded-Host/X-Forwarded-Proto。未配置时，仅 development/test 的 loopback 请求可从请求 URL 推导 origin。

浏览器使用同源相对 URL，Cookie 由浏览器管理，不读写 HttpOnly token：

```javascript
const response = await fetch("/api/v1/auth/guest-session", {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
```

Origin 和 Fetch Metadata 由浏览器提供，前端不要自行构造。注册、登录、logout 等也遵守同一 JSON 合同。脚本测试客户端必须显式提供匹配的 Origin，但 Origin 本身不认证脚本或授予权限。

`file:///D:/CODE/CUAC/design-lab/home-v3.html` 是设计入口，不是生产 API origin。后续联调应把 V3 对应产品实现放在同源 Web runtime 中；不为本地文件开放 `Origin: null`。

此方案以严格 Origin、Fetch Metadata、非简单请求格式和 Cookie 属性组成当前浏览器请求边界，不是单靠 SameSite，也不是 XSS 防护。设计参考 [OWASP CSRF 指南](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。多域、嵌入页、第三方客户端等新调用方式必须重新评审，不直接绕过校验。

## 3. 游客会话入口

`POST /api/v1/auth/guest-session`

| 请求 | 行为 |
| --- | --- |
| `{}`，无有效 Cookie | 签发新游客 Cookie |
| `{}`，已有有效 Cookie | 保留绑定，不续期，也不重新 Set-Cookie |
| `{"rotate": true}` | 签发新绑定；不会合并旧绑定的数据 |
| rotate 非布尔值 | 400，不修改当前 Cookie |

成功统一返回 `200 { "data": { "status": "ready" } }`。不在 JSON 返回 token、签名或内部 guest binding；此接口不创建用户或数据库会话行。

Cookie 名为 `cuac_guest`，值包含版本、签发时间、32 字节随机数及域分隔的 HMAC-SHA256。签名校验成功后，request context 只得到 `sha256:<hash>` 绑定，而非原始 bearer token。只存 hash 不代表该标识可公开或可进入日志全文。

- 服务端有效期为签发起 24 小时，不是滑动续期；超过有效期或明显未来时间的 token 不接受。
- Cookie 使用 `Path=/; HttpOnly; SameSite=Lax`，无 Domain、Expires 或 Max-Age；部署环境及 HTTPS 请求带 Secure。
- `CUAC_SESSION_SECRET` 优先，兼容 `SESSION_SECRET`；至少 32 字符且拒绝模板占位符。生产必须使用加密随机密钥，经受控 secret manager 注入，各实例保持一致。长度检查不证明密钥熵或 KMS 已配置。
- 缺少密钥仅在 development/test 可使用本进程临时随机 key；进程重启即失效，不能用于多实例部署。
- 原先未签名的 guest ID 不再形成可信绑定，不自动迁移其所有权。
- Cookie parser 忽略无关畸形 Cookie；重复的身份 Cookie 不参与身份解析，不能凭排序挑选一份凭据。

Cookie 属性和服务端会话时限参考 [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)。当前 Cookie 名尚无 `__Host-` 前缀；正式域名与同级子域信任范围确定后，须评审跨子域 Cookie 注入及命名迁移。

## 4. 登录继承与清理

1. 注册/登录签发账号 session，同时保留当前有效 guest Cookie，方便用户随后确认继承。
2. 登录前待办消费仍需一次性 token、原浏览器绑定及当前有效账号角色。成功只返回受限导航/预览，不自动创建申请或修改 profile。
3. logout 撤销当前账号 session，并同时清除账号和游客 Cookie；前端后续对接还必须清除内存中的私人页面/聊天状态。
4. 明确“新会话”时可 rotate，但这不会清除数据库历史记录，也不会使旧 token 的其他副本立即失效。

当前游客 token 是无状态签名凭据：旧 token 被复制后，在原有效期内仍可能通过校验；显式轮换只更换本浏览器绑定，logout 也不是服务端全副本撤销。若需要即时撤销，应增加服务端会话记录/撤销版本及并发测试，不把当前实现说成已经支持。

关一个标签页不会可靠删除 Cookie，浏览器会话恢复也可能保留会话 Cookie，见 [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)。因此“不保存完整对话”必须靠数据采集与存储规则落实，不能依靠 unload 或关窗事件。

Agent memory 的完整生命周期仍未验收。原子确认后新增记忆管理/停用服务、清除时间点和候选清理批次，见 [管理合同](CUAC_AGENT_MEMORY_MANAGEMENT_CONTRACT.md)。真实网络已证明现有候选/继承 API 服从数据库开关与清除时间点；没有新增管理路由。UX/API、保留期限、调度、完整身份切换及生产验收仍待完成。

## 5. 可复跑的证据

工作目录：`D:\CODE\CUAC\frontend`。

| 命令 | 本地验收范围 |
| --- | --- |
| `npm run test:server` | 444 项单元/合同测试，含入口来源、大小、超时、错误、Cookie 签名/期限/重复值、严格要求投影、邮件密文/动作链接/有界消费者与 61 个导出接线检查 |
| `npm run db:pg:rehearse` | 330 项，含 329 个数据库子测试及外层；覆盖 24 条迁移、身份/租户隔离、challenge 原子消费及加密待发队列、资料/考试记录/草稿锁竞态、要求/告知治理及逐项目准备 |
| `npm run db:http:rehearse` | 418 项，包含 329 个数据库子测试、88 项真实网络/生命周期子测试及外层；先构建当前 API，再启动 loopback 临时服务；未新增公共 Worker 路由或启用真实邮件 |
| `npx eslint src/server tests/server scripts app/api` | 后端与 API 相关 lint |
| `npm exec tsc -- --noEmit --incremental false --pretty false` | TypeScript 无输出检查 |

BE-0714 新增真实 API 连接故障验证：空闲连接终止后进程继续运行；活动目录查询断连返回脱敏 500，不自动重放；共享池耗尽时 `GET /api/v1/health` 返回 503，解除后恢复 200。health 是数据库 readiness，成功须有本次真实探测，不是仅验证连接串，也不是独立进程 liveness。详见 [应用连接合同](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md)。

网络演练覆盖生产构建的 health/catalog/me、来源/JSON 拦截、游客初始化/保留/轮换、注册登录、跨学生隔离、动态申请路由、待办一次性继承、验证/重置、独立申请资料/教育经历/考试记录与退出。要求 GET 当前有四项网络场景：游客/账号相同投影、精确路径范围、无旧版回退、损坏已发布内容的脱敏失败，以及实际内部服务准备/批准/发布后可读、证据绑定被改后 503、撤回后 null。样本全为合成数据；内部服务不通过 HTTP 暴露，POST 不能开启写操作，逐项目检查、材料预览及本人记忆控制接入后共 61 个显式导出。考试记录另有六项网络场景，覆盖独立原始分项/版本/擦除、严格嵌套输入和归属、首建及混合操作竞争、三类审计回滚、锁等待期间角色撤销、损坏记录的脱敏 503 与显式移除；自报成绩不是官方核验结果。数据库检查证明游客初始化不创建用户，待办消费不创建申请。邮箱 challenge 由合成 fixture 创建，不发送真实邮件。

告知另有四项实际网络场景：内部准备/独立审核/发布/撤回的完整流程由公开 GET 观测；游客和登录账号得到同一九字段投影且无 Cookie 或同意写入；语言/范围/查询参数不能越界，无 POST/PATCH/DELETE 写路由；完整审核引用被修改时返回脱敏 503，紧急撤回仍可执行。真实 publish/withdraw 审计故障后旧公开指针不变。只读不表示文案已获生产批准，见 [告知合同](CUAC_NOTICE_PUBLICATION_CONTRACT.md)。

逐项目 preflight 另有四项真实网络场景：本人的准备信息和版本引用按最小字段返回，跨学生/游客/伪造身份、重复或越权查询参数及跨源 Fetch Metadata 拒绝；原始资料/分数/备注不出现，不设置 Cookie，无写方法。实际资料和草稿变动后报告版本更新，批次关闭或角色撤销后范围收紧；损坏公告证据返回脱敏 503。报告 canSubmit=false，不是同意、收费或学校已收件凭据，详见 [逐项目检查合同](CUAC_APPLICATION_PREFLIGHT_CONTRACT.md)。

HTTP 服务使用随机 loopback 端口；数据库使用本地缓存镜像与专用随机临时账号/库，数据在 tmpfs。子进程只接收白名单环境，不连接应用数据库或阿里云。演练结束清理本轮拥有的 HTTP 子进程及带匹配归属 label 的数据库容器。

该命令是 Node HTTP 客户端和简单 Cookie jar，不是真实浏览器。它以生产构建、本地 development 安全配置运行，不验证 TLS、浏览器 Secure/SameSite 行为、学校/Ops 完整网络流程或阿里云代理层。

## 6. 后续开工与上线门槛

1. 当前 Auth、学生 profile/choice 与 Agent candidate 字段白名单已本地验证，见 [Auth 输入合同](CUAC_AUTH_INPUT_CONTRACT.md)；目录规则及未来新增领域入口仍需独立 DTO 与权限验收。
2. 学生/Auth 的 16 个写方法已通过同事务审计故障验证，详见 [事务审计合同](CUAC_TRANSACTIONAL_AUDIT_CONTRACT.md)。两个申请 POST 现要求幂等键，并通过原键断连恢复测试，见 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。继续处理其他命令结果恢复与外部副作用 outbox，不把确定回滚后可重试扩大为任意错误自动重试。
3. 对齐记忆管理 UX/API，确定保留期限、分页/配额与调度；继续账号/角色切换、挑战发行竞态及并发撤权验证。
4. 在同源 HTTPS 测试站进行真实浏览器验证，包含缺失/跨域 Origin、Cookie、标签页恢复、退出和状态清理。
5. 阿里云 staging 配置 RDS TLS/最小权限、迁移/备份恢复、代理可信边界及 WAF/Gateway。共享入口必须覆盖全部 `/api/v1/auth/*`，包括 guest-session；目前 bootstrap 没有独立应用层限流 action，需验证真实限流规则及滥用成本。
6. 网关仍需连接数、请求大小与超时限制。readiness 环境变量或本地通过的测试，不能证明云上规则已经生效。外部邮件、支付与完整 Agent 继续按生产计划单独验收。

学校目标一致性新增三项真实 HTTP 验证：school_applications 队列/详情返回精确 programId/programIntakeId，生成键与学生草稿备注不外泄；同校不同项目/批次的状态和事件独立。有效老师对他校及不存在 ID 均得到 200 `{ data: null }`，其他 persona 或失效 membership 为 403；伪造身份头/查询不能切换租户，未新增学校写方法。账号与租户 fixture 为本地合成，不是员工入职/MFA 的生产验收。见 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。


逐项目材料预览新增一个受保护 POST，只读计算而非业务写操作，该预览轮次 Student/Auth 业务写方法为 26 个；材料选择保存后当前为 27 个。五项真实网络场景覆盖明确字段/记录选择、本人原始资料投影、安全头/无 Cookie、不同 persona/owner、嵌套字段/重复值/媒体类型/正文大小/路径/查询/Origin/Fetch Metadata、旧版本、当前撤权和损坏数据脱敏；读取前后全部 public 表不变。响应固定 self_review/canSubmit=false/persisted=false/consentRecorded=false，hash 不是权限，不能向学校或 Agent 传递。见 [材料预览合同](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md)。

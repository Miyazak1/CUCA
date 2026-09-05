# CUAC 应用启动与受控退出合同

日期：2026-08-31。范围：BE-0714 的本地应用生命周期验收，不是阿里云上线批准。

## 1. 当前结论

新增受控入口 `npm run start:managed`，支持停止接单、等待在途 API、关闭实际共享 PostgreSQL 池和统一退出期限。真实构建 API 与本地 PostgreSQL 已通过四个退出场景；独立 Linux 容器已验证真正的 OS SIGTERM。尚未完成完整应用镜像、ECS/RDS、负载均衡摘流及生产监控验收。

不修改现有 `npm start`、前端页面、Hub 或申请中心。产品参考仍仅为 `D:\CODE\CUAC\design-lab\home-v3.html`；不新增 SQL 迁移，不启用完整 Agent、支付、邮件或上传。

## 2. 运行入口

在 `D:\CODE\CUAC\frontend`，先由构建阶段生成当前 `dist`，再启动：

```powershell
npm run build
npm run start:managed
```

这些命令说明入口，不代表当前已有常驻数据库或已获生产部署许可。启动命令不自动构建、不迁移数据库，也不自动执行完整生产配置检查。部署编排必须另行强制 readiness/config gate、工件验证和迁移审批。

| 变量 | 默认值 | 约束 |
| --- | --- | --- |
| `CUAC_HTTP_HOST` | `127.0.0.1` | 必须为 IP 地址；云环境模板为 `0.0.0.0`，监听范围须由网络策略保护 |
| `PORT` | `3000` | 整数 1 至 65535 |
| `CUAC_HTTP_SHUTDOWN_TIMEOUT_MS` | `30000` | 整数 1000 至 120000；HTTP、业务执行和资源关闭共用一个预算 |

配置仅来自运行环境，不接受命令行覆盖。启动入口设置 `NODE_ENV=production`；这不等同于 `CUAC_ENV=production` 或配置已达到生产标准。监督进程的停止宽限必须大于应用预算并留出余量；云端信号转发、强杀期限、重启策略仍需实际验收。

`scripts/lib/app-server.ts` 复用现有 Vinext `1.0.0-beta.2` 的内部 `startProdServer`。安装控制器时检查只有一个受控 request listener；没有替换框架。框架升级后必须重新验证此内部依赖和构建输出，不能把它当作稳定公共 API。

## 3. 所有权与计数

- `scripts/start-app.ts` 拥有进程入口；`src/server/infra/http-lifecycle.ts` 统一安装 SIGTERM/SIGINT 处理器。路由模块不安装全局信号处理器，没有公开的停止 API。
- `src/server/shared/application-lifecycle.ts` 使用版本化的进程全局 Symbol 注册表，使入口源码与懒加载的构建 API chunk 共享同一生命周期。这是可信代码的内部协调，不是权限沙盒。
- `secureApiRoute` 在进入业务前登记计数，在 handler 完成或失败后的 finally 释放。HTTP 客户端提前关闭连接不会提前释放仍在执行的数据库业务。
- 首次创建应用共享池时登记 `postgres` 关闭器。真实网络测试先保持子进程存活，确认实际 API 数据库连接已归零，再允许退出；不能把进程死亡造成的断连误报为池已主动关闭。
- 已接纳请求可在 draining 阶段首次取得资源；进入 closing/closed 后不能重新创建共享池。普通运行期单独关闭、随后明确重建池的原合同不变。
- 专用迁移池不纳入应用注册表，仍由迁移作业独立管理。数据库模块新增依赖使迁移发布包白名单从四个模块变为五个，包含纯生命周期模块，但不包含 HTTP 控制器，也不启动应用或安装信号钩子。SQL 链仍为 12 条。

## 4. 停止顺序

1. 第一次停止请求将状态从 running 改为 draining；后续停止或重复信号共享原 promise，不刷新期限。
2. 停止接受新 TCP 连接，关闭空闲连接；活动响应关闭 keep-alive，尚未发送响应头时加 `Connection: close`。排队进入受控 listener 的新请求返回脱敏 503，不调用业务 handler；新建 TCP 也可能直接被拒绝，不能承诺所有客户端都收到 503。
3. 同时等待 HTTP server 关闭和已接纳 API 业务计数归零。计数包含客户端已经离开的业务，不等同于当前 socket 数。
4. 关闭已登记资源，正常信号停止全部完成后以 0 退出；资源关闭失败、server error 或截止时间到达时以 1 退出。到期销毁跟踪连接并退出，不宣称所有事务和资源已经清理成功。
5. 全过程仅一个有引用的计时器。日志限定为启动端口、事件、停止原因、结果、在途数量和受控资源名，不含数据库 URL、SQL、请求正文、账号或凭据。

最初仅调用 `server.close()` 的测试因在途响应继续 keep-alive 而超时。现主动标记响应不再保持连接并关闭空闲连接，正常排空和挂起资源测试均通过。

## 5. 验收证据

| 门槛 | 本轮结果与范围 |
| --- | --- |
| 常规后端 | `npm run test:server` 324/324；其中 8 项生命周期测试覆盖计数、拒绝新接单、幂等停止、资源错误脱敏、模块副本共享、入口配置、真实 HTTP 排空和挂起期限 |
| 构建 API + 真库 | `npm run db:http:rehearse` 133/133，含 105 个数据库子测试、27 个网络子测试和外层测试；新增四项为真实池关闭、重复信号排空、客户端断开后继续跟踪业务、未提交注册在期限退出后回滚 |
| Linux OS 信号 | `npm run test:linux:lifecycle` 3/3，含两个子测试和外层测试；实际发送 SIGTERM，分别验证正常排空退出 0 和挂起到期退出 1，均非 OOM |
| 迁移回归 | `npm run db:linux:rehearse` 7/7，新候选包保持独立执行、只读、受限网络及恢复规则；没有新增迁移 |
| 静态检查 | TypeScript、后端 ESLint 通过；API 构建通过 |

构建 API/真库测试运行于 Windows 宿主机，信号由测试 IPC 分派至实际注册的回调。Linux 测试则使用真实 OS 信号、实际生命周期源码、合成资源和 loopback HTTP，不包含构建后的完整应用或数据库。这两层证据互补，不能合并描述为完整 Linux 应用 + RDS 验收。

Linux fixture 使用缓存的精确 Node 镜像、非 root、只读 rootfs、network none、无 capabilities、禁止提权及资源限额；仅将本轮复制的三个源码/测试文件和 package.json 以只读方式挂载，不挂整个仓库或 Docker socket。测试容器和临时目录核验归属后清理。Node v22.22.3 是兼容性测试版本，不代表最新生产安全批准。

## 6. 保证之外

- JavaScript 事件循环被阻塞时，应用定时器不能保证准时退出；SIGKILL、断电和进程崩溃也不能保证执行清理。必须有外部监督期限及数据库超时。
- 本轮回滚证据仅覆盖被审计表锁阻塞的未提交注册事务，不保证所有进程死亡都意味着没有写入。已经 COMMIT 但响应丢失仍需按原幂等键核对/恢复，禁止盲目重放。
- 尚未登记的后台任务、脱离 handler 的异步工作、SSR 副作用、队列消费者及未来长连接需要单独接入生命周期。不得因当前 API 计数为零就断言这些未来任务完成。
- 退出日志可能在硬退出时来不及送达；它不是持久审计凭证，也不是数据库最终状态的权威来源。
- 独立 liveness、探测负载控制、监控告警、可信 CI/应用工件、启动环境保护、云端 TLS/连接预算、负载均衡摘流、RDS failover/恢复仍待验收。当前 managed 入口不应单独被当成生产部署方案。

下一步与整体范围见 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)，数据库异常语义见 [应用连接合同](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md)，完整测试记录见 [本地演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

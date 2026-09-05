# CUAC PostgreSQL Linux 迁移运行合同

日期：2026-09-01。范围：BE-0713 本地 Linux 运行验收，不是阿里云部署批准。

## 1. 当前结论

同一份 Windows 构建的迁移发布包，已在 Linux/amd64、非 root、只读文件系统、受限网络中完成 33 条迁移和重复执行。包外可信入口能够在执行被替换的包内启动器之前拒绝它。等待数据库锁时停止容器，作业按 SIGTERM 退出，未留下部分升级；核对状态后显式重试成功。

`npm run db:linux:rehearse` 已通过 7/7 项，即六个子测试和一个外层测试。该入口单独运行，不包含在常规后端或数据库/HTTP 演练计数中；也不同于独立的 3 项应用 Linux 信号测试。当前联合结果以 [统一演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md) 为准。

Linux 运行隔离机制没有改动；本次复跑的最终发布包追加 `0032_agent_candidate_capacity`，只增加两个待确认候选容量索引。历史 0000..0031 SQL/快照字节未改；完整 Agent、候选/记忆生产调度、Gateway/WAF 滥用控制和云端验收仍待完成，见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)。迁移包不包含 Agent worker、邮件消费者或应用服务。本轮没有修改前端页面，仍只以 `D:\CODE\CUAC\design-lab\home-v3.html` 理解产品；Agent、应用服务均不得获得迁移作业身份或凭据。

## 2. 实现与运行

在 `D:\CODE\CUAC\frontend` 执行：

```powershell
npm run db:linux:rehearse
```

实现文件：

| 文件 | 职责 |
| --- | --- |
| `config/migration-runtime.linux.json` | 固定 Node 版本、基础镜像摘要、Linux/amd64 平台 |
| `scripts/lib/pg-linux-rehearsal.ts` | 核验发布包和本地基础镜像，构造限定内容的构建目录，记录可信文件摘要 |
| `scripts/release/Dockerfile` | 复制发布包和独立 launcher，不安装依赖；文件由 root 拥有，UID/GID 为 1000:1000 |
| `scripts/release/launch.mjs` | 用包外验证器检查包，再以白名单环境启动包内入口，转发停止信号 |
| `scripts/pg-rehearse.ts --linux` | 创建本轮镜像、网络、临时数据库和测试进程，检查归属后清理 |
| `tests/server/db/linux-migration.test.mjs` | 在实际容器和数据库中验证隔离、迁移、失败恢复与篡改拒绝 |

前提是本地 Docker Linux engine、BuildKit、已批准的离线 npm 缓存及固定镜像已就绪。Windows 固定使用本机 Docker Desktop Linux pipe，其他平台使用本机 Unix socket；不接受远程 Docker context。此轮没有在原生 Linux 宿主机或 ECS 上运行控制脚本。

基础 Node 镜像由操作者提前准备；演练先核验本地缓存中的摘要和平台，不自动拉取缺失镜像。Docker 构建使用独立空配置和系统安装的 BuildKit，不读取用户 registry 登录配置；只传入明确的系统环境字段。Windows 的 `ProgramFiles` 用于发现系统插件，不向测试进程传入用户 npm 配置或应用秘密。

## 3. 两层保护

### 发布包与可信入口

1. 先生成既有按内容摘要命名的发布包，核验其 Node 精确版本与固定基础镜像一致。
2. 临时构建上下文只包含发布包、Dockerfile、独立 launcher 和 verifier，不包含 `.env`、学生数据、支付数据或前端源码。
3. 以 COPY 把包放进镜像；运行时没有仓库 bind mount、Docker socket 或可替换的包目录。
4. `/opt/cuac-launcher` 属于受信任镜像，先核对外部提供的清单摘要与包内全部文件，再启动 `/opt/cuac-release/run.mjs`。包内入口继续进行原有校验。
5. 独立 launcher 只转交数据库配置、明确目标环境和迁移批准开关；拒绝运行覆盖变量。打印结果不包含原始 SQL、连接地址或密码。

包外不等于自动可信：构建仓库、Docker daemon、基础镜像、launcher 和预期摘要来源必须可信。攻击者控制整张镜像或启动配置时，包内外校验都不能取代 CI 来源证明、签名与受保护部署记录。`NODE_OPTIONS` 的进程内检查也不能撤销已经执行的 preload，部署必须在进程启动前禁止不可信环境。

### 容器与网络

- `--user=1000:1000`、`--read-only`、`--cap-drop=ALL`、`--security-opt=no-new-privileges:true`。
- `--init`、64 个进程上限、256 MiB 内存上限、1 CPU 配额、禁止自动重启。
- 迁移容器只加入本轮 `internal` 网络，IPv4 gateway mode 为 `isolated`，关闭 IPv6；进程内验证没有默认 IPv4 路由。
- 纯校验和错误摘要场景使用 `--network=none`。
- 临时 PostgreSQL 另加入本轮专用控制网络，仅把 5432 发布到宿主机随机 `127.0.0.1` 端口，供测试程序检查状态。此网络关闭 masquerade；迁移容器不加入它。测试检查两个网络成员和实际端口绑定。
- 数据库使用 tmpfs，样本、库名、账号和密码均为临时合成数据。

`internal` 默认仍可能提供到宿主机 bridge 地址的访问，所以另外采用 `isolated` 模式。相关行为见 [Docker gateway modes](https://docs.docker.com/engine/network/port-publishing/#gateway-modes)。这不是逐端口云防火墙证明，也没有验收 DNS 外传、恶意数据库代理、宿主机入侵或内核逃逸。Agent 的 role/tenant/projection 限制仍需由自己的 Tool Gateway 和 policy 强制执行，不能以此容器演练代替。

构建的 `--network=none` 限制 RUN 步骤，不等于隔离 Docker daemon 的所有 registry 元数据请求。本次 Dockerfile 没有 RUN；生产构建器仍需独立的出网和 registry 来源策略。篡改测试使用核验过的本地临时标签，不把裸 `sha256:...` 当作 Dockerfile FROM 仓库名。

## 4. 验收矩阵

| 场景 | 实际断言 |
| --- | --- |
| 进程隔离 | UID 1000、Linux/x64、精确 Node 版本；CapEff 全零、NoNewPrivs=1；写根文件系统、包、launcher 均失败；没有挂载或 Docker socket；资源限制及网络配置符合预期 |
| 无网验证 | 同一发布包在 network none 中校验成功，输出摘要一致 |
| 受限迁移账号 | 账号无 superuser/createdb/createrole/replication/bypassrls 属性；独立目标库给予必要建对象权限；33 条迁移成功、58 张表，表 owner 为迁移角色 |
| 重复执行 | 新增的合成账号及 ledger 完整保留，appliedNow=0 |
| 停止与恢复 | 先运行 19 条，锁住 application_choices；同一事务先执行告知三表 DDL，随后在 0020 明确的目标表 LOCK 语句处等待。停止后退出码 143 且非 OOM，角色连接消失，ledger 仍为 19，完整结构与升级前一致；显式重试应用剩余 4 条 |
| 脱敏与篡改 | 错误摘要、数据库连接失败返回非零且不泄露合成秘密；派生镜像替换包内 run.mjs 后，可信 launcher 拒绝且被替换代码的标记未执行 |

迁移账号测试不是 RDS 最小权限最终方案。它拥有本轮目标库建 schema 和对象的权限，没有证明所有其他数据库的 CONNECT/default privileges 已收紧；不能把它用作应用或 Agent 账号。

停止用例只覆盖等待锁、未提交的升级。真实 COMMIT 后确认丢失的规则仍以既有迁移执行合同为准：失败不代表未提交，不得自动重放。这里不验收应用 HTTP 进程；应用排空/期限与 Linux OS 信号已有另一组本地证据，见 [应用生命周期合同](CUAC_APPLICATION_LIFECYCLE_CONTRACT.md)，云端运行与故障切换仍未验收。

## 5. 本轮发布记录

| 项目 | 值 |
| --- | --- |
| 发布包清单 SHA-256 | `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca` |
| Node | `v22.22.3`，仅作为本次兼容性验收版本 |
| 基础镜像 | `node@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752` |
| 最终成功运行镜像 ID | `sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6` |
| Dockerfile SHA-256 | `0a6f0d9773701c6ccb1fb5c56b1e46b0f67d8c0cbb77acfcd678cb19408eb498` |
| launcher SHA-256 | `9f25a4df72066b2a7ec6da9ba858dbd56c8c2ad76c2a656456662b35e59eb9da` |
| 外部 verifier SHA-256 | `de88b4b2619f6b6569698b7d83bc753f50938e3ea0028011cbc195425bc17b16` |

每轮随机资源标签会改变运行镜像 ID，不承诺镜像字节可重现；发布包摘要独立固定。成功后临时运行/篡改镜像、容器、网络和构建目录均清理，不把这张测试镜像当作已发布生产镜像；基础镜像缓存和迁移包保留。Node/OS 补丁和漏洞审批必须在生产前重新审查，固定版本不代表已达到最新安全基线。

本次因 0032 候选容量索引、快照及已审查基线更新包摘要；五个运行模块和 15 个依赖版本不变。锁屏障仍定位 0020 对 application_choices 的显式 LOCK；通过 pg_stat_activity 确认此前的告知 DDL 已执行。SIGTERM 后整个未提交事务回滚，结构/ledger 仍为 19 条；显式重试补齐当前剩余批准链至 33 条。迁移入口未启用应用 HTTP；最终包六类 Linux 场景及外层测试全部重跑通过，共 7/7。

资源清理检查随机归属 label，目录删除先检查绝对 realpath 在自有临时目录中；测试数据库和角色删除前核对 OID。进程被外部强杀或 Docker 失联不能保证 finally 执行，运维必须依据输出的 ownership token 逐项核验后清理，禁止全局 prune。

## 6. 下一步生产门槛

1. CI：受保护源版本、依赖/基础镜像扫描、构建来源证明、签名和不可变工件仓库；绑定应用版本、迁移摘要、launcher/镜像摘要、runbook 版本、审批人及恢复点。
2. 部署：在阿里云 staging 实际验证只读身份、启动环境白名单、数据库网络白名单、秘密注入与轮换、唯一迁移作业及故障清理。环境中的测试密码可被 Docker 管理者 inspect，不是生产秘密交付方案。
3. RDS：独立迁移/应用/维护身份、TLS/CA、数据库 ACL、备份/PITR、实际恢复和 failover；本轮本地证据不能替代。
4. 数据升级：领域回填、大表锁与事务预算、应用版本兼容、破坏性变更和停止/恢复流程另验。
5. 应用生命周期：BE-0714 本地 HTTP/业务排空、实际池关闭、退出期限和 OS 信号已通过。完整云端应用工件/信号/负载均衡、独立 liveness、监控与云端连接预算仍未完成。

生产总顺序见 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)，原发布包信任模型见 [发布包合同](CUAC_POSTGRES_RELEASE_ARTIFACT_CONTRACT.md)，实际迁移操作遵守 [迁移 runbook](CUAC_POSTGRES_MIGRATION_RUNBOOK.md)。

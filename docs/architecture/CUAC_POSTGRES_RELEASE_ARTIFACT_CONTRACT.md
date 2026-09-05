# CUAC PostgreSQL 迁移发布包合同

日期：2026-09-01。对应 BE-0713 的本地发布包部分。

后端已具备可脱离开发仓库执行的迁移发布包。它固定本次执行代码、SQL/计划和运行依赖，按清单摘要命名。本机包目录尚未设置只读 ACL；同包复制进 Linux 镜像后的非 root、只读、受限网络和包外校验已本地通过。不是已经签名或发布的生产镜像，阿里云部署仍须接可信发布来源、运行保护和审批流程。

## 1. 构建与内容

在 `frontend` 执行 `npm run db:pg:release`。实现位于 `scripts/pg-release.ts`、`scripts/lib/pg-release.ts`、`scripts/release/migrate.mjs`。

1. 先检查历史 SQL 字节、journal、快照链、工具版本和当前 ORM schema；保留原有受审查基线，不生成新迁移。
2. 白名单编译五个模块：迁移执行器、迁移锁/ledger 核验、数据库事务适配器、错误类型和数据库模块依赖的纯应用生命周期注册表。采用项目锁定的 TypeScript，保留 ESM 并重写相对导入扩展名；运行模块超出白名单或出现动态导入时要求重新审查打包范围。迁移使用专用池，不初始化应用注册表，不包含 HTTP 控制器或进程信号钩子。
3. 复制明确列出的 SQL、journal、baseline、快照，并由 Drizzle 从包内 SQL 生成 `migration-plan.json`。保留 schema 和构建器源码作为证据文本，不在发布端运行生成器。
4. 从现有 npm lockfile v3 提取 `pg`、`drizzle-orm` 的依赖集合，保留精确版本、registry 地址和 integrity；拒绝链接、平台专属、安装脚本、非 registry 或缺失依赖的包。
5. 在本轮自有临时目录执行 `npm ci --offline --ignore-scripts`，禁用 bin links、audit 和 fund，并使用空的用户/全局 npm 配置。构建不读应用数据库变量，不自动下载缺失缓存，不把本机 node_modules 直接当成可信发布依赖。
6. 核验实际安装的依赖目录和版本，复核构建期间源码、lockfile 与迁移基线没有改变。清单记录源文件摘要、完整文件清单、字节数、工具和 Node 版本。
7. 输出到 `frontend/releases/postgres/<manifest SHA-256>/`。同摘要目录已有且完整时复用；目录损坏时拒绝覆盖，不自动修复或重新盖章。临时构建目录核验归属后清理，发布目录已加入 gitignore。

包内没有前端页面、示例导入数据、`.env`、学生数据或支付数据。依赖自身的许可证、文档与类型文件保留。运行端不需要 npm、TypeScript 或 Drizzle Kit。

## 2. 执行顺序

可信作业应提供 `CUAC_RELEASE_DIRECTORY` 和从受保护发布记录取得的 `CUAC_RELEASE_MANIFEST_SHA256`。下列命令是接口说明，不是本次生产执行授权：

```powershell
node "$env:CUAC_RELEASE_DIRECTORY/run.mjs" --verify-only "--manifest-sha256=$env:CUAC_RELEASE_MANIFEST_SHA256"
```

`--verify-only` 不导入数据库运行模块，不连接数据库。清单摘要必须由调用方明确传入，不能从包内文件自动接受。检查覆盖全部文件内容/数量、Node 精确版本、额外文件、符号链接、硬链接和体积上限。

在 staging/production 门槛、审批和备份全部满足后，受控作业才使用：

```powershell
node "$env:CUAC_RELEASE_DIRECTORY/run.mjs" --apply "--manifest-sha256=$env:CUAC_RELEASE_MANIFEST_SHA256"
```

此时还必须明确设置 `CUAC_MIGRATION_TARGET_ENV=development|staging|production`。生产继续要求既有的 `CUAC_ALLOW_PRODUCTION_MIGRATION`、`CUAC_MIGRATION_RUNBOOK_ACK` 及非 localhost 目标等保护。数据库凭据通过部署环境的秘密管理机制注入，不写入包、不拼进命令行。

执行前拒绝 `PG_MIGRATIONS_FOLDER`、`NODE_OPTIONS`、`NODE_PATH`、`PG_FORCE_NATIVE` 覆盖。只有文件校验通过后，才导入包内数据库执行模块。使用已经读入并校验的计划，不再从可变源目录读取 SQL；仍走原有专用连接、advisory/table lock、精确 ledger 前缀、同事务执行与提交确认规则。

成功输出仅含发布摘要、目标环境和 appliedBefore/appliedNow/appliedTotal。失败输出统一提示，不打印原始 SQL、数据库地址、密码或行值；失败不说明数据库一定未提交。排查和重试仍遵守迁移 runbook。

## 3. 信任边界

- 哈希证明“与指定字节一致”，不证明发布者可信、SQL 正确或构建环境没有被入侵。预期摘要必须来自受保护记录，不能把包与包里的摘要一起无条件信任。
- 包内启动器无法证明它自身未被攻击者替换。执行前必须由可信外部验证器或容器平台验证工件/镜像摘要，并保护其来源；Linux 测试现实际构建包内启动器被替换的派生镜像，由包外 launcher 拒绝它，被替换代码未执行。整张镜像和 launcher 的来源仍必须受保护。
- 验证后还会加载 JS 和依赖，必须在部署侧使用不可改写的工件和只读文件系统来防止校验后替换。当前本机目录没有实现操作系统级不可变性；Linux 测试镜像使用无 bind mount、root 拥有文件及只读 rootfs，写入失败已验证，云端部署仍未验收。
- 进程开始后检查 NODE_OPTIONS 无法撤销 Node 已加载的 preload。运行入口必须从进程启动前就清除不可信环境和预加载选项。
- 构建端需受保护的 checkout、锁定工具链和审查过的 npm 缓存。npm integrity 不是完整供应链签名或漏洞审查；签名、SBOM 扫描、CI 证明与来源记录仍待接入。
- 不允许应用实例启动时自动迁移，也不允许 Agent 调用此作业或拥有迁移凭据。

## 4. 当前证据

当前候选包摘要：`b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。它仅标识本机候选包，不是云端批准记录。包含 33 条迁移、24 份快照、58 表、15 个运行依赖、2876 个受校验文件（17,407,969 字节，不含清单自身）；Node v22.22.3、TypeScript 5.9.3、npm 10.9.8、pg 8.23.0、Drizzle ORM 0.45.2。较前次只追加 0032 候选容量 SQL/快照及基线条目。独立比较确认既有 sourceFiles 仅 schema、journal 与 baseline 摘要改变；五个迁移运行模块、历史 0000..0031 SQL/快照、源码 lockfile 和依赖版本不变。同摘要包通过数据库 379/379、数据库/HTTP 联合 477/477 及 Linux 7/7；常规后端 523/523，各入口有重叠。迁移包不包含 Agent worker、账号邮件消费者或 HTTP 应用，不能把迁移包运行验收当作完整网站、Agent 或邮件投递验收。

`migration-release.test.mjs` 验证依赖锁提取、危险依赖拒绝、重复构建摘要相同、移到系统临时目录后独立运行、代码/依赖/计划/清单修改与额外文件拒绝、硬链接拒绝、错误版本/环境/摘要拒绝。TCP trap 证明无效包不会连接；合法包连接失败也不泄露合成密码。

`migration-release-rehearsal.mjs` 及目标升级模块的十八项真库测试验证完整迁移/schema、非空升级/no-op 和异常 ledger 拒绝。保留 revision、批次/独立旧 v1 收据、申请资料、教育经历、要求两表及审核治理升级。17 条旧迁移升级仍仅增加两个 null 字段，不伪造准备者或审核证据；新 reader 隐藏旧无证据发布，内部读取可辨认 legacy，不能直接批准成 managed。考试记录轮次另从 18 条旧迁移及合成的私有资料、教育经历、申请组/选择、v1/v2 收据和已发布 managed 要求升级：逐表比较全部原有 public 数据不变，两张考试表为空，不从旧偏好文案推断分数；首次读取不插版本头，原收据/发布关系保留，重跑为 no-op。告知轮次从 19 条旧迁移升级，包含旧 consent_summary_json 与考试自报记录的全部原 public 数据逐表不变，三张告知表为空，首次公开读取不制造告知或同意，原 v1/v2 收据与要求发布关系保留；重跑为 no-op。目标一致性轮次四项 20 条旧迁移升级用例，验证所有既有列值/收据保留，学校记录只复制已有 choice 的批次；同校另一项目和两种单边 null 错配都使升级失败，原 schema、ledger 和数据不变。旧数据读者冻结升级前的列清单，新增列另行核验，未忽略旧字段差异。0022 另从非空 22 条旧迁移升级，逐表保留旧资料/收据和停用记忆设置，新选择表为空；本人 GET 不插行，显式保存才产生选择。0023 另从非空 23 条旧迁移升级，逐表保留旧 challenge、私有资料、材料选择和收据；新队列为空，不恢复旧原始 proof 或制造待发任务，重跑 no-op。仍不代表复杂回填、大表或破坏性迁移已验收。

演练现在先构建一次，再把路径/摘要交给隔离测试进程，后者只复制和运行包，不接触 npm 配置/缓存。最初在隔离数据库进程内构建因缺少用户缓存环境而失败；现修正了流程，没有放宽环境隔离。

`db:linux:rehearse` 的六个场景及外层测试已全部通过，覆盖无网校验、受限角色迁移/no-op、只读运行、锁等待时 SIGTERM 退出与显式恢复、错误脱敏和包内启动器替换拒绝。具体网络、权限、可信文件摘要及限制见 [Linux 运行合同](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md)。

当前命令结果和容器清理记录统一见 [本地演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。Windows 宿主机上的本地 Linux 容器证据不能代替原生 Linux/ECS/RDS 部署验收。

## 5. 下一阶段

1. 固定摘要的 Linux/Node 同包运行已本地通过；下一步审查 Node/OS 补丁与漏洞基线，在可信 CI 和原生 Linux/ECS 上重验，不能把本轮兼容性版本当作生产安全批准。
2. 接 CI 测试结果、漏洞/秘密扫描、签名/证明、受保护工件存储、外部校验和只读挂载；将应用版本、迁移包摘要、runbook 版本、操作人和恢复点绑定。
3. 在阿里云 staging 验证最小权限迁移账号、TLS/CA、单作业编排、云端 smoke、备份/PITR 和失败恢复，再申请生产执行。
4. 继续领域数据升级/回填、大表与破坏性变更评审；保持完整 Agent、真实支付、外部邮件、上传及通用学校/Ops 写接口按阶段审批。

实现参考：[npm ci 的冻结安装与禁用脚本选项](https://docs.npmjs.com/cli/v11/commands/npm-ci/)、[TypeScript 相对导入扩展名重写](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html)。原迁移语义仍见 [迁移基线合同](CUAC_POSTGRES_SCHEMA_BASELINE_CONTRACT.md) 与 [迁移 runbook](CUAC_POSTGRES_MIGRATION_RUNBOOK.md)。

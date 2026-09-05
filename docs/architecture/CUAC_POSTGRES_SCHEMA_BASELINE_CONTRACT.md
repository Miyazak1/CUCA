# CUAC PostgreSQL 迁移基线与生成规范

日期：2026-09-01。

状态：已审查本地基线推进至 `0032_agent_candidate_capacity`，33 条迁移、24 份快照、58 表，已通过真实 PostgreSQL、构建 HTTP 与 Linux 发布包验证；不是阿里云上线批准。后续领域 schema 可以继续演进，不能把 Demo 的临时页面结构作为数据库设计依据。前端唯一产品参考仍为用户指定的 `design-lab/home-v3.html`，本次未读取或修改其他前端页面。

当前增量 `0032` 只为 guest/student active pending Agent candidates 增加两个精确 scope 的部分索引，不新增表、列、角色或权限。0032 SQL SHA-256 为 `3ec80be7f5fb440eccc457da94cc4c406f85c398f65cf84593b8ececc3121ad9`，快照为 `cde55939b6190ecd0c449a4c992e1f3ba9cac39285364456335fcd004a80bf38`。基线只追加 idx=32、when=1788251915379 的 journal/哈希并推进 throughIndex 到 32；旧全部 32 条 SQL、23 份快照、journal/哈希与工具版本不变。迁移不改写历史候选或其他业务数据，重复迁移为 no-op。上一条 `0031` 的有限记忆升级及其哈希保持不变。见 [候选容量合同](CUAC_AGENT_CANDIDATE_CAPACITY_CONTRACT.md)、[记忆保留合同](CUAC_AGENT_MEMORY_RETENTION_CONTRACT.md) 和 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

## 1. 初始基线修复

SQL journal 已有 12 条迁移，旧的最新快照却停在 `0001_snapshot.json`，只描述 23 张表。用该快照与当前 schema 做内存差异计算，会再次提出 13 条已经落在历史 SQL 中的建表语句。这些重复 DDL 没有应用到数据库。

现已增加 `frontend/drizzle/pg/meta/0011_snapshot.json`，表示执行完整迁移链后的 36 表状态。快照链为 `0000 -> 0001 -> 0011`；中间缺口是已审查的历史检查点，不虚构每条手写迁移的旧快照。自下一条 `0012` 起，每条迁移都必须有对应快照。

真实 PostgreSQL 对比还发现两处外键名称与 ORM 默认生成名不同。仅在 `frontend/src/server/db/schema.ts` 明确指定已有数据库名称：

- `agent_student_memory_settings_user_id_fkey`。
- `student_application_command_receipts_user_id_fkey`。

两者仍保持既有 `ON DELETE CASCADE` 语义。没有新增 SQL 迁移，没有改写原 12 个 SQL、原 journal 条目或原两份快照，也没有修改学生、学校或支付数据。

## 2. 基线组成与保护范围

| 对象 | 作用 |
| --- | --- |
| `frontend/src/server/db/schema.ts` | 当前受审查的 PostgreSQL 领域模型声明 |
| `frontend/drizzle/pg/*.sql` | 按顺序执行的历史与后续变更 |
| `frontend/drizzle/pg/meta/_journal.json` | 迁移顺序与 Drizzle 执行游标 |
| `frontend/drizzle/pg/meta/*_snapshot.json` | 生成下一条迁移时使用的 schema 状态与 lineage |
| `frontend/drizzle/pg/_schema-baseline.json` | 固定截至索引 32 的已审查 journal 前缀、SQL/快照原始字节 SHA-256、工具版本 |
| `frontend/drizzle/pg/.gitattributes` | 对 SQL、metadata JSON 和基线清单设置 `-text`，避免跨平台 checkout 改写换行 |

已验证工具版本为 `drizzle-kit 0.31.10`、`drizzle-orm 0.45.2`。版本变化时检查拒绝继续，需要另行审查生成结果、真实 schema 对比与兼容性；不能仅修改清单里的版本号绕过验证。

清单是代码审查基线，不是数字签名或访问控制。它目前固定已审查的 `0000..0032`；后续迁移的内容正确性仍需审查和真库演练。清单本身不连接数据库；执行器现在会在锁内另查全部已执行记录与 SQL hash，详见第 5 节。两者都不能单独证明生产库的实际结构或数据没有被手动改动。

历史文件按原始字节校验，不统一转换为 LF，不通过格式化历史 SQL/JSON 修复 hash 报错。若 checkout 后出现历史字节变化，应与受审查版本核对，而非重新生成清单接受变化。

## 3. 新迁移的正常工作流

从 `D:\CODE\CUAC\frontend` 执行；一次只允许一个迁移作者/生成进程：

1. 修改稳定领域 schema，明确数据分类、归属、约束和旧数据兼容方案。
2. 运行 `npm run db:pg:generate -- --name=domain_change`。名称限 1 至 64 位小写 ASCII 字母、数字或下划线。
3. 审查新增 SQL、快照和 journal 条目。生成不是批准执行；涉及删除、重命名、非空、唯一或关系约束时，必须写明历史数据检查与回滚/恢复安排。
4. 运行 `npm run db:pg:schema:check`，确认当前声明、最新快照、历史文件和工具版本一致。
5. 运行 `npm run test:server`、`npm run db:pg:rehearse` 和 `npm run db:http:rehearse`，完成类型检查与后端 lint。
6. 新迁移审查与真库验收通过后，可单独审查清单增量：只追加该条 journal、SQL/快照哈希并推进 throughIndex，不改变已有条目或工具版本。不存在自动接受历史变化的修复命令。清单变化会改变发布摘要，最终包须重跑工件、真库、网络及 Linux 门槛。
7. 按 [迁移 runbook](CUAC_POSTGRES_MIGRATION_RUNBOOK.md) 在阿里云 staging 用同一套发布工件演练迁移、最小权限、API 与恢复。
8. 满足备份、恢复、兼容性、审批和生产 readiness 后，才允许生产迁移。每个环境只允许一个迁移作业，不能在应用实例启动时各自执行。

日常不要绕过封装直接运行 `drizzle-kit generate`，也不要用 demo D1/SQLite 命令、`push` 或 `pull` 覆盖此基线。无 schema 变化时，生成命令必须明确报告 no-op，且历史文件保持原字节不变。

当前生成器在项目内部运行，限制输出目录和命名，检查历史文件未变，并验证新条目及快照顺序。它不是跨进程锁，也不保证中断后的文件原子回滚；发生失败应停下检查本次工件，不可盲目重跑或自动删除未知文件。

### 迁移时间不是普通展示时间

初始检查点 0011 的 `when = 1788228000000`，对应 `2026-09-01T02:00:00Z`，晚于初始 8 月 31 日验证时的机器时钟。0012 因此使用 `1788228000001`，0013 使用 `1788228000002`，0014 使用 `1788228000003`，0015 使用 `1788228000004`，0016 使用 `1788228000005`，0017 使用 `1788228000006`，0018 使用 `1788228000007`，0019 使用 `1788228000008`，0020 使用 `1788228000009`，0021 使用 `1788228000010`，0022 使用 `1788228000011`，0023 使用 `1788228000012`，0024 使用 `1788228000013`，0025 使用 `1788228000014`，0026 使用 `1788228000015`，0027 使用 `1788228951738`，0028 使用 `1788232277344`，0029 使用 `1788236316646`，0030 使用 `1788241229204`，0031 使用 `1788248210620`，0032 使用 `1788251915379`；后者是当前已审查前缀的最后游标，不是实际部署时间。

已核对安装版本的 `drizzle-orm/migrator.js` 与 `pg-core/dialect.js`：journal 的 `when` 被用作 `folderMillis`，原生执行器仅执行游标大于数据库最新 `created_at` 的条目。直接使用较早的 `Date.now()` 生成下一条可能被跳过，不能只靠 `idx` 增加保证原生兼容性。当前受控执行器改为先核验完整前缀，再执行剩余条目；仍强制游标递增并保持原生 ledger 格式。

封装仅将新条目的游标设为 `max(生成时间, 前一条游标 + 1)`；原条目完整保留。该值用于排序，不应作为实际部署时间，实际执行时间和操作者需在发布记录中另记。原生生成、未来时间和历史不可变测试已覆盖此情况。

## 4. 三层检查各自证明什么

### 离线工件检查

`npm run db:pg:schema:check` 不连接数据库、不写迁移文件，检查：

- journal 的索引、命名、版本、递增游标及已审查前缀。
- SQL 与 journal 一一对应，历史 SQL/快照字节未变化。
- 快照 ID/prevId 链正确，最新迁移有快照，基线之后不再允许缺口。
- 工具版本匹配，当前 ORM 声明与最新快照一致，Drizzle 差异生成也必须为零。

比较使用 JSON 可存储的语义字段；随机 snapshot ID、prevId 与原生重命名 bookkeeping 不作为 schema 内容比较，但 lineage 单独核验。列类型、默认值、检查/外键等真实 schema 字段不会被忽略。

`npm run db:pg:migrate` 在环境检查之后、数据库连接之前自动执行这一层。测试以本机 TCP trap 证明 schema 不匹配时连接次数为零。`db:pg:check` 仍只检查环境，不代替此项；直接调用底层迁移函数也不等于经过 CLI 的工件检查。

迁移作业必须携带匹配的 schema、SQL、metadata、清单和固定工具依赖，包括 dev dependency 中的 Drizzle Kit。生产 API 运行时不因此引入生成器，也不应持有迁移账号；部署时不要把迁移作业与裁剪 dev dependencies 的应用运行镜像混为一谈。

### 真实 PostgreSQL 结构对比

`db:pg:rehearse` 在本机随机、loopback-only、tmpfs 容器中执行完整 SQL 链；在同一容器另建本轮拥有的影子库，独立从当前 ORM 声明生成结构。表及唯一索引先建立，复合外键随后建立，避免引用的唯一索引尚未存在。

在合成业务数据和测试故障触发器创建前，对比 PostgreSQL 解析后的结构定义：表、列、约束、索引、非内部触发器、视图、枚举、序列定义、RLS policy、函数及意外用户 namespace。当前对比为 58 张 public 表、864 列、310 个约束、210 个索引，差异为零。

负向测试逐项改变类型、非空、默认值、部分索引谓词、CHECK、外键名称/删除行为、RLS 开关并增加意外表，确认检测到差异；每个例子 rollback 后再次确认一致。

它不比较数据、owner/ACL、实际序列计数或物理列顺序，也不是 PostgreSQL 所有对象类型的通用一致性证明。当前测试账号的建库能力不能作为 RDS 运行账号最小权限的证据。新增 domain、扩展或其他未覆盖对象前，须扩展检查范围。

### 生成器和迁移入口测试

测试复制迁移工件到受控临时目录：原生 no-op 不改变字节；测试 schema 仅新增一张标记表时，封装只生成这一张表，追加一个递增条目和快照，不重新生成旧表。该测试迁移不写入正式迁移目录、不应用到业务数据库。

最初用于生成 `0011` 检查点的一次性演练选项保留在源码中，只有真库结构一致且检查点/清单不存在时才写入；现在再次调用会拒绝覆盖。它不是日常生成、升级工具或修复历史记录的命令。

## 5. 执行互斥与历史记录核验

实现位于 `frontend/src/server/db/migration-guard.ts`、`migration-runtime.ts`；由原有 `db:pg:migrate` 调用，无新增业务 API、SQL 迁移或 Agent 权限。

### 固定执行顺序

1. CLI 先做环境与离线工件检查。底层执行器通过 Drizzle 的 `readMigrationFiles` 一次读取 SQL/分段/hash，校验计划并复制到当前执行范围，连接后不重读文件。
2. 专用迁移 pool 最大连接数为 1，连接等待上限 10 秒，`application_name = cuac:migration`；不复用应用运行 pool。
3. 使用现有同连接 READ COMMITTED 事务；先申请 `pg_try_advisory_xact_lock`，固定保留键为两个 integer：`0x43554143` 与 `1`。同一数据库的不同主机、checkout 或发布版本共用该键。
4. 未拿到锁立即失败，无自动排队/重试，不读取迁移历史或执行 DDL。拿到锁后将事务的搜索路径固定为 `public, pg_temp`，不受账号/URL 默认路径影响；系统锁/配置函数显式限定 `pg_catalog`。同时设置事务局部的单语句 60 秒、普通锁等待 5 秒、事务空闲 60 秒上限。
5. 已有 ledger 必须是普通表，不能启用 RLS/强制 RLS；对 `drizzle.__drizzle_migrations` 获取 `EXCLUSIVE ... NOWAIT` 表锁。表锁前后复核 OID，拒绝关系替换或隐藏行视图。
6. 按 `id` 读取全部已有条目，但最多取发布计划长度加一行，避免损坏账本造成无界读取。逐条检查 `hash`、精确的 `created_at` 与发布计划对应；id 必须正数递增，但允许序列正常回滚造成的空号。已有记录必须是发布计划的精确前缀，不能只比较最后一行。
7. 无历史记录时，若 public 已有表、视图、序列或外部表则拒绝自动接管。真正可初始化时，在同一事务创建 metadata schema/table；失败也回滚这些新对象。
8. 按已核验前缀长度执行剩余 SQL，并逐条写入原生 Drizzle 格式的 ledger。提交前再次核验表身份和完整记录；任何 SQL/记录错误都回滚整批待执行变更。
9. 只有事务提交成功、迁移 pool 清理完成且没有记录到连接错误才返回结果，包含 `appliedBefore`、`appliedNow`、`appliedTotal`。查询错误、COMMIT 结果不明或驱动异步错误不自动重试。

事务级 advisory lock 随事务结束释放；ledger 表锁可阻止其他普通事务同时改写记录，但 advisory lock 不会约束绕过它的任意业务 DDL。因此仍需发布作业编排和数据库最小权限，不能授予应用/Agent DDL 权限。[PostgreSQL 锁机制](https://www.postgresql.org/docs/16/explicit-locking.html)、[Advisory Lock 函数](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)

这套执行器只承载受审查、可事务执行的迁移。迁移 SQL 不得含自行 `BEGIN/COMMIT/ROLLBACK`、修改 ledger、外部副作用或 `CREATE INDEX CONCURRENTLY` 等非事务流程；没有用正则假装实现完整 SQL 安全解析。需要这些能力时须单独设计和演练，不能直接塞入当前 runner。发布工件必须固定且不可并行改写；数据库锁不解决源码生成阶段的并发写文件。

### 故障操作规则

| 情况 | 执行器行为与后续操作 |
| --- | --- |
| 另一个迁移作业持锁 | 本次明确失败；检查原作业状态，不能直接终止未知数据库会话或不断重试 |
| ledger 已被其他事务锁定 | NOWAIT 拒绝；查清持锁事务，不能跳过表锁 |
| 中间 hash/游标变化、缺失、重复或未知记录 | DDL 前拒绝，保留现场；与发布记录、工件和备份核对，不能自动改 hash、删记录或补记已执行 |
| SQL 或最终 ledger 检查失败 | 整批待执行 SQL 与记录回滚；修复尚未执行的发布工件，重新审查后再运行 |
| 连接终止或 COMMIT 确认丢失 | 不宣称失败一定未提交；显式重跑同一不可变发布计划，重新拿锁并核验 ledger，已提交则 no-op，未提交则执行剩余部分 |

本次真库测试曾实际触发驱动的未捕获异步连接错误；现专用迁移 pool 和所属连接都记录该错误并退出，不仅依赖 query Promise。此修复本身只证明迁移路径；BE-0714 后续已另行完成应用共享 pool 和真实 HTTP 的本地故障验证，见 [应用连接合同](CUAC_POSTGRES_APPLICATION_TRANSPORT_CONTRACT.md)，仍不能外推为整个网站或 RDS 已通过故障切换验收。

### 证据与限制

- 7 项新增常规测试覆盖计划/前缀、原始计划修改隔离、同连接顺序、竞争拒绝、失败不提交及无效计划不连接。
- 8 项新增真库子测试覆盖原生 Drizzle 非空库升级和旧发布拒绝、7 种历史异常、无账本拒绝接管、真实两作业竞争、额外 ledger 写锁、SQL/最终检查回滚、首次初始化回滚、真实终止本轮迁移连接及已执行 COMMIT 后合成确认丢失。用例数量不等于风险已穷尽。
- 竞争测试通过 `pg_locks/pg_stat_activity` 证明首任务确实持有 advisory lock 并等待 DDL 锁，另一个任务才尝试进入；不是仅靠延时推测并发。
- 样本非空升级保留既有记录，并验证 URL 搜索路径指向另一个含同名表的 schema 时只升级 public、其他表不变。它证明执行器兼容性，不等于业务全量历史数据、所有 schema 演进或 RDS 大表升级已验收。
- 精确前缀核验无法单独识别“尾部历史被完整删除而剩余仍是合法旧前缀”，也不能识别已执行表被手动改动。不能据此免除数据库结构核对、受保护的发布记录、恢复点一致性与最小权限。
- 所有故障注入只作用于本轮临时库和已验证所属的连接；未连接云端、未碰真实用户数据。当前结果不证明阿里云 failover、复制切换或恢复时间。

## 6. 本地验收与后续票据

`0030` 的 514/514 与 `0031` 的 521/521 常规结果是历史封存证据；当前 `0032` 为 523/523 常规、379/379 专用真库、477/477 真库与构建 HTTP 联合及 7/7 Linux 迁移，入口有重叠。发布包摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`，Linux 镜像为 `sha256:ff2198fb517f5a6c6d2201c214f4b0161f09dc4d2c1d5ea7590413d770e09de6`。下表保留初始迁移保护阶段的历史计数，当前证据以 [统一记录](CUAC_POSTGRES_REHEARSAL_REPORT.md) 为准。

以下为初次 0011 检查点及执行保护轮次的历史结果，不是当前总计；最新结果见本文开头及统一演练记录：

| 门槛 | 本地结果 |
| --- | --- |
| `db:pg:schema:check` | 12 migrations、3 snapshots、36 tables，通过 |
| `test:server` | 316/316，含 6 项快照/生成/CLI 入口和 7 项执行保护测试 |
| `db:pg:rehearse` | 106/106，含 3 项 schema 对齐及 8 项迁移执行子测试 |
| `db:http:rehearse` | 129/129，105 个数据库子测试、23 个网络子测试及 1 个外层测试 |

后两套共享数据库用例，不能相加作为独立覆盖量。测试只使用 synthetic 数据，结束后清理自己的临时目录、影子库、容器和 HTTP 进程。更详细结果见 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

BE-0713 的本地工件/结构基线、执行锁、ledger 前缀与断连处理已验证；生产交付部分仍待完成：

1. 本地已固定迁移作业的执行代码、计划和 15 个依赖，仓库外执行、摘要重现和篡改拒绝通过；同包在非 root/只读 Linux 中的迁移、包外校验和 SIGTERM 恢复也已通过，见 [Linux 运行合同](CUAC_POSTGRES_LINUX_RUNTIME_CONTRACT.md)。继续可信 CI/签名、补丁审查、云端工件保护/秘密交付和作业编排，记录预期安装版本/恢复点；本机摘要目录和临时测试镜像不等于获准发布的生产镜像。
2. 扩展到真实领域模型的非空升级、数据回填、扩展对象及破坏性迁移审批；审查大表操作与上述超时限制，不能仅调大超时绕过评审。
3. 验证阿里云 RDS TLS、受限迁移/运行账号、备份/PITR 恢复、failover 和回滚。
4. BE-0714：本地应用共享 pool 的活动/空闲断连、错误脱敏、合作式关闭、健康探测与恢复已通过；继续进程级退出期限、监控及云端故障切换。保持非幂等业务禁止盲目自动重试。

本次不授权完整 Agent、真实支付/退款、外部邮件、通用学校/Ops 写接口、上传或生产部署，也不把整体网站标记为完成。

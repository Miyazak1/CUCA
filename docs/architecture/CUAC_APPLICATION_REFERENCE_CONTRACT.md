# CUAC 申请编号合同

状态：2026-09-02 后端与数据库地基完成，`0039_cuac_application_reference` 已封存。本合同描述稳定外部申请编号，不代表真实学校、商户或阿里云 staging 已验收。

## 1. 定义与归属

`CUAC ID` 是一个 Application Set 的稳定外部引用，格式固定为 `CUAC-YYYY-NNNNNN`。一个 Application Set 表示一名学生组织的一次申请周期，可包含多个独立项目申请；因此同一集合内的学生视图、提交、账单和学校投影使用同一个 CUAC ID，但每个 Program Application 仍保持独立身份和状态。

CUAC ID 不是学生学号、登录用户 ID、学校 ID、项目申请主键或数据库 UUID。它也不是秘密、验证码或授权凭证，知道编号不能获得任何数据访问权。

## 2. 生成与稳定性

- PostgreSQL 以 UTC 数据库时钟确定四位年份，并通过 `application_reference_counters` 在每年范围内原子分配六位序号。
- 编号不从用户 ID、Application Set UUID 或其他内部主键截取、哈希或编码。
- `application_sets.cuac_id` 由年份和序号生成，二者有非空、范围和年度唯一约束；生产代码没有修改编号的命令。
- 年序号上限为 `999999`。耗尽时创建失败关闭，不回绕、不跨年借号，也不退回 UUID。
- 历史 Application Set 按 `created_at,id` 在 UTC 年内确定性回填；最早年份下限为 2020。迁移会先检查年度容量，无法表示时整批失败，不部分升级。

## 3. 数据传播

- 学生 Application Set 列表、详情和创建结果返回 `cuacId`。迁移完成后的 Application Set 必有编号；服务类型中的 nullable 仅用于旧迁移阶段的发布演练兼容。
- `POST /api/v1/student/application-sets/:applicationSetId/submit` 的接收结果返回同一 `cuacId`。
- `POST /api/v1/billing/fee-preview`、`POST /api/v1/billing/checkout-intents` 和 `GET /api/v1/billing/invoices/:invoiceId` 返回同一 `cuacId`；invoice 保存创建时的编号快照，不能用后来查询到的其他集合编号替代。
- 学校 queue/detail 投影返回 `cuacId`。`GET /api/v1/school/applications?cuacId=CUAC-YYYY-NNNNNN` 只做当前已验证学校租户内的精确查询，并继续隐藏 `pending_submission`。
- v2 学校申请必须携带编号，数据库复合外键保证它与精确 Application Set 匹配。仅为重建旧历史而保留的 v1 学校记录允许为空。

当前 student file 归属于用户，而不是某个 Application Set。没有可靠关联前，文件 API 不宣称已经按 CUAC ID 追踪；后续若增加关联，必须经过学生所有权、材料选择和提交快照边界，不能按编号进行无授权文件检索。

## 4. 权限与日志

- 学生读取始终以会话 owner 条件查询，不能提交 userId 或 CUAC ID 越权读取另一学生。
- 学校查询始终先从会话解析 active membership 与 tenant school，再附加精确 CUAC ID；请求中的 `schoolId` 不授予租户权限。
- CUAC ID 可用于客服、顾问、学校、缴费和收据沟通，但所有后台检索仍须独立的角色、用途与资源授权。当前首个正式 Ops 只读入口只支持按完整编号精确查询最小申请状态，并要求当前员工授权、固定目的码及事务审计；它不返回学生资料、材料或支付信息，详见 [Ops 申请支持查询合同](CUAC_OPS_APPLICATION_SUPPORT_CONTRACT.md)。
- 学校列表审计只记录是否使用编号筛选，不把查询值、学生投影或材料写入审计 metadata。
- Agent 不拥有生成、修改、提交或跨租户查询 CUAC ID 的权限。本编号合同先服务稳定项目能力，Agent 以后只能调用已授权的项目接口。

## 5. 发布与回退

`0039` 新增年度计数器、Application Set 生成编号、invoice 快照及学校投影约束。迁移必须由受控 runner 在应用切换前完成；旧 reader 可暂时忽略新列，但新 writer 依赖计数器和非空编号，不得在未迁移数据库上长期运行。

回退应用代码时保留 `0039` 数据、编号和约束，不删除或重分配既有编号。任何人工修复都必须保留 Application Set、invoice 和 v2 学校投影的一致关系，并留下独立审计记录。

## 6. 本地证据

- `npm run db:pg:rehearse` 两次完整通过 `399/399`，PostgreSQL 16.13；第二次同时封存基线。
- schema：40 条迁移、31 份快照、64 表、970 列、350 个约束、242 个索引。
- 并发创建 12 个 Application Set 得到同年、唯一、连续编号，重新读取保持一致。
- 历史非空数据库升级、计数器回填、invoice 快照、v2 学校编号必填、错误集合编号复合外键拒绝均有真实 PostgreSQL 证据。
- `0039` SQL SHA-256：`8b166104adf7674881e2374498938751402ffd55468c782704d2f1617a516eee`。
- `0039` snapshot SHA-256：`ff6c0920b50851b23501de4764b58fca44b527aaac050aa3d32e6398f9b3edbf`。
- `npm run db:http:rehearse`：498/498；当前生产构建 API 与一次性 PostgreSQL 联合通过。
- detached migration release：`8e39e51c3aae5e8456f14e68a0e98e8631fa722ddbd0c699029aca4b6d92922a`。

仍待完成：产品前端接线、完整 Ops 身份供应链与支持访问会话、真实支付/学校回执展示、云端迁移与恢复演练、浏览器 staging 验收。CUAC ID 和首个最小 Ops 查询完成不等于核心平台已经获得生产发布许可。

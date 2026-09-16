# CUAC 真实目录迁移交接与演练规程

日期：2026-09-10
状态：迁移入口已就绪；CSCAlite 已无可迁移目录数据，本路线转为备用导入能力

## 当前结论

CUAC 当前仓库只包含示例和本地合成目录。产品方已确认 CSCAlite 不再保有相关目录数据，因此不再等待 CSCAlite 导出包，也不得把 `public/cuac-data.js`、`seeds/catalog.sample.json`、`seeds/catalog.local.synthetic.json` 或旧数据库整体当作生产目录。

正式目录改走 `docs/catalog-official-acquisition.md` 定义的官方来源采集与人工审核路线。本文件保留为未来接收合规批量目录包时的安全导入契约。

源系统导出必须是单向、只读操作，由拥有 CSCAlite 清理上下文的一方完成。CUAC 只接收清理后的 JSON 包，不连接、不修改也不恢复旧数据库。

## 交付包版本

- `version: 1` 只用于示例和本地合成数据。
- 真实目录必须使用 `version: 2`，并包含 `handoff` 审查清单。
- `handoff.cleanedExportName` 只能是文件名，不得泄露源机器路径。
- 清理后导出文件和源 schema 必须分别提供小写 SHA-256。
- `sourceReadOnly` 与 `prohibitedDataConfirmedExcluded` 必须明确为 `true`。
- `reviewReference` 与 `prohibitedDataReviewReference` 应填写可审计的工单、评审记录或版本号，不能填“待定”。

版本 2 头部示例：

```json
{
  "version": 2,
  "generatedAt": "2026-09-10T00:00:00.000Z",
  "handoff": {
    "sourceSystem": "CSCAlite reviewed export",
    "cleanedExportName": "catalog.cleaned.json",
    "cleanedExportSha256": "64-character lowercase sha256",
    "sourceSchemaSha256": "64-character lowercase sha256",
    "reviewReference": "catalog-cleanup-review-reference",
    "prohibitedDataReviewReference": "catalog-prohibited-data-review-reference",
    "approvalRecordedAt": "2026-09-10T00:00:00.000Z",
    "sourceReadOnly": true,
    "prohibitedDataConfirmedExcluded": true
  },
  "cities": [],
  "schools": [],
  "programs": [],
  "scholarships": []
}
```

摘要值是格式示意；占位值不能通过评审。

## 当前写入白名单

| 实体 | 可写字段 |
| --- | --- |
| City | `slug`, `nameEn`, `nameZh`, `region`, `province`, `status`, `sourceUrl`, `sourceLabel`, `capturedAt`, `sourceFieldLineage` |
| School | `slug`, `nameEn`, `nameZh`, `citySlug`, `schoolType`, `region`, `status`, `sourceUrl`, `sourceLabel`, `capturedAt`, `sourceFieldLineage` |
| Program | `slug`, `schoolSlug`, `nameEn`, `nameZh`, `degreeLevel`, `teachingLanguage`, `tuitionText`, `status`, `sourceUrl`, `sourceLabel`, `capturedAt`, `sourceFieldLineage` |
| Scholarship | `slug`, `title`, `schoolSlug`, `programSlug`, `providerName`, `fundingLevel`, `amountText`, `status`, `sourceUrl`, `sourceLabel`, `capturedAt`, `sourceFieldLineage` |

白名单之外的字段会失败关闭，不会被静默丢弃。需要新增目录字段时，应先扩展 CUAC schema、DTO、写入器、公开读取和测试，再修改白名单。

`sourceFieldLineage` 至少要把一个实际导入字段映射到清理后源字段；映射键必须是该记录中真实存在的导入字段。来源 URL 必须使用无凭据 HTTPS。slug 必须是小写 kebab-case，引用必须完整，奖学金关联的 program 必须属于声明的 school。

## 禁止进入迁移包的数据

禁止任何用户、学生、申请、员工权限、认证、支付或私有文件数据。代码会显式拒绝常见敏感字段，包括密码/盐、密钥/token、用户和申请 ID、银行卡/CVV、护照号、生日、个人邮箱/电话以及文件字节。

旧库中的下列数据域即使字段名不同也必须在导出阶段排除：

- 用户、会话、登录凭据和权限成员关系；
- 学生资料、申请、选择顺序、材料、同意和提交记录；
- 支付、发票、退款和商户事件；
- 私有文件、证件、成绩单及其对象存储引用；
- 内部备注、支持会话、审计日志和 Agent 记忆；
- 未经审核的联系方式、收件人、价格、录取规则或法律文本。

## 执行顺序

1. 将清理后的版本 2 JSON 放到仓库外或被 Git 忽略的位置。
2. 离线校验并生成不可覆盖的报告：

   ```powershell
   node scripts/catalog-seed-dry-run.ts <bundle.json> --report=<validation-report.json>
   ```

3. 评审错误、实体数量、操作顺序、bundle SHA-256 和 operation-plan SHA-256。相同输入应得到相同摘要。
4. 只在 Docker Desktop 可用时运行一次性演练：

   ```powershell
   node scripts/pg-rehearse.ts --catalog-seed=<bundle.json>
   ```

   此入口创建随机命名、仅回环绑定、内存文件系统 PostgreSQL，执行迁移、原子导入、重复导入、来源证据和公开目录查询检查，最后按 ownership label 删除容器。它不会读取应用的 `DATABASE_URL`。

5. 评审演练结果后仍不得自动写入持久本地库或云数据库。把批准包接入用户控制的本地运行时或 staging，需要新的明确授权和独立变更计划。

## 强制保护

低层 `catalog-seed-import.ts` 也会拒绝未明确声明为 `disposable` 的目标，并要求 PostgreSQL 位于 loopback、数据库名以 `cuac_rehearsal_` 或 `cuac_catalog_rehearsal_` 开头、URL 无查询参数或 fragment。生产、staging、远程主机以及当前持久本地库都会被拒绝。

所有目录写入在单个数据库事务中执行；校验失败时不发出 SQL，写入中途失败时整包回滚。

## 未来批量导入所需交付

- 经审核的目录包及 SHA-256；
- 对应源 schema SHA-256；
- 明确的清理评审和禁止数据评审引用；
- 每个白名单字段的来源映射；
- 来源网页、采集时间、发布状态及编辑确认；
- 对权威收件人、费用、申请规则和时效的单独产品批准。

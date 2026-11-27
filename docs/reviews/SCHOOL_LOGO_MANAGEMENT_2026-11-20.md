# 学校校徽统一管理与验收（2026-11-20）

本轮实现已完成并在本地验收，未推送、未部署，未连接线上数据库。

## 使用方式

- 后台入口：**目录管理 → 学校 → 学校校徽**。保存学校记录后可上传、预览、替换或移除校徽；当前没有校徽时显示占位图标。
- 管理员先完成现有二次验证才能写入校徽。普通运营可查看，学校租户、学生和匿名用户不能修改；每次写入还会在事务中重新核对有效员工授权。
- 支持 **PNG、1 MiB 以内、16–2048 像素、非交错 8-bit**。服务端校验实际文件内容、CRC、解压后大小和像素行，移除元数据，拒绝 SVG、动画、损坏或超限图片。
- 校徽按照学校 UUID 关联，前端不再按学校名字匹配本地图片。学校列表、项目列表、学校/项目详情共享数据；学校类型奖学金使用其明确关联学校的校徽，政府类资助方不借用学校印章。

## 新增学校与批量维护

学校数据包中的每个 `schools[]` 可以附带以下字段，文件相对于导入根目录（默认项目根目录）：

```json
{
  "logo": {
    "file": "public/catalog-design-assets/example-school.png",
    "sourceUrl": "https://university.example/brand/logo.png",
    "sourceNote": "素材来源与核验说明"
  }
}
```

上例为配置示例。既有 `CatalogSeedWriter.writeBundle` 会先校验本批所有校徽文件，再在写学校资料时同步写校徽。路径解析禁止越出指定根目录，包含符号链接解析后的越界；不远程抓取上传 URL。导入回执 `logos` 分开记录 supplied、written、keptExisting 和 missingSchoolSlugs。未提供素材仍允许导入学校，并明确列为待补齐。

批量导入默认只填充从未有过校徽记录的学校，**不覆盖后台上传、替换或移除过的记录**。本地维护入口（默认只预览）：

```powershell
node scripts/school-logo-import-local.ts
node scripts/school-logo-import-local.ts --apply
```

该命令仅使用经过校验的 `.cuac-local/runtime.json` 和本地固定数据库身份，不使用线上连接配置。其他数据包可按参数传入清单路径。

## 存储、版本与发布衔接

- `school_logo_versions` 存储经过校验的 PNG、SHA-256、尺寸、来源、内部核验备注、操作者和时间，按 school_id/version 追加历史。图片进入现有 PostgreSQL，随数据库备份迁移，不依赖开发电脑路径。
- 上传和移除使用当前校徽版本 `If-Match`，学校行锁串行化操作，旧版本返回 409。移除追加空版本，保留旧素材历史，不直接擦除旧文件。
- 图片经同源 API 输出 PNG 和 ETag；公开图片与公开元数据均只对 active 且 verified/stale 的学校开放。内部备注及操作者不进入公开响应。后台草稿预览也必须经过权限检查。
- `0080_school_logos.sql` 新增版本表；`0081_school_logo_initial_assets.sql` 包含 12 张初始图片的可移植数据与真实来源，已有校徽历史一律跳过。正常发布迁移因此能够初始化首批素材，不需要把本地数据库临时导出到线上。
- 两个迁移仅在本地执行，本地共 82 个迁移已应用。未来发布须走现有的数据库迁移再启动新版应用流程；本轮未执行线上迁移或发布。

## 验收清单与统计口径

以下是 **9 个功能验收项**，不是新增 bug 数。**72 个相关自动化测试通过，0 失败**；另有数据库事务演练、HTTP 检查和浏览器操作，分别统计，不相加为问题数。原反馈表和历史 BUG/TC 总数不变。

| 编号 | 验收内容 | 测试及结果 |
| --- | --- | --- |
| LG-01 | 学校 ID、统一存储、版本和来源 | 新增 schema/迁移；DTO 与 SQL 契约；12 张素材已入本地统一存储。7 个公共 shell/首页/国际化保护文件哈希保持一致 |
| LG-02 | 新学校随资料导入、文件边界和缺失清单 | 4 个导入测试；真实临时 PNG；不合法图片在任何学校 SQL 写入前被拒绝；资料与校徽在同批导入；未附素材列入回执 |
| LG-03 | 权限与请求安全 | 角色/二次验证/撤销授权自动化；真实 HTTP 匿名管理请求 403、跨站 PUT 403；公开响应无内部备注 |
| LG-04 | 上传、预览、替换、移除和冲突 | 本地合成学校事务演练：版本迁移、预览、409、移除及历史保留均通过；演练临时学校和变更已回滚 |
| LG-05 | 真后台操作与恢复 | 通过已有合成管理员的正常密码、MFA、二次验证流程；实际文件选择预览；北京大学校徽 v1→v2 替换→v3 移除→v4 恢复，当前图片与初始素材相同，来源不变 |
| LG-06 | 关联前台同步 | 移除后学校列表实际显示占位；恢复后学校列表、项目列表和项目详情都读取同一 schoolId 的 v4。HTTP 图片 200、实际字节摘要匹配；条件请求 304 |
| LG-07 | 六语与移动端 | 学校列表/项目列表/学校详情 × en/vi/th/id/ms/ar × 1280/375px：36 组。均保留 footer 16 链接、无横向溢出，校徽正常解码；一次尚在解码的观测已单独复查通过。后台 1280/375px 两组无溢出；项目详情另实看 1 个场景 |
| LG-08 | 学校未保存内容保护 | 校徽保存与 409 刷新仅替换校徽区域，不整页重载；3 个编辑器回归覆盖保留学校草稿、dirty 状态及超限文件无网络写入 |
| LG-09 | 首批数据与原功能不回退 | 初始 12 个 PNG 的迁移摘要自动化；全新合成学校初次迁移、重复执行、后台覆盖保护真实 PostgreSQL 演练通过；72 项相关回归、TypeScript、ESLint、资源闭包/版本检查通过 |

当前 100 条公开学校记录中 12 所有校徽。其余素材继续待补齐；现有 12 张原本来自维基资源，迁移保留真实来源并明确“待官方来源核验”，没有改成“学校官方已核验”。校徽功能完成不等于素材核验完成。

本轮未修改首页或公共导航/footer，也未改动原招生时间窗判断。详情页新增校徽及相应资源版本；既有四语目录长正文待翻译、线上 301 和真机 iPhone Safari 的历史约定不变。

## 可重复检查

```powershell
node --test tests/server/catalog/school-logo.test.mjs tests/server/catalog/school-logo-import.test.mjs tests/server/catalog/catalog-mappers.test.mjs tests/server/catalog/catalog-seed-contract.test.mjs tests/server/catalog/catalog-seed-writer.test.mjs tests/server/catalog/postgres-repository.test.mjs tests/catalog-design.test.mjs tests/catalog-list-public-contract.test.mjs tests/school-logo-editor.test.mjs tests/server/infra/public-release-assets.test.mjs
node scripts/local-school-logo-acceptance.mjs
node scripts/public-asset-versions.mjs
```

`local-school-logo-acceptance.mjs` 对固定本地环境执行真实数据库演练，临时合成学校及其校徽、审计变更在事务末尾回滚。后台实际恢复所产生的校徽历史按设计保留；未保存任何测试学校名称修改。

证据目录：`E:\CodexData\build\CUCA\school-logo-management-20261120`。包含自动化、类型、lint、迁移、数据演练、HTTP、重复导入、保护文件审计、36 组浏览器记录和后台/详情桌面手机截图。调试期间添加的临时诊断代码已按修改前内容恢复，临时一次性验证码文件已清理。未运行整站生产构建，未推送或部署。

## 2026-11-21 素材与展示验收更新

上述 12/100 和“待官方核验”为 11 月 20 日历史状态；当前为 100/100，原有 12 张已逐项官方核验并替换。详情页占位蓝框缩小校徽的问题也已修复。完整统计、逐校来源、测试映射及后续迁移保护见 [100 校官方校徽验收](SCHOOL_LOGO_OFFICIAL_COVERAGE_2026-11-21.md)。未部署。

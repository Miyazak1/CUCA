# CUAC 奖学金富数据第一批发布记录

- 发布状态：已发布到本地 CUAC PostgreSQL，并通过页面验证
- 用户批准时间：2026-09-11T04:02:52.833Z
- 审核引用：`user-chat-approval-2026-09-11-b4a010af88f9`
- 已批准草稿哈希：`b4a010af88f94136027a56e737dc9a0a823b9e5bd014f42220b6c8d00ab84c59`
- 最终增量发布包哈希：`2a35cb96142bf9e6862a3a693342b6079f44129c82aa360ec8e75924536f4db7`
- 发布范围：10 个依赖城市、20 所依赖学校、20 条奖学金；未回灌历史奖学金

## 验证结果

- PostgreSQL：20/20 条记录为 `active` 和 `verified`，富字段及来源证据完整。
- 列表 API：381 条公开记录；本批 20/20 可检索，适用学位与项目字段可用。
- 详情 API：20/20 返回介绍、资助、资格、材料、步骤、截止日期/说明、适用范围及来源。
- 历史数据：此前归档的 5 条奖学金仍为归档状态，没有被增量发布恢复。
- 页面：奖学金列表显示资助级别、学位、截止日期、资格、材料和下一步；详情页显示已验证来源和完整富数据。
- 自动化：目录、发布安全、映射及仓储测试通过；奖学金列表前端契约通过；生产构建通过。

## 可追溯文件

- 审核清单：`docs/reviews/CUAC_SCHOLARSHIP_BATCH_01_REVIEW.md`
- 审批记录：`seeds/catalog.scholarships-rich-batch-01.approval-verified.json`
- 最终增量包：`seeds/catalog.scholarships-rich-batch-01.approved-verified.local.json`
- 最终验证报告：`seeds/catalog.scholarships-rich-batch-01.publication-verification-final.json`
- 官方来源注册表：`catalog-sources/official-sources.json`

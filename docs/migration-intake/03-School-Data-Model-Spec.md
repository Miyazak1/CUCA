# 院校库数据模型规范（严格参考版）

## 1. 参考基线（已冻结）
- 参考项目路径：`D:\工作文件\国内大学信息收集`
- 结构基线：`backend/init-db.js` 中 `schools` 建表与后续 `ALTER TABLE`。
- 数据基线：`backend/data/schools_merged.json`（当前 34 条样本）。
- 冻结日期：2026-04-23

说明：
- 本项目在业务语义上严格参考该基线。
- 本项目技术实现采用 `PostgreSQL + Prisma`，不继承 SQLite 演进式迁移脚本。

## 2. 领域目标
- 为“院校查询、选校下单、后台运营”提供统一数据底座。
- 支持“导入层 + 运营层 + 审计层”分层。
- 支持后续推荐、论坛关联能力的扩展。

## 3. 数据分层
- `schools_raw`：原始导入层，保留来源原貌，禁止直接对前台输出。
- `schools`：标准业务层，前台与后台统一读取。
- `school_change_logs`：字段级变更审计。
- `school_snapshots`：发布快照（V1 可选，V1.1 推荐启用）。

## 4. `schools` 字段范围（V1）
### 4.1 基础与展示
- `name_zh`、`name_en`、`rank`
- `school_type`（`regular` / `partner`）
- `guaranteed_admission`
- `tier_en`、`region`、`logo_url`
- `official_website`、`application_system_url`
- `english_programs`、`notable_programs`、`campus_facilities`
- `program_fields`（json array）

### 4.2 申请要求
- `admission_level`（json array）
- `hsk_requirement`、`hsk_notes`
- `csca_requirement`、`csca_required`、`csca_requirement_note`
- `undergrad_requirements`、`postgrad_requirements`、`preparatory_requirements`
- `language_of_instruction`（json array）
- `under_18_guardian_required`、`under_18_requirement_note`

### 4.3 语言细项
- `hsk_min_level`
- `hsk_chinese_min_level`
- `hsk_chinese_min_listening`
- `hsk_chinese_min_reading`
- `hsk_chinese_min_writing`
- `hsk_chinese_conditional`
- `hsk_english_required`
- `hskk_required`
- `hskk_chinese_min_level`
- `hskk_chinese_conditional`
- `english_required`
- `english_min_ielts`
- `english_min_toefl`
- `english_requirement_note`

### 4.4 轮次与时间
- `round1_deadline`、`round2_deadline`
- `round1_open_date`、`round1_close_date`
- `round2_open_date`、`round2_close_date`
- `application_steps`

### 4.5 费用与奖学金
- `tuition_summary`
- `tuition_by_category`（json）
- `application_fee`
- `insurance`
- `accommodation_cost`
- `accommodation_type`
- `scholarships`（json array）

### 4.6 联系与规模
- `contact_tel`、`contact_email`、`contact_address`
- `year_established`
- `student_count`
- `students_served`

### 4.7 治理字段（本项目扩展）
- `status`（`draft` / `published` / `archived`）
- `source`、`source_id`
- `data_quality_score`
- `last_verified_at`
- `created_at`、`updated_at`
- `deleted_at`（软删除）

## 5. Prisma 落地约束
- 采用 `School` 主模型，复杂结构使用 `Json`。
- DB 侧用 snake_case，Prisma 侧用 camelCase，统一 `@map`。
- 布尔字段统一 `Boolean`，禁止 0/1 混写到 API 层。
- 时间字段优先 `DateTime`；原始文本日期在 `*_raw` 或专用文本字段保留。

## 6. 查询与索引
- `idx_schools_status_rank`：`(status, rank)`
- `idx_schools_type_region`：`(school_type, region)`
- `idx_schools_csca_hsk`：`(csca_required, hsk_min_level)`
- `idx_schools_deadline`：`(round1_deadline, round2_deadline)`
- 文本检索预留：`name_zh`、`name_en`、`program_fields`

## 7. 导入发布流程
1. 原始数据进入 `schools_raw`（CSV/JSON）。
2. 清洗映射到 `schools`（默认 `draft`）。
3. 后台校验后发布为 `published`。
4. 发布与编辑均写入 `school_change_logs`。

## 8. 与参考项目差异声明
- 继承：字段业务语义与学校信息表达方式。
- 不继承：SQLite、硬编码管理员账号、无版本迁移模式、硬删除行为。
- 当前参考数据仅 34 条，不能替代正式生产数据基线。

## 9. 验收标准
- 参考项目关键字段语义覆盖率 >= 95%。
- 发布态学校必须具备：名称、类型、地区、至少一项申请条件、至少一项费用信息。
- 导入数据可追溯（`source/source_id`）且变更可审计。

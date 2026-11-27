# Homepage restoration — 2026-11-19

The rejected homepage redesign was restored locally from GitHub branch `origin/codex/release-baseline`, commit `df5c6c28beaee72a55a2df6bee94fd665327edc8` (verified after fetch).

- Restored the original homepage HTML, CSS, behavior, translation dictionary and corresponding acceptance expectations.
- Restored redesign-specific catalog helper changes and release asset configuration.
- Archived the new homepage route, flip controller, media, fonts, tests and review document outside active source directories.
- Retained the independent shared-shell fix giving the mobile sign-in button a localized accessible name. Its asset hash and HTML references were regenerated.
- Existing committed multilingual, footer/layout, admissions and catalog corrections remain in the selected baseline.
- No database changes, commits, pushes or deployments were performed.

The complete prior working state is preserved in `output/homepage-redesign-backup-20261119/`: `working-tree.patch`, original files under `files/`, archived additions under `removed-additions/`, and `manifest.json` enumerating the exact scope.

Validation: 56 automated tests passed, 0 failed (`restore-tests.log` in the backup directory). Production build passed (`restore-build.log`); asset-version validation passed (83 assets / 219 references). Homepage CSS, JS and translation dictionary exactly match the baseline; its HTML differs only in the retained shared-shell fix's asset version. This restoration does not inherit the rejected redesign's visual acceptance results.

## 恢复后二次复查（2026-11-19）

**结论：在下述核查范围内，没有发现本次恢复回退此前的国际化、footer、卡片语言跳转或招生状态修复。未推送、未部署；本轮未修改业务代码、数据库结构或目录内容。**

### 统计口径

- 本次新增确认的恢复回退问题：**0**。本地环境故障 **1 项，已恢复**（测试数据库停止，启动并完成 PostgreSQL 恢复后应用健康）。它不计入产品回退问题。
- 已提交修复源文件：**164 个**完成对照，非预期差异 **0**。严格校验仅允许移动登录按钮新增 aria-label，以及对应 shared-shell 缓存版本差异。
- 自动化测试：**77 个通过 / 0 失败**。这是替代首次恢复 56 项检查的扩展测试集，不相加为 133 项。
- 浏览器页面/布局检查：**31 组通过**；实际整卡键盘跳转：**24 次通过**；招生状态详情：**2 个场景通过**。这是不同维度，不能加总为问题数。
- 本地目录 API：**105 次只读请求通过**；检查 100 个当前可申请项目及其返回的 101 条开放窗口；另检查 1 个过期项目，其开放窗口为 0。
- 原问题清单和历史 TC 编号沿用原有映射；本轮没有重新执行原表全部问题，不据此重写历史总问题数或将全部历史问题标成通过。

### 逐项复查清单

| 复查项 | 既有问题 / 测试关联 | 本次验证 | 结果 |
|---|---|---|---|
| R01 已提交修复保留 | 3b6cc75、4a8a4d1、df5c6c2 | 对照三次提交涉及的 164 个文件，另严格核对保留的 aria-label 差异 | 通过，无非预期源文件差异 |
| R02 首页六语结构和文案 | BUG-27 / TC-03、TC-33 | en/vi/th/id/ms/ar × 1280px/375px，共 12 组；13 个 section 保留、标题翻译、正文无横向溢出 | 通过 |
| R03 footer 导航不丢失 | BUG-23 / TC-23、TC-33 | 31 组页面检查均保留 12 个 footer 导航链接；正常站内链接携带所选语言 | 通过；显式“英语原文”入口按设计允许 lang=en，法律页面仍明确标注英语版 |
| R04 footer 与页头/首页同宽 | BUG-44 / TC-41 | 首页及学校详情各六语 × 两宽度；额外项目、奖学金、指南、洞察页面。1280px 时公共 footer 宽 1216px，详情正文独立为 1180px | 通过，footer 不再随详情正文收窄 |
| R05 阿拉伯语右对齐 | 原 footer 对齐复查记录 | 测量品牌图片和品牌列右边界，1280px/375px 均一致；同时检查 RTL、无横向溢出 | 通过 |
| R06 卡片跳转保留语言 | BUG-02、BUG-30 / TC-06、TC-39 | 四类目录（项目/学校/奖学金/城市）× 六语，真实 Enter 激活整卡并检查最终 URL，24 次 | 通过；本轮未重复历史鼠标/Space 全矩阵 |
| R07 招生状态不误报开放 | BUG-12 / TC-05 | 自动化覆盖缺失、无效、关闭和有效日期及 SQL 时间窗；105 次本地 API；开放/过期项目详情各 1 个 | 通过；开放项目有真实 intakeId，过期项目无开放窗口或 intakeId 入口 |
| R08 目录正文翻译保留 | BUG-53、BUG-57 / TC-48、TC-49、TC-52、TC-54 | 词库、manifest 与恢复基准一致；越南语学校和项目详情正文实测；保留官方名称与原文链接 | 越南语既有修复保留；th/id/ms/ar 目录正文原本仍 pending，继续列为遗留，不标完成 |
| R09 指南和洞察翻译保留 | 既有 editorial 国际化验收 | editorial-i18n 自动化通过；vi 文档指南、vi 洞察文章、ms 文档指南实测标题和已发布正文 | 通过；指南只对已发布内容负责，扩展章节原有“准备中”说明保留 |
| R10 白屏防护与缓存版本 | 既有目录详情、路由及缓存验收 | 列表/详情/语言/导航相关自动化；浏览器记录均有有效标题；首页数据 ready、7 个分类、4 个学校链接；资源版本校验 83 assets / 219 references | 通过；未把数据库停止期间的失败占位算作成功数据加载 |

### 证据与边界

- `output/restore-audit-20261119/source-audit.json`：164 文件与允许差异的逐项记录。
- `automated-tests.log`：77 项测试结果，覆盖国际化、目录列表/详情、语言导航、续接、编辑内容、资源版本及招生服务/SQL。
- `browser-results.json`：31 组页面数据、24 次整卡跳转、开放/过期 2 个场景；手机为浏览器视口，不是真机 Safari。
- `catalog-api.json`：105 次接口结果及各条招生窗口的开放/截止时间；此检查没有提交申请或写入测试业务数据。
- `footer-vi-1280.jpg`：恢复后越南语首页 footer 实拍；`scholarship-ar-1280.jpg` 为阿拉伯语奖学金详情截图，footer 右对齐结论以记录中的 DOM 实测为依据。
- `restored-home-vi.jpg`：恢复后的首页预览。
- 以上相对证据文件均在 `output/restore-audit-20261119/`；原始回滚备份仍在 `output/homepage-redesign-backup-20261119/`。

没有沿用 11 月 18 日被否定首页方案的视觉通过结果。未重跑原先 876 组全站 footer 矩阵、登录后完整提交申请、真实 iPhone Safari 或线上 301；既有线上 301 / 真机暂缓约定不变。th/id/ms/ar 的目录正文待翻译是恢复前就存在的遗留，与本次恢复无关，后续仍需完成。

2026-11-20 后续：学校、项目、奖学金列表设计迁移及本轮验收独立记录于 [CATALOG_LIST_MIGRATION_2026-11-20.md](CATALOG_LIST_MIGRATION_2026-11-20.md)。首页、公共 shell、详情页和国际化运行文件与本轮迁移前的 10 项哈希核对一致；本记录的历史 BUG/TC 和统计口径不变。

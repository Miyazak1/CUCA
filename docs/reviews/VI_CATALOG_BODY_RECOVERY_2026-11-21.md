# 越南语目录正文加载恢复回归 — 2026-11-21

本轮只修复本地目录正文翻译加载和提示的恢复问题；未推送、未部署。实际服务为 `http://127.0.0.1:53118`，使用已有本地数据库。

## 问题与测试映射

问题数为 **2，已修复 2**。自动化测试为 **67 项，67 通过**，其中正文翻译文件包含 10 项（原有 4 项、新增 6 项）；测试用例数不计入问题数。浏览器页面检查为 **6 类页面 × 2 个视口 = 12 组**，另记录一次故障恢复流程及一次原文/语言切换流程，不重复计作新问题。

| 问题 | 原因及修复 | 对应测试 | 结果 |
| --- | --- | --- | --- |
| VI-R01 正文翻译不可用后无法自行恢复 | 原先 manifest 和译文共用一次 8 秒超时；冷启动或临时网络故障后永久停在 unavailable。本地实际资源均返回 200，刷新能恢复，译文文件未缺失。现改为每次请求组独立 15 秒超时，最多 3 次，短暂退避；永久 4xx（408/429 除外）不自动重试；失败后显示五语重试按钮。保留等候记录，恢复时重新收集正文候选并翻译当前 DOM，无需刷新。 | `catalog-content-i18n.test.mjs`：冷启动超时后使用新信号；manifest/字典 503；持续失败次数上限及按钮恢复；404/未就绪分支；无效字典。真实手机宽度故障代理：503 降级 → 恢复资源 → 实点重试。 | 通过；原文仍可读，按钮恢复后 IELTS/TOEFL 和申请说明翻为越南语，URL 和记录未切换。 |
| VI-R02 列表“查看英文原文”入口被覆盖 | 正文加载器提前接管提示后，列表标签渲染器仍按 `data-catalog-copy` 替换整段文本，删除链接。现接管时移除旧标签归属，保留独立正文提示、英文原文链接和重试按钮。 | `catalog-content-i18n.test.mjs`：后续标签渲染保留原文链接。浏览器六页 × 两视口检查 href；学校详情实际点击英文原文，再用语言菜单返回越南语。 | 通过；学校 UUID 保留，英文原文与越南语 HSK4/220 条件分别正确显示。 |

加载中、译文未准备、资源不可用、就绪及部分缺词状态保持区分。其他语言没有完整词典时仍显示 pending，不能因本次加载修复而标为正文已完成。

## 页面正文与移动端

| 页面 | 桌面 1280 × 900 | 手机 375 × 812 | 正文核对 |
| --- | --- | --- | --- |
| 学校列表 | 通过 | 通过 | 学校名、类型、地点、语言条件译文及英文原文链接；官方中文校名保留为来源引用。 |
| 项目列表 | 通过 | 通过 | 项目名、学校、申请说明、学制/教学语言/费用；原文链接存在。 |
| 奖学金列表 | 通过 | 通过 | 奖学金标题、摘要、资助层次、覆盖项目、截止日状态；原文链接存在。 |
| 学校详情：安徽大学 | 通过 | 通过 | HSK4/220、CSCA、学科、`¥15,000/năm`、2026-06-30 截止说明；正文条件无残留中文，官方名和来源引用保留。 |
| 项目详情：International Economics and Trade | 通过 | 通过 | `IELTS 5.5 hoặc TOEFL 60`、母语豁免、SUEP 申请说明和费用；未把无开放批次改成可申请。 |
| 奖学金详情：安徽农业大学奖学金 | 通过 | 通过 | 本硕博资助、CNY 20,000 / 30,000 / 50,000、适用层次和说明。 |

12 组均达到 `data-catalog-content-state=ready`，正文已显示，原文链接有效，整页无横向溢出。详情用 `.catalog-record-title h1` 确认真实记录加载，加载占位标题不计通过。此处为三条详情样本及三类列表当前页，不宣称全目录所有详情逐条浏览完成。

## 译文覆盖和事实保护

本轮未修改越南语字典、招生数据、官方来源或数据库。已有缓存翻译清单 **19,415 条**逐条核验：缺译 0、受保护数字/考试/URL/货币事实缺失 0、译文残留中文 0；manifest 的 ready 源集为 19,007 条，两个数字口径不同，不将它们合并。该清单是已有离线翻译输入，不是本轮重新获取的线上目录，也不等于逐句母语审校。完整字典哈希和已审核覆盖值另由自动化用例核验。

## 复跑与证据

```powershell
node --test tests/catalog-content-i18n.test.mjs tests/catalog-design.test.mjs tests/catalog-detail-actions.test.mjs tests/catalog-detail-public-contract.test.mjs tests/catalog-list-public-contract.test.mjs tests/i18n-public-contract.test.mjs tests/locale-navigation.test.mjs tests/public-asset-versions.test.mjs
node node_modules/eslint/bin/eslint.js public/catalog-content-i18n.js tests/catalog-content-i18n.test.mjs
node --check public/catalog-content-i18n.js
node scripts/public-asset-versions.mjs
git diff --check
```

实际浏览器证据：`E:\CodexData\build\CUCA\vi-body-recovery-20261121`，包含 `browser-regression.json`、`dictionary-regression.json` 和桌面/手机学校详情截图。临时故障代理仅监听 127.0.0.1，故障验证后已停止；实际本地预览服务保留运行。

检查结果：67/67 自动化通过；语法、公共资源版本（85 assets / 225 references）和 `git diff --check` 通过。项目完整 ESLint 配置在导入 `eslint.config.mjs` 时停滞，已结束本轮启动的该检查，未改配置或重装依赖；对两个修改的普通 JS 文件使用已有 ESLint 的 `overrideConfigFile: true`、`@eslint/js` recommended 规则及 browser/node globals 独立检查，2 文件、0 错误、0 警告。该结果不冒称项目完整 ESLint 配置通过。

改动为正文加载器、仅针对提示重试按钮的 CSS、定向测试及公共资源版本引用。导航/footer 布局和招生状态计算未调整。未运行整站生产构建；线上 301、真机 iPhone Safari 仍按此前约定暂缓，其他四语完整正文仍待原计划完成。

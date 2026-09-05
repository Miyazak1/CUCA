# CUAC 首页 V5 优化方案

日期：2026-08-12

状态：下一版首页设计与实现前的方案文档。仅用于方案沉淀，不发布站点。

## 1. 核心判断

UCAS 是质量标尺，不是视觉模板。

我们应该学习 UCAS 的产品完成度：入口清晰、信息架构稳定、搜索和筛选高效、关键字段可靠、学生行动路径明确。但 CUAC 不能复制 UCAS 的页面长相、蓝色链接风格、资讯门户节奏、机构板块结构和内容分类方式。

CUAC 的业务本质不同：

- 服务外国学生申请中国大学。
- 核心决策围绕中国大学项目、城市、奖学金、授课语言、申请材料、入学季、签证与 JW 表。
- 当前阶段虽然只做前端，不做后端和数据库，但前端本身必须是成熟、可信、可上线标准的产品设计。

上一版首页比早期好，但问题很明确：它开始像一个更干净的 UCAS，而不是一个服务外国学生来中国留学的 CUAC。V5 要围绕 CUAC 自己的学生旅程重做。

## 2. 产品主张

主张：

`Find China university programs you can actually apply for.`

辅助说明：

`Compare programs, scholarships, cities, deadlines, and required documents before you choose.`

首页必须让学生快速回答六个问题：

1. 我能在中国学什么？
2. 哪些项目符合我的学历层次、语言、预算和截止日期？
3. 哪些中国城市适合我的生活成本和生活方式？
4. 我是否赶得上当前入学季？
5. 我需要哪些材料、语言成绩或认证文件？
6. 下一步应该做什么？

## 3. 目标用户

核心用户：

- 16 到 20 岁左右的国际高中生、准本科生、准硕士申请者。
- 很多人以英语作为第二语言。
- 对中国大学、中国城市、中国申请周期、HSK/IELTS、材料翻译公证、签证/JW 表不熟悉。
- 他们需要的是确定感、速度、可信信息和明确下一步，而不是长篇宣传文案。

次级用户：

- 家长：关注费用、安全、城市、学校可信度。
- 升学顾问：帮助学生筛选真实可申请方案。
- 中国大学国际招生团队：后续单独服务，不进入学生首页主导航。

语气：

- 年轻，但不幼稚。
- 友好，但不销售化。
- 高效，但不粗糙。
- 可信，但不冰冷。
- 有中国留学特色，但国际学生能立即理解。

## 4. V4 暴露的问题

下一版必须明确修正这些问题：

- 页面节奏和内容结构过于接近 UCAS。
- 卡片过多，页面像静态目录，缺少产品体验。
- 部分版块像普通资讯或机构展示，而不是 CUAC 的留学决策工具。
- 之前的 `Your next move` 更像登录后的 Hub，不适合作为匿名用户首页重点。
- Footer 太粗糙，缺少成熟网站应有的信息组织和信任感。
- Section 上下间距需要统一，不应忽紧忽松。
- 视觉上太接近 UCAS 的白底、蓝色标题、资讯门户感。
- 远程图片不稳定，生产级前端需要稳定、本地或经过确认的图片资源。

## 5. 首页 V5 信息架构

首页必须学生优先、决策优先。不是堆板块，而是把学生从“想来中国留学”带到“找到可申请方案”。

### 5.1 顶部结构

顶部保持紧凑、清晰：

- Logo。
- 主导航：Programs、Universities、Scholarships、Cities、How to Apply、Hub。
- 工具入口：语言、收藏/对比、登录。
- 可选细条提示：`Fall 2026 applications opening by university. Check exact deadlines.`

不要把 adviser、provider、admin、business 等入口放进学生首页主导航。

### 5.2 首屏：China Program Matcher

首屏不能是营销 hero，也不能是仪表盘。它应该是一个真正有用的匹配入口。

建议结构：

- H1：`Find your China university path`
- 简短说明：`Search programs by subject, budget, language, city, scholarship, and intake.`
- 匹配字段：
  - Subject or keyword。
  - Degree level。
  - Teaching language。
  - Budget range。
  - Intake。
- 主按钮：`Find matches`
- 次按钮：`Explore scholarships`

首屏可以有一个强烈但克制的中国留学视觉信号，例如校园/城市图像、轻量地图感、项目匹配预览。不要再用泛泛的装饰仪表盘。

### 5.3 学生路径快捷入口

不要照搬 UCAS 的 category row。CUAC 应该把入口改成真实学生路径：

- English-taught programs。
- Scholarship-friendly options。
- Affordable city choices。
- Late intake openings。
- Medicine and health sciences。
- Engineering and computer science。
- Business and economics。
- HSK not ready yet。

每个入口都应该像“进入一个筛选后的申请路径”，而不是普通图标标签。

### 5.4 决策工具带

这里是 CUAC 可以超过 UCAS 的地方。用轻量交互工具替代大量静态卡片：

- `Can I apply?`：根据入学季、学历层次、授课语言、材料状态判断是否有明显阻碍。
- `Scholarship fit`：比较全奖、半奖、校级奖学金和自费路径。
- `City cost fit`：对比不同城市月生活费、城市节奏和国际学生支持。
- `Document readiness`：展示护照、成绩单、毕业证明、HSK/IELTS、文书、推荐信、翻译公证等准备状态。

这些工具在首页只做轻量预览，后续可进入更完整页面。

### 5.5 项目发现预览

展示真实项目样例，但必须露出决策字段：

- 项目名称。
- 大学。
- 城市。
- 学位层次。
- 授课语言。
- 学费 RMB。
- 奖学金信号。
- 入学季/截止日期。
- 语言或材料要求。

操作：

- Save。
- Compare。
- View details。

视觉上应像“精准 shortlist 预览”，不要像营销卡片墙。

### 5.6 中国城市与校园语境

不要做 UCAS 式 city guide。CUAC 的城市版块要解决国际学生对中国城市的真实不确定：

- 生活成本。
- 城市节奏。
- 国际学生支持。
- 实习和产业机会。
- 气候或生活方式。
- 城市内相关大学。

视觉节奏建议：一个较大的图文城市故事，加上紧凑对比行。避免继续堆相同卡片。

### 5.7 申请路径说明

用视觉时间线解释中国留学申请流程：

1. 找到真实可申请项目。
2. 检查截止日期和资格。
3. 准备申请材料。
4. 提交顾问审核。
5. 向大学申请。
6. 准备签证与 JW 表相关步骤。

文案要短，目的是降低焦虑，不是写成长指南。

### 5.8 信任与来源

CUAC 比普通留学官网更需要信任。

首页需要体现：

- 信息来源状态。
- 最近更新时间。
- 不同大学规则不同的提醒。
- 不使用 guaranteed admission 之类虚假确定表达。
- 顾问审核是辅助服务，不是录取承诺。

### 5.9 返回用户 Hub

Hub 入口需要保留，但不应占据匿名用户首屏核心。

适合放在主发现路径之后，或作为顶部小入口，用于：

- Saved choices。
- Missing documents。
- Upcoming deadlines。
- Adviser review status。

不要再在首屏放大号 `Your next move` 面板。

### 5.10 Footer

Footer 要按成熟网站标准重做。

建议分组：

- For students：Find programs、Scholarships、City guides、Deadlines、Application checklist。
- Applying to China：Documents、Language tests、Visa and JW form、Tuition and cost、Intake calendar。
- Support：Help center、Contact、Adviser review、Source policy。
- Partners：Universities、Advisers、International admissions。
- Company/legal：About CUAC、Terms、Privacy、Cookie preferences。

Footer 需要一句简洁使命说明和清楚的支持入口。不要复制 UCAS 的深色机构区块。

## 6. 视觉语言

目标是“成熟的中国留学决策产品”，不是“英国升学门户的中国版”。

### 6.1 配色

避免 UCAS 化：

- 不要大面积使用 UCAS 感很强的亮蓝色链接标题。
- 不要让白底 + 蓝字资讯门户成为主要识别。
- 不要做成单一青绿色页面。

建议方向：

- 主色：深玉绿或学院感绿色，用于品牌和关键行动。
- 辅色：温暖金色，用于奖学金、截止日期、机会提示。
- 支撑色：瓷白、浅灰、墨色文字、低饱和天蓝/湖蓝作为数据辅助。
- 状态色：截止日期用 amber，准备完成用 green，真正阻碍才用 red，信息提示用 blue。

颜色应该表达中国留学、清晰和可信，而不是为了装饰。

### 6.2 字体

可继续使用 Inter 或类似现代 Web 字体。

参考 UCAS 的排版纪律，不参考它的具体外观：

- 层级清楚。
- H1 强但不过度巨大。
- 版块文字密度高但易读。
- 按钮和标签字重统一。

建议桌面尺寸：

- H1：56 到 64 px。
- Hero 辅助文案：18 到 20 px。
- Section title：28 到 36 px。
- 工具/卡片标题：18 到 22 px。
- 正文：15 到 17 px。
- 元信息：12 到 14 px。

建议移动端尺寸：

- H1：36 到 42 px。
- Section title：24 到 30 px。
- 正文：15 到 16 px。

### 6.3 宽度与节奏

内容区域要宽，但不能失控。

建议桌面容器：

- 最大宽度：1500 到 1580 px。
- 1440 px 屏幕下左右留白约 56 到 80 px。
- 大屏不能贴边铺满。

建议间距：

- 大 section 上下间距：桌面 56 到 72 px，移动端 36 到 48 px。
- Section 标题到内容：20 到 28 px。
- 组件间距：16 到 24 px。
- Hero 底部到下一模块要紧凑，让用户能看到下一步。

### 6.4 形状与组件

- 卡片和面板圆角：6 到 8 px。
- 按钮要清楚、稳定，不要过度胶囊化。
- 避免卡片套卡片。
- 页面节奏要在工具面板、图文版块、对比行、时间线之间切换。
- 不要让整页变成一组相同矩形卡片。

### 6.5 图像

图片要展示真实的中国留学世界：

- 中国校园。
- 中国城市生活。
- 国际学生学习场景。
- 图书馆、实验室、宿舍区、校园街道、城市地标。

避免：

- 泛泛的微笑学生图库。
- 黑暗、模糊、只负责氛围的图片。
- 无法判断内容的裁切图。
- 生产环境依赖不稳定远程图片。

下一版编码应优先使用本地稳定资源或经过确认的托管资源。

## 7. 交互与动效

动效必须克制、精致，并且服务决策。

可以使用：

- 输入搜索时出现建议。
- 路径快捷入口选中态。
- 选择条件后出现 match score 或匹配数量变化。
- 只有紧急 deadline 才有轻微 pulse。
- Document readiness checklist 状态切换。
- City cost slider 或 segmented control。
- Scholarship filter drawer 平滑展开。
- 可点击元素 hover 上浮 1 到 2 px。
- 匹配数量、收藏数量的小幅数字过渡。

避免：

- 循环播放的装饰背景动画。
- 大幅 parallax 干扰阅读。
- 动画拖慢搜索和比较。
- 只为了“看起来热闹”的动效。

动效标准：

- 常规反馈 160 到 280 ms。
- 使用平稳 ease-out，不做弹跳感。
- 支持 `prefers-reduced-motion`。
- 关键信息不能只依赖动画表达。

## 8. 内容规则

首页文案要短、具体，适合英语非母语学生。

应该使用：

- 明确日期。
- RMB 费用范围。
- 清楚标签：`English-taught`、`HSK required`、`Scholarship available`、`Documents needed`。
- 直接动词：Find、Compare、Check、Save、Prepare、Review。

避免：

- 长篇励志文案。
- 泛泛的国际教育口号。
- 销售压迫感。
- 保录取等虚假确定性。
- 多个版块重复同一个意思。

## 9. 推荐 V5 首页顺序

1. 顶部结构与入学季提示。
2. Hero program matcher。
3. CUAC 学生路径快捷入口。
4. 决策工具带。
5. 项目发现预览。
6. 城市与成本匹配。
7. 奖学金和截止日期重点。
8. 中国申请路径时间线。
9. 信任与来源质量。
10. 返回用户 Hub 轻量入口。
11. 成熟 footer。

这个顺序先解决发现，再解决比较，再解决准备，最后建立信任。

## 10. V4 中应删除或重做的内容

删除或大改：

- UCAS 式资讯/新闻卡片节奏。
- UCAS 式 featured provider 结构。
- 公共首页的大 dashboard 面板。
- 过多重复卡片网格。
- 视觉上接近 UCAS 的蓝色标题/链接处理。
- 没有直接中国申请价值的 updates 版块。
- 类似 UCAS 机构服务区的深色大区块。

保留并强化：

- Search-first 的方向。
- 更宽但受控的内容区。
- Footer 必须成熟。
- 中国城市、项目、奖学金、截止日期这些业务概念。
- 图标可以用，但必须语义清楚、可读。

## 11. 下一步实现建议

建议实现路径：

1. 单独做 `home-v5.html` 或对应首页分支。
2. 不发布。
3. 使用本地 mock data 表达项目、城市、奖学金、截止日期和材料状态。
4. 把静态卡片改成真实可交互的首页状态。
5. 做桌面和移动端截图 QA 后再评估设计。
6. 首页 v5 被认可后，再提炼 tokens、组件和整体设计语言。

不要在首页方向未定前迁移整个网站框架。先把首页设计语言打磨对。

## 12. 验收标准

首页 v5 只有满足以下条件才算合格：

- 不再像 UCAS，但仍然达到甚至超过 UCAS 的可信度和完成度。
- 学生 5 秒内明白 CUAC 是帮他找到中国大学项目的。
- 首屏有真实搜索或匹配行动，而不是装饰性 hero。
- 首页至少表达四类 CUAC 特有决策工具：项目匹配、奖学金、城市成本、截止日期、材料准备、签证/JW 表。
- Section 间距稳定，视觉节奏平静。
- 页面节奏由图文、工具、对比行、时间线组合形成，而不是重复卡片。
- Footer 达到生产网站成熟度。
- 桌面宽度宽但不散。
- 移动端无文字溢出、按钮拥挤。
- 图标清晰可读。
- 动效精致克制，并支持减少动画。
- 视觉 QA 中不出现远程图片加载失败。
- 未经明确要求，不发布站点。


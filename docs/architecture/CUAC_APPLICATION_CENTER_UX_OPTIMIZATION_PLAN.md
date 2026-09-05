# CUAC 申请中心前端优化方案

日期：2026-08-28

状态：第四版优化方案沉淀，申请中心按 UCAS 式 section 架构收敛为少文字、独立页面、可提交的学生工作台

涉及原型：

- `design-lab/application.html`
- `design-lab/application.css`
- `design-lab/application.js`
- `frontend/public/application.*`
- 与 Hub 入口 `hub.html` 的跳转关系

## 1. 核心结论

申请中心不能再做成一个“把所有信息摊开”的长页面。它应该学习 UCAS 的信息架构：先给学生一个清楚的申请总览，然后把必填事项拆成 section 卡片，学生点进某个 section 后进入独立详情页完成填写，保存后回到总览或进入下一项。

这次优化的关键不是继续加内容，而是减少主页面文字、减少重复表达、让学生一进页面就知道：

1. 我现在申请到了哪一步。
2. 哪些部分必须完成。
3. 点哪里继续。
4. 什么时候可以付款和提交。
5. 提交后学校会看到什么、处理到哪一步。

申请中心要成为学生的“提交前工作台”，Hub 则是“登录后的入口和提醒页”。Hub 不应该重复申请中心的详细任务和完整流程。

第二版方案的核心调整：

- 总览页只做“申请状态 + section 入口”，不承载具体表单。
- 每个 section 必须是独立页面，不能在总览页下方展开。
- Student info 字段必须与注册 / onboarding 对齐，已填字段只确认或维护，不重复索要。
- Fee review、Payment、Send 都必须有独立页面和状态门槛。
- 文案继续减量，主界面优先用标题、状态、行动按钮表达，不用长段说明。
- 视觉层级参考 UCAS 的任务卡片，但使用 CUAC 自己的轻量风格，避免重阴影、强边框和大面积渐变。

## 2. 产品定位

### 2.1 Hub 与申请中心的边界

Hub 的职责：

- 欢迎学生回来；
- 展示一个最重要的申请状态；
- 提供“进入申请中心”入口；
- 提醒少量关键事项；
- 展示保存内容、推荐内容、工具入口。

Hub 不应该做：

- 不展示完整申请表；
- 不展开学生信息 section；
- 不重复 fee review、submit、文档矩阵等申请中心内容；
- 不把所有后续步骤塞进同一屏。

申请中心的职责：

- 管理学校/项目选择；
- 完成学生信息；
- 检查费用；
- 最终发送给学校；
- 发送后追踪学校处理状态。

### 2.2 申请中心不是注册流程

注册或 onboarding 用来收集学生初始目标，例如：

- 学位阶段；
- 专业方向；
- 目标城市；
- 预算；
- 授课语言；
- 奖学金倾向；
- HSK / IELTS / CSCA 初始情况。

申请中心的 Student info 不是重复注册，而是：

- 复用注册时已有的信息；
- 补齐学校发送所需的信息；
- 允许学生后续维护和更新；
- 明确哪些字段会发给学校，哪些只留在 CUAC。

因此，注册填过的字段不应要求学生再次填写，只需要显示为已填、可编辑、可确认。

## 3. 借鉴 UCAS 的部分

UCAS 的优点不是视觉风格本身，而是信息架构很稳：

- 顶部先给申请状态，而不是一堆说明；
- 主要任务用 section 卡片呈现；
- 每个 section 点进去是独立页面；
- 左侧有稳定的 section 导航；
- 右侧只处理当前 section 的表单；
- 所有必要项完成后才能 submit；
- 每个 section 都有保存和前后导航；
- 主页面和详情页职责分明。

CUAC 应该借鉴这些：

- 总览页：卡片化 section 总览；
- 详情页：单独路由，不在总览下方展开；
- 状态：清楚告诉学生完成度和下一步；
- 提交：未完成必填项时明确锁定；
- 支付：付款前先 review，不直接跳支付；
- 学校发送：强调 CUAC 发送的是学校可见记录，不替学校录取。

CUAC 不应该照搬：

- UCAS 的英国字段；
- UCAS 的蓝色视觉系统；
- 英国本土 residency、tariff、provider 逻辑；
- 大段政府服务式说明文本。

## 4. 当前主要问题

### 4.1 主页面文字仍然过多

目前申请中心虽然已经拆出层级，但主页面仍然有过多说明、状态、表格和卡片。学生会看到很多信息，却不一定知道“现在应该先做哪件事”。

优化方向：

- 主页面保留少量核心文案；
- 任务卡片只保留标题、短描述、状态；
- 复杂说明进入详情页；
- 非当前任务的内容降级展示。

### 4.2 页面宽度和布局节奏不够稳定

当前有些区域过宽，有些区域又突然变窄，视觉上像拼接出来的原型。申请中心需要稳定容器、稳定栅格、稳定卡片尺寸。

优化方向：

- 主内容最大宽度统一控制；
- section 卡片采用稳定 3 列布局；
- 表单详情页采用左导航 + 右表单；
- 表单主体不要过宽，优先保证填写舒适。

### 4.3 Section 卡片概念对了，但样式粗糙

用户明确希望像 UCAS 一样有 section 卡片，而不是点开后在下面直接展开。

当前问题：

- 卡片不像明确任务入口；
- 状态条、边框、阴影还显得“原型感”强；
- 有些卡片文案像内部字段名；
- 卡片点击后的反馈和路由关系需要更清楚。

优化方向：

- section 卡片是入口，不是展开控件；
- 卡片点击进入 `#profile/{section}`；
- 完成状态用底部状态条表达；
- 未完成状态用轻量底线和 CTA 表达；
- 卡片内只保留一行短说明。

### 4.4 Detail 页面需要真正成为独立页面

用户已经明确：UCAS 点 section 后进入独立页面，不是在下方展开。当前如果视觉上仍然像在同一个页面下展开，就会违背这个理解。

优化方向：

- 进入详情页后隐藏总览 section 卡片；
- 页面顶部显示当前 section 标题；
- 左侧只保留 section 导航；
- 右侧只显示当前 section 表单；
- 底部固定为保存、上一步、下一步、返回总览。

### 4.5 Fee review 路由和页面必须完整

Fee review 不是一个按钮标签，而是完整页面状态。学生点击 Fee review 后必须进入费用确认页。

Fee review 页面需要回答：

- 为什么要付费；
- 第一所学校是否包含；
- 额外学校如何计费；
- 本次一共需要支付多少；
- 支付后 CUAC 会把什么发给学校；
- 哪些项目暂时不能发送。

### 4.6 Submit 不应只是按钮

Submit 是一个结果状态，不是简单动作。所有必要 section 完成前不能提交。

Submit 前：

- choices 必须确认；
- student info 必须完成；
- fee review 必须完成；
- payment 必须通过；
- 学校可见记录必须确认。

Submit 后：

- 显示学校逐项处理状态；
- 区分 Sent、Viewed、Contacted、Documents requested；
- 告诉学生下一步是等学校联系，还是补材料。

## 5. 推荐信息架构

### 5.1 申请中心总览页

目的：让学生选择下一步，而不是阅读说明。

建议结构：

1. 顶部申请状态区
2. Required sections 卡片区
3. Choices 区
4. Fee / Submit 状态入口
5. 发送后学校追踪区，仅在提交后显示

顶部申请状态区只保留：

- `Application center`
- 一句短说明：`Complete each section, then send to schools.`
- 申请集合：`Fall 2026 CS`
- 学校数量；
- 待付金额；
- 最早截止日期；
- 进度环或进度条；
- 下一步提示。

避免：

- 大段解释；
- 多套进度组件同时存在；
- 同时展示过多表格、卡片和按钮。

### 5.2 Required sections 卡片

建议 section：

1. School choices
2. Student info
3. Fee review
4. Send to schools

Student info 下再进入二级 section：

1. Personal details
2. Nationality details
3. Contact details
4. Education
5. Finance & exams
6. Documents
7. What schools see
8. Consent

总览页 section 卡片规则：

- 一张卡只表达一个任务；
- 标题最多 3 个词；
- 描述尽量一行；
- 底部显示状态；
- 点击卡片进入独立详情页；
- 已完成卡片显示完成状态；
- 未完成卡片显示 `Start section` 或 `Review section`。

### 5.3 Student info 总览

Student info 不是完整表单页面，而是 section 卡片墙。

建议页面：

- 标题：`Student info`
- 副标题：`Review what schools can receive.`
- 8 个 section 卡片；
- 顶部显示 `Ready for school` 或 `Missing 2 sections`；
- 不在卡片下面展开表单。

### 5.4 Student info 详情页

详情页结构：

- 顶部：当前 section 标题；
- 左侧：所有 Student info section 导航；
- 右侧：当前 section 表单；
- 底部：保存、上一步、下一步、返回总览。

页面原则：

- 一屏只解决一个 section；
- 字段分组清晰；
- 注册时已有字段默认填好；
- 学生只处理缺失和需要确认的内容；
- 必填项明确；
- 完成后才能标记 section complete。

### 5.5 Fee review 页面

建议独立页面标题：

- `Fee review`
- 副标题：`Check school sending fee before payment.`

页面内容：

- 学校数量；
- 首所学校费用；
- 额外学校费用；
- 当前应付总额；
- 哪些学校将收到记录；
- 付款后是否立即发送；
- 不能发送的阻塞原因。

交互：

- `Back to application`
- `Confirm fee`
- `Continue to payment`

### 5.6 Payment 页面

Payment 页面只处理支付，不解释整个申请流程。

内容：

- 金额；
- 付款对象：CUAC service fee；
- 付款后动作；
- 支付状态；
- 发票或收据入口。

交互：

- 支付成功后进入 Submit review；
- 支付失败停留当前页并显示原因；
- 不使用“模拟支付”等技术味表达。

### 5.7 Submit review 页面

提交前页面需要像最后检查清单：

- Choices confirmed；
- Student info complete；
- Fee paid；
- Schools ready；
- Consent confirmed。

提交按钮文案：

- `Send to selected schools`

锁定时文案：

- `Complete required sections first`

### 5.8 Submitted tracker 页面

提交后不再强调“完成申请”，而是进入学校追踪。

内容：

- 每所学校一行或一卡；
- 学校名称；
- 项目；
- Sent 时间；
- Viewed 状态；
- School contact 状态；
- Documents requested 状态；
- 下一步。

学生最关心的是：

- 学校看了吗；
- 学校联系我了吗；
- 还要补什么；
- 我现在要不要做事。

## 6. Student info 字段策略

### 6.1 与注册字段对齐

注册已收集的信息应直接带入：

- 姓名；
- email；
- 国家/护照地区；
- 学位目标；
- 专业方向；
- 城市偏好；
- 预算；
- 授课语言；
- 奖学金倾向；
- HSK / IELTS / CSCA 状态。

申请中心只要求学生：

- 确认已有信息；
- 补充学校发送需要的信息；
- 更新变化的信息；
- 确认学校可见范围。

### 6.2 建议 Student info 字段分组

Personal details：

- legal name；
- preferred name；
- date of birth；
- passport nationality；
- account email。

Nationality details：

- country of birth；
- passport issuing country/region；
- current nationality；
- second nationality if applicable。

Contact details：

- mobile / WhatsApp；
- preferred contact channel；
- current country；
- emergency contact optional。

Education：

- current / latest school；
- current education stage；
- intended study level；
- GPA or academic summary；
- English-taught readiness note。

Finance & exams：

- budget range；
- funding source；
- scholarship intent；
- HSK status；
- IELTS / English proof status；
- CSCA status。

Documents：

- passport scan status；
- transcript status；
- transcript translation status；
- English proof status；
- study plan status；
- other school-specific requested docs。

What schools see：

- student summary；
- study goal；
- why this route；
- language/exam readiness；
- scholarship/budget note；
- school-facing comments。

Consent：

- confirm CUAC can send selected school-program records；
- confirm each school only receives its own selected program record；
- confirm documents are not automatically uploaded unless product later supports uploads；
- confirm student understands schools make final admissions decisions。

## 7. 视觉设计方向

### 7.1 整体视觉

申请中心应比当前更清爽：

- 减少大面积阴影；
- 减少渐变；
- 减少过重边框；
- 留白更稳定；
- 颜色只用于状态和行动；
- 页面不要像运营后台，也不要像 AI 生成的仪表盘。

### 7.2 卡片

Section 卡片应该接近 UCAS 的任务卡片逻辑，但使用 CUAC 自己的视觉：

- 白底；
- 轻边框；
- 低阴影或无阴影；
- 底部状态条；
- 完成状态可使用绿色底条；
- 未完成状态使用蓝/青色细线；
- hover 只做轻微边框和阴影变化。

避免：

- 过粗彩色边框；
- 大面积渐变背景；
- 每张卡都用不同颜色；
- 信息卡套信息卡；
- 卡片下方直接展开表单。

### 7.3 详情页表单

详情页应更接近表单系统：

- 左侧导航稳定；
- 右侧表单宽度适中；
- 字段垂直排列优先；
- 复杂字段再使用双列；
- 标签、说明、错误提示层级清楚；
- 输入框不要过度加粗；
- 主要按钮固定使用 CUAC 主色。

### 7.4 文字

文字需要更少、更具体：

- 主页面使用短句；
- 详情页才提供必要解释；
- 按钮表达动作，不表达系统状态；
- 避免 `route ready`、`school-visible record` 这类需要解释的术语过度出现在主界面。

推荐文案风格：

- `Add a school choice`
- `Review student info`
- `Check fee`
- `Send to schools`
- `Ready`
- `Needs review`
- `Locked`
- `Complete this section first`

### 7.5 第一轮已落地视觉约束

2026-08-28 第一轮优化已经在 `design-lab/application.*` 和 `frontend/public/application.*` 同步：

- 申请中心总览保留 UCAS 式 section 卡片，不在卡片下方展开表单。
- `#info` 显示 Student info section 总览；`#profile/{section}` 显示独立详情页。
- 详情页标题区和表单区不再继承整站最大宽度，桌面端控制在约 1180px 内。
- 详情页表单阅读宽度控制在约 740px，避免横向铺满导致阅读疲劳。
- Section 卡片减轻阴影、边框和状态条厚度，只保留底部状态线。
- 表单输入框统一高度、圆角、背景和聚焦状态。
- 小屏下覆盖详情页宽度，避免桌面收窄规则导致移动端过窄。

### 7.6 Hub 入口减法规则

Hub 已开始按“入口页，不是申请中心副本”的方向收敛：

- Hub 首屏只保留当前申请和新增学校选择两个主要入口。
- 当前申请摘要不再展示费用金额，费用留给 `Fee review` 页面。
- 当前申请卡隐藏 route checks 和小进度条，减少和申请中心状态区重复。
- 新增选择按钮改成明确动作：`Choose school and program`。
- Hub 继续保留少量提醒和推荐，但不展开 Student info、Fee review、Submit、文档矩阵等申请中心细节。

### 7.7 Fee review 第一轮落地记录

2026-08-28 继续优化了 `application.html#fee` 的前端表达：

- `design-lab/application.*` 和 `frontend/public/application.*` 已同步。
- Fee review 页的主容器独立收窄到约 1180px，避免和总览页混用宽度导致页面忽宽忽窄。
- 金额卡去掉偏重的黄色渐变，改成轻白底和弱边框，减少“原型/AI 味”。
- `Before payment` 改成动态 checklist：Choices、Student info、Consent 会根据当前状态显示 Done 或下一步。
- Send 状态不再因为资料完成就提前显示 Ready；只有 fee/payment 完成后才进入可发送状态。
- 定向测试 `keeps the CUAC application payment and school handoff demo explicit` 已通过。

### 7.8 Payment / Send 第一轮落地记录

2026-08-28 继续把申请中心从“弹窗式流程”推进到“独立步骤页”：

- 新增 `application.html#payment` 独立 Payment 页面，Fee review 的主按钮进入该路由。
- Payment 页面展示金额、学校费用明细、支付状态和信息共享确认，不再把支付藏在弹窗里。
- 支付成功后进入 `application.html#send` 的 Send review，而不是直接发送给学校。
- `#send` 拆成两态：发送前是最终复核页，发送后切换为学校处理追踪页。
- 点击阶段按钮会走 hash 路由，减少“DOM 切了但地址栏没变、刷新后不一致”的问题。
- 旧 payment modal DOM 暂时保留用于兼容，但主要用户路径已不再依赖它。
- `frontend/tests/rendered-html.test.mjs` 已同步更新到新的 Payment -> Send review -> Submitted tracker 流程。

### 7.9 Application overview 第一轮落地记录

2026-08-28 继续把申请中心默认页从“直接展开流程”调整为“真正的申请总览”：

- 新增 `application.html` 默认 `overview` stage，空 hash 不再直接显示 Choices 页面。
- 新增 `application-overview` 区块，作为申请中心的 section 入口，而不是在总览下方展开具体流程。
- Overview 只保留 `Next step` 和 4 个必做 section：School choices、Student info、Fee review、Send to schools。
- `#choices`、`#profile`、`#fee`、`#payment`、`#send` 继续作为独立流程页面。
- 顶部 stepper 文案从 `Profile` / `Submit` 调整为更直观的 `Student info` / `Send`。
- Profile detail 返回文案改为 `Return to student info`，避免误导用户以为返回整个 application overview。
- `design-lab/application.*` 与 `frontend/public/application.*` 已保持同步，定向测试已更新以保护新的默认 overview 架构。

### 7.10 Application overview 第二轮视觉精修记录

2026-08-28 继续优化默认总览页的清爽度和行动指引：

- 页面统一最大宽度从约 1480px 收敛到 1280px，减少宽屏下内容被拉得过散的问题。
- 顶部状态卡略微压缩，进度环尺寸从 78px 降到 68px，降低视觉重量。
- Overview 的 `Next step` 改成动态状态：会根据当前完成情况指向 Choices、Student info、Fee review、Send review 或 Sent status。
- Section 卡片取消 ready / warning / done 的渐变背景，统一白底、轻边框。
- Overview section 卡片的状态改为底部状态条，接近 UCAS 的 section card 任务模型，比胶囊状态更清晰。
- 完成、提醒、锁定状态分别使用绿色、琥珀、灰色底栏，避免厚彩边和大面积背景。
- 定向测试新增 overview 动态 CTA、1280px 宽度、section 状态底栏等契约断言。

## 8. 路由与交互规则

### 8.1 不能自动弹窗

进入 `application.html` 默认必须显示申请中心总览。

只有用户明确点击 `Add choice` 或 `Choose school and program` 时，才打开选择学校/项目弹窗。

错误行为：

- 从 Hub 点击进入申请中心后自动弹出 Add choice；
- 打开 `application.html` 默认进入 `#add-choice`；
- 刷新后出现和点击前不一致的页面状态。

### 8.2 Section 点击行为

正确行为：

- 点击 Student info section 卡片，进入独立 hash route；
- 不在当前页面下方展开；
- 浏览器地址应变化；
- 刷新后仍停留在该 section；
- 返回按钮回到申请中心总览。

建议路由：

- `application.html`：申请中心总览；
- `application.html#choices`：选择总览；
- `application.html#profile`：Student info section 总览；
- `application.html#profile/personal`：Personal details；
- `application.html#profile/nationality`：Nationality details；
- `application.html#profile/contact`：Contact details；
- `application.html#profile/education`：Education；
- `application.html#profile/finance`：Finance & exams；
- `application.html#profile/documents`：Documents；
- `application.html#profile/school-record`：What schools see；
- `application.html#profile/consent`：Consent；
- `application.html#fee`：Fee review；
- `application.html#payment`：Payment；
- `application.html#send`：Submit review；
- `application.html#submitted`：Submitted tracker。

### 8.3 进度锁定规则

Submit 解锁条件：

- 至少一个 school choice；
- choices 已确认；
- Student info 必填 section 完成；
- fee review 完成；
- payment 完成；
- consent 完成。

Fee review 解锁条件：

- 至少一个 school choice；
- choices 已确认；
- Student info 达到最低发送要求。

School send 解锁条件：

- fee paid；
- submit review confirmed。

## 9. 优先级

### P0：必须修

1. 进入申请中心默认不弹窗。
2. `Fee review` 点击后必须跳转到独立页面。
3. Student info section 卡片点击后必须进入独立详情页，不在下方展开。
4. 总览页删除重复表单和重复状态表达。
5. 注册已填字段在 Student info 中复用。

### P1：核心体验优化

1. 申请中心总览按 UCAS 式 section card 架构重做。
2. Student info 总览做成 8 个 section 卡片。
3. Student info 详情页做成左导航 + 右表单。
4. Fee review、Payment、Submit review、Submitted tracker 补齐。
5. 文案整体减半。

### P2：视觉精修

1. 统一页面最大宽度和栅格。
2. 减轻卡片阴影。
3. 减少渐变和装饰。
4. 优化按钮层级。
5. 优化移动端卡片和详情页导航。

## 10. 验收标准

申请中心总览：

- 学生 5 秒内能看出下一步；
- 主页面没有展开式长表单；
- section 卡片清晰可点击；
- Fee review / Submit 状态可理解；
- 页面文字明显少于当前版本。

Student info：

- 注册已填字段显示为已完成或已填；
- 每个 section 都能单独打开；
- 刷新后路由状态不丢；
- 保存、上一步、下一步、返回总览可预测；
- 左侧导航不会出现重复项或错位。

Fee / Submit：

- Fee review 有真实页面；
- 点击顶部进度或按钮能跳转；
- Submit 未解锁时原因清楚；
- Submit 后出现学校状态追踪。

视觉：

- 页面不再像后台仪表盘；
- 卡片不再有强烈 AI 感边框；
- 宽度和留白稳定；
- 表单输入区清爽；
- 主行动按钮明显。

## 11. 下一步执行建议

建议按以下顺序落地：

1. 先修路由和默认弹窗问题。
2. 重做申请中心总览结构。
3. 重做 Student info section 卡片与详情页。
4. 补齐 Fee review 页面与跳转。
5. 补齐 Payment / Submit review / Submitted tracker。
6. 最后统一视觉细节和移动端。

这能避免继续在单个页面上堆功能，也能让申请中心真正变成一个可扩展到后端、数据库和 Agent 工作流的产品骨架。

## 12. 第二版页面架构

### 12.1 顶层关系

CUAC 学生端应拆成三个不同层级：

1. `Hub`
2. `Application center`
3. `Application section detail`

三者的职责不能混在一起。

Hub：

- 只告诉学生“你现在有一个申请在进行”和“下一步去哪做”。
- 保留一个主入口：进入申请中心。
- 保留一个辅助入口：新增学校项目选择。
- 推荐内容、工具和保存内容可以存在，但不能抢申请中心的主任务。

Application center：

- 展示申请整体完成度。
- 展示所有必须完成的 section。
- 展示学校选择列表。
- 展示 Fee review / Send 的锁定和完成状态。
- 不直接展开 Student info 表单。

Application section detail：

- 一次只完成一个 section。
- 有左侧 section 导航。
- 有保存按钮、上一项、下一项、返回总览。
- 刷新后仍然停留在当前 section。

### 12.2 推荐路由

| 页面 | 路由 | 目的 |
| --- | --- | --- |
| Hub | `hub.html` | 登录后的轻量入口 |
| 申请总览 | `application.html` | 查看进度和进入各 section |
| 学校选择 | `application.html#choices` | 增删学校项目、确认顺序 |
| Student info 总览 | `application.html#profile` | 查看学生资料 section 卡片 |
| Personal details | `application.html#profile/personal` | 姓名、生日、护照基础信息 |
| Nationality details | `application.html#profile/nationality` | 国籍、出生地、护照地区 |
| Contact details | `application.html#profile/contact` | 手机、WhatsApp、邮箱、联系偏好 |
| Education | `application.html#profile/education` | 当前学校、学历阶段、学术摘要 |
| Finance & exams | `application.html#profile/finance` | 预算、资金来源、奖学金、HSK、IELTS、CSCA |
| Documents | `application.html#profile/documents` | 护照、成绩单、翻译、语言证明、学习计划 |
| What schools see | `application.html#profile/school-record` | 学校可见摘要和学校可见字段 |
| Consent | `application.html#profile/consent` | 授权 CUAC 发送学校可见记录 |
| Fee review | `application.html#fee` | 检查本次发送服务费 |
| Payment | `application.html#payment` | 支付或确认免费发送 |
| Send review | `application.html#send` | 最终发送前确认 |
| Submitted tracker | `application.html#submitted` | 发送后追踪学校处理 |

### 12.3 路由原则

- `application.html` 默认永远显示申请总览，不自动弹窗。
- `#add-choice` 不应该作为默认入口弹窗路由；如果保留，只能由明确点击触发。
- 点击 Hub 的“进入申请中心”进入 `application.html`，不进入 `#add-choice`。
- 点击“Choose school and program”可以进入 `#choices` 或手动打开 add choice modal，但不能自动覆盖主页面。
- section 卡片点击必须改变 hash。
- 刷新后路由状态必须一致。

## 13. 申请中心总览页方案

### 13.1 页面目标

学生打开申请中心后，第一反应应该是：

- 我有一个申请集合；
- 我需要完成几个 section；
- 哪一项是下一步；
- 完成后才能付款和发送。

总览页不是解释页，也不是后台数据页。

### 13.2 推荐首屏结构

顶部状态卡：

- 标题：`Application center`
- 短句：`Complete each section, then send to schools.`
- 申请集合：`Fall 2026 CS`
- 关键数字：学校数、费用、最早截止日
- 进度环：Choices、Student info、Fee review、Send、Overall
- 下一步提示：只保留一条

Required section 卡片：

- `School choices`
- `Student info`
- `Fee review`
- `Send to schools`

下方内容：

- 未发送前：展示 School choices 列表。
- 发送后：展示 Submitted tracker。
- Student info 不在总览页展开。

### 13.3 总览页需要删除或降级的内容

删除：

- Student info 详情表单；
- 大段文案解释；
- 重复的费用解释；
- 重复的文档矩阵；
- 过多 chip；
- 同时出现多个进度系统。

降级：

- Documents 只做入口或摘要，不在总览页完整展开；
- Fee 只显示状态和金额，不解释规则；
- School processing 只在发送后出现。

### 13.4 总览页视觉规范

- 主容器宽度统一，不出现忽宽忽窄。
- 顶部状态区可以较宽，但内容要少。
- Required cards 固定 4 列，移动端改 1 列。
- School choices 可以是列表卡，不需要每条都做大面积背景。
- 主要按钮只保留一个醒目动作。

## 14. Student info 方案

### 14.1 Student info 总览

Student info 总览必须是 section 卡片墙，类似 UCAS 的 profile section：

- Personal details
- Nationality details
- Contact details
- Education
- Finance & exams
- Documents
- What schools see
- Consent

每张卡只放：

- section 名称；
- 一行解释；
- 状态条；
- CTA：`Start section` / `Review section` / `Section complete`。

不在卡片下方展开表单。

### 14.2 Student info 详情页

详情页布局：

- 页面标题：当前 section 名称。
- 左侧导航：所有 Student info sections。
- 右侧表单：当前 section。
- 底部导航：Back、Save section、Next。

视觉参考：

- UCAS 的优点是“清楚的左导航 + 单一表单任务”，不是它的蓝色或政府服务视觉。
- CUAC 应保持白底、清晰输入框、低阴影、足够留白。
- 表单区宽度不要超过舒适阅读宽度。

### 14.3 字段复用规则

注册 / onboarding 已填字段：

- 在 Student info 中默认带入。
- 显示为已填状态。
- 允许编辑。
- 不再要求学生重新填写一次。

新增字段：

- 只收集学校发送、费用判断、考试准备、材料追踪真正需要的信息。
- 每个字段要标明是否会发送给学校。

字段来源建议：

| 字段类型 | 来源 | 申请中心行为 |
| --- | --- | --- |
| 账号邮箱 | 注册 | 默认只读或可跳转账号设置修改 |
| 姓名 | 注册 / profile | 默认带入，可编辑 legal name |
| 国家/地区 | 注册 / onboarding | 默认带入，可确认护照地区 |
| 目标专业 | onboarding | 用于推荐和摘要，不重复填写 |
| 城市偏好 | onboarding | 用于 route summary，不作为必填申请字段 |
| 预算 | onboarding | 带入 Finance & exams，可更新 |
| 奖学金倾向 | onboarding | 带入 Finance & exams，可更新 |
| HSK / IELTS / CSCA | onboarding | 带入考试状态，可更新准备进度 |
| 护照、成绩单等材料 | 申请中心新增 | 只记录状态，不默认上传文件 |
| 学校可见说明 | 申请中心新增 | 进入 What schools see 审核 |
| 授权同意 | 申请中心新增 | 必填，影响发送解锁 |

### 14.4 Student info 完成条件

Student info 不能只用“表单有值”判断完成，还要区分：

- 已从注册带入；
- 学生已确认；
- 需要更新；
- 缺失；
- 不适用。

建议完成规则：

- Personal details：legal name、email、passport nationality 完成。
- Nationality details：passport region / nationality 已确认。
- Contact details：手机或 WhatsApp 至少一个可用。
- Education：当前学校 / 当前阶段 / 目标阶段已确认。
- Finance & exams：预算、资金来源、奖学金倾向、HSK/IELTS/CSCA 状态已确认。
- Documents：材料状态已记录，不要求上传。
- What schools see：学校可见摘要已确认。
- Consent：学生明确授权 CUAC 发送记录。

## 15. School choices 方案

### 15.1 页面目标

School choices 只解决一件事：学生选择并确认学校项目顺序。

它不应该混入完整 Student info、费用支付、学校追踪。

### 15.2 列表结构

每个选择卡片建议包含：

- 学校名称；
- 项目名称；
- 城市；
- 授课语言；
- intake；
- 截止日期；
- 标签：Main route / Backup / Funding route / To check；
- 操作：Move、Remove、View details。

### 15.3 Add choice 行为

推荐两种可选方案：

方案 A：独立选择页。

- 点击 `Add choice` 进入 `application.html#choices/add`。
- 更适合后端化后复杂筛选。

方案 B：显式 modal。

- 点击 `Add choice` 才打开 modal。
- 关闭后回到 `#choices`。
- 从 Hub 进入 application 不自动打开。

当前阶段可以先使用方案 B，但路由和触发必须清楚。

### 15.4 Choices 完成条件

- 至少一个学校项目。
- 学生确认顺序。
- 每个选择都有 school、program、intake、teaching language。
- 已标记是否主申请 / 备选 / 奖学金路线。

## 16. Fee review / Payment / Send 方案

### 16.1 Fee review 页面

Fee review 是独立页面，不是总览卡片里的小区域。

页面目标：

- 告诉学生本次为什么收费；
- 展示学校数量和计费规则；
- 让学生确认付款前提是否满足；
- 进入 payment。

推荐结构：

- 标题：`Fee review`
- 副标题：`Check the CUAC school sending fee.`
- 金额卡：总额、包含首所学校、额外学校单价。
- 学校列表：每所学校是否计费。
- Before payment checklist：Choices、Student info、Consent。
- CTA：`Continue to payment`。

避免：

- “模拟支付”之类技术词；
- 大段解释；
- 黄色大渐变；
- 看起来像后台账单组件。

### 16.2 Payment 页面

Payment 只解决支付。

页面内容：

- Pay to：CUAC service fee。
- Amount due。
- What happens next：付款成功后进入 Send review。
- Receipt 状态。

交互：

- 支付成功后不应该直接跳过 Send review，除非产品明确要“一键支付并发送”。
- 支付失败时停留并提示原因。
- 免费发送时也要有确认页，避免学生误以为已经发出。

### 16.3 Send review 页面

Send review 是最终闸门。

页面需要展示：

- 发送学校列表；
- 每所学校将看到的项目；
- 学生联系信息；
- 不发送的内容；
- Consent 状态；
- Fee paid 状态。

按钮：

- 可发送：`Send to selected schools`
- 不可发送：`Complete required sections first`

### 16.4 Submitted tracker 页面

发送后页面替换为追踪状态，不再强调“填写申请”。

每所学校展示：

- Sent；
- Viewed；
- Contacted；
- Documents requested；
- Next action。

学生最需要看到的是：

- 哪个学校看了；
- 哪个学校还没处理；
- 我是否要补材料；
- 下一步是等待还是行动。

## 17. 视觉精修方案

### 17.1 整体方向

当前样式粗糙的根源不是颜色不够，而是层级和节奏不稳。下一轮视觉优化要优先解决：

- 容器宽度统一；
- 卡片尺寸稳定；
- 文字减少；
- 状态表达统一；
- 主按钮明确；
- 表单不铺满全屏；
- 背景和阴影更轻。

### 17.2 色彩规则

主色：

- CUAC teal 只用于主按钮、当前状态、进度。

辅助色：

- 蓝色：进行中 / 可继续；
- 绿色：完成；
- 琥珀：需要注意；
- 红色：阻塞或危险操作。

限制：

- 不用每张卡不同背景色；
- 不用厚彩色边框；
- 不用大面积渐变当默认背景；
- 不用过度装饰的环形图。

### 17.3 卡片规则

Section card：

- 高度固定或接近固定；
- 白底；
- 轻边框；
- 无重阴影；
- 底部一条状态线；
- 整卡可点击；
- hover 只轻微提升边框。

Action card：

- 用于 Hub 的“新增学校选择”或总览的主要入口；
- CTA 必须明显；
- 标题必须表达动作，例如 `Add a school choice`，不要只写 `Start new`。

Form card：

- 只用于真正需要分组的表单；
- 不要 card 套 card；
- 表单字段比卡片更重要。

### 17.4 字体和文案规则

总览页：

- 标题 2 到 5 个词；
- 描述 1 行；
- 不解释系统规则；
- 只展示下一步。

详情页：

- 可以有必要说明；
- 每个字段说明最多 1 到 2 行；
- 长帮助放到 tooltip、help panel 或 guide 链接。

按钮：

- 使用动词；
- 不使用内部名词；
- 不用 `Start new` 这种含义不清的词。

建议替换：

| 当前问题文案 | 建议文案 |
| --- | --- |
| Start new | Add a school choice |
| Start | Choose school and program |
| Fee | Fee review |
| Send | Send to schools |
| Profile | Student info |
| route ready | Ready |
| school-visible record | What schools see |

## 18. 后端化前需要确认的数据模型

为了后续设计数据库和 Agent，前端方案需要提前固定以下实体：

- Student；
- StudentProfile；
- ApplicationSet；
- ApplicationChoice；
- School；
- Program；
- Intake；
- Scholarship；
- ExamStatus；
- DocumentStatus；
- FeeOrder；
- Payment；
- SchoolSubmission；
- SchoolSubmissionEvent；
- AgentConversation；
- AuditLog。

前端状态需要映射到后端字段：

| 前端状态 | 后端含义 |
| --- | --- |
| choices complete | application choices confirmed |
| student info ready | required profile sections confirmed |
| fee reviewed | fee order reviewed by student |
| paid | payment succeeded or no-fee confirmed |
| sent | school submissions created |
| viewed | school portal user opened submission |
| documents requested | school requested follow-up materials |

## 19. 第二版执行计划

### Phase 1：信息架构锁定

- 固定 Hub / Application center / Detail pages 边界。
- 固定路由表。
- 固定 Student info section 列表。
- 固定完成条件。

### Phase 2：总览页和 section cards

- 申请中心总览只保留状态和入口。
- Student info 总览改成 UCAS 式 section cards。
- 点击 section 进入独立页面。
- 删除下方展开表单。

### Phase 3：详情页

- 建立 `#profile/{section}` 详情页模板。
- 左侧导航去重并固定。
- 表单宽度收敛。
- 字段与注册 / onboarding 对齐。

### Phase 4：Fee / Payment / Send

- `#fee` 做成完整 Fee review 页面。
- `#payment` 独立处理支付。
- `#send` 做最终发送确认。
- `#submitted` 展示学校处理追踪。

### Phase 5：视觉精修

- 统一容器宽度。
- 减轻卡片边框和阴影。
- 减少文字。
- 优化移动端。
- QA 所有 hash 路由、刷新、返回、点击状态。

## 20. 关键验收问题

每次实现后，用以下问题检查：

1. 学生 5 秒内知道下一步吗？
2. 总览页是否没有展开长表单？
3. section 点击是否进入独立页面？
4. 注册已填字段是否复用？
5. Fee review 是否是真页面？
6. Payment 和 Send 是否分清楚？
7. 未完成必填项时 Submit 是否明确锁定？
8. 文案是否还能再少 30%？
9. 是否有奇怪宽度、重边框、强渐变、厚阴影？
10. 刷新后页面状态是否和点击前一致？

只有这些问题都通过，申请中心才算从“原型页面”进入“可产品化页面”。

## 21. 第三版总评：申请中心还需要解决什么

当前申请中心的信息架构已经接近正确方向：默认进入总览、Student info 拆成 section 卡片、Fee / Payment / Send 有独立页面。但视觉和交互还停在“可演示原型”，离真正可用的网站还有明显距离。

核心问题有四类：

1. 层级虽然对了，但视觉还不够清爽。
2. 总览页仍然承担了太多解释任务。
3. Section detail 页还没有完全像独立页面。
4. Fee、Payment、Send 的意义需要更直观，而不是像内部流程状态。

下一步优化不能继续“加模块”。要反过来做减法：把每个页面只保留一个主任务，让学生不需要读很多文字，也能明白下一步。

### 21.1 设计原则

申请中心所有页面遵守以下原则：

- 一页只做一个主任务。
- 首屏只给一个主行动。
- 长说明全部下沉到 guide、tooltip、帮助链接或空状态。
- 总览页只显示状态和入口，不显示表单。
- Section 卡片只负责导航，不负责展开内容。
- Detail 页只显示当前 section 的字段。
- 所有必填项完成后才允许进入最终发送。
- 学校看到什么必须在 Send review 前明确展示。

### 21.2 UCAS 值得借鉴的不是视觉，而是任务模型

UCAS 申请中心的核心优点：

- 状态总览清楚：顶部一眼看到 Choices、Profile、Personal statement、Reference、Submit。
- 任务拆分清楚：每个 section 都是卡片，状态可见。
- 入口明确：Add choice 是大按钮，section card 是清楚的可点击入口。
- 页面单一：点进 section 后进入单独页面，只填写当前 section。
- 导航稳定：左侧 section nav 让用户知道自己在哪里。
- 提交门槛明确：所有必要项完成前不能 submit。

CUAC 要借鉴这些结构，但要避免 UCAS 里不适合我们的地方：

- 不做深色大背景。
- 不照搬蓝色政府服务风格。
- 不保留过多解释文案。
- 不把英国申请字段搬进中国申请场景。
- 不做过大的空白导致页面显得散。

## 22. 页面级优化方案

### 22.1 Application center 总览页

目标：

学生进入 `application.html` 后，5 秒内知道：

- 这是哪个申请集合；
- 当前完成到哪一步；
- 下一步点哪里；
- 还差什么才能发送。

推荐结构：

1. 顶部状态卡
2. Required sections 卡片区
3. 当前主要任务区
4. 发送后才出现学校追踪

顶部状态卡建议改成更紧凑的结构：

- 左侧：标题、申请集合、4 个关键事实。
- 右侧：横向 stepper 或轻量进度环。
- 底部：一条 next action。

标题文案：

- `Application center`
- `Complete each section, then send to schools.`

关键事实只保留：

- `Fall 2026 CS`
- `3 schools`
- `USD 40`
- `Oct 15`

Required sections：

- `School choices`
- `Student info`
- `Fee review`
- `Send to schools`

卡片状态：

- `Start`
- `Review`
- `Done`
- `Locked`

需要删除或移动：

- Documents matrix 不放在总览首屏。
- Student info 详细表单不放在总览。
- Fee 解释不放在总览。
- Send 后学校状态未发送前不出现。
- 不同时出现多个进度表达。

视觉方向：

- 总览主容器宽度统一，建议 1180 到 1240px。
- 顶部状态卡高度控制在 240 到 300px。
- Required cards 高度统一，避免一张高一张矮。
- 主按钮只保留当前下一步，例如 `Review student info`。

### 22.2 School choices 页面

目标：

只解决学校和项目选择，不混入资料、费用、发送追踪。

推荐页面：

- 路由：`application.html#choices`
- 主标题：`School choices`
- CTA：`Add choice`
- 列表：已选 school-program routes。

每张 choice card 显示：

- 学校名；
- 项目名；
- 城市；
- intake；
- deadline；
- role：Main / Backup / Funding / To check；
- 状态：Ready / Needs review。

交互：

- `Add choice` 可以先保留显式 modal，但不能自动弹。
- 后端化后推荐改成 `#choices/add` 独立选择页。
- choice card 可进入详情，不在列表里展示全部规则。
- 删除按钮降级，不要比主行动更显眼。

文案减法：

- `Choice logic` 可以改为 `Order`。
- 列表右侧说明保留 3 条以内。
- 不在每张卡重复解释“为什么这个学校适合”。

### 22.3 Student info 总览页

目标：

复用注册 / onboarding 已填资料，让学生补齐学校发送前必要信息。

推荐页面：

- 路由：`application.html#profile`
- 主标题：`Student info`
- 状态：`Ready for school` 或 `2 sections missing`
- 卡片墙：8 个 section。

Section 列表：

1. Personal details
2. Nationality details
3. Contact details
4. Education
5. Finance & exams
6. Documents
7. What schools see
8. Consent

卡片规则：

- 每张卡只放标题、一行解释、底部状态条。
- 整张卡可点击。
- 点击进入 `application.html#profile/{section}`。
- 总览页不出现任何表单字段。

推荐卡片文案：

| Section | 一行解释 |
| --- | --- |
| Personal details | Name and account email |
| Nationality details | Country and passport |
| Contact details | Phone and preferred channel |
| Education | Current school and level |
| Finance & exams | Budget, HSK and CSCA |
| Documents | Passport, transcript, proof |
| What schools see | School-facing summary |
| Consent | Permission to send |

状态文案：

- `Section complete`
- `Review section`
- `Start section`
- `Needs update`

### 22.4 Student info 详情页

目标：

像 UCAS 一样，点进 section 后进入独立页面，一次只完成一组字段。

推荐页面：

- 路由：`application.html#profile/personal`
- 顶部：当前 section 标题。
- 左侧：Student info section nav。
- 右侧：当前 section 表单。
- 底部：`Save section`、`Back`、`Next section`。

需要特别处理：

- 已从注册带入的字段默认填好。
- 注册已完成且不建议修改的字段显示为只读或带修改入口。
- 新增字段才需要学生补。
- 每个字段必须标明是否会发送给学校，但不要用长句解释。

字段策略：

Personal details：

- Full name；
- Email；
- Passport name if different；
- Date of birth 如注册未收集才补。

Nationality details：

- Passport country / region；
- Nationality；
- Current residence country。

Contact details：

- Phone / WhatsApp；
- Preferred contact channel；
- Emergency contact 可作为后续增强，不作为第一版强制。

Education：

- Current / latest school；
- Current level；
- Intended study level；
- Academic summary。

Finance & exams：

- Budget range；
- Funding source；
- Scholarship intent；
- HSK status；
- IELTS / English proof status；
- CSCA status。

Documents：

- Passport scan status；
- Transcript status；
- Transcript translation status；
- English proof status；
- Study plan status。

What schools see：

- School-facing summary；
- Student note；
- Selected school-program only；
- 不显示其他学校的选择。

Consent：

- CUAC can send this selected school-program record；
- Contact info can be shared；
- Documents are not sent unless student uploads / approves later。

视觉优化：

- 表单宽度控制在 640 到 760px。
- 左侧导航宽度 220 到 260px。
- 输入框垂直排列，减少复杂网格。
- 帮助文字最多 1 行，复杂说明用 help link。

### 22.5 Fee review 页面

目标：

学生知道为什么要付费、付多少、什么时候付。

推荐页面：

- 路由：`application.html#fee`
- 标题：`Fee review`
- 一句话：`Check the CUAC sending fee.`
- 主金额：`USD 40`
- CTA：`Continue to payment`

页面结构：

- Fee summary：总额、首所学校 included、额外学校价格。
- School fee list：每所学校是否计费。
- Before payment checklist：Choices、Student info、Consent。

需要避免：

- 不展示内部支付对象名。
- 不用 `PaymentCreateResult`、`CommerceOrder` 这类字段。
- 不用大段说明服务规则。
- 不用黄色大块背景，最多用轻提示条。

### 22.6 Payment 页面

目标：

只完成付款或免费确认。

推荐页面：

- 路由：`application.html#payment`
- 标题：`Confirm payment`
- 主金额：`USD 40`
- CTA：`Confirm payment`

页面结构：

- Amount due；
- School count；
- Fee breakdown；
- Consent summary；
- Payment status。

交互规则：

- Payment 成功后进入 `#send`。
- Payment 失败停留当前页。
- 免费发送也要进入确认页，按钮为 `Confirm free send`。
- Payment 成功不自动发送给学校。

### 22.7 Send review 页面

目标：

这是最终闸门，学生确认后 CUAC 才发送给学校。

推荐页面：

- 路由：`application.html#send`
- 标题：`Send to schools`
- 一句话：`Review what each school will receive.`
- CTA：`Send to selected schools`

页面必须展示：

- 发送给哪些学校；
- 每所学校对应哪个项目；
- 学校能看到的学生联系信息；
- 学校不能看到什么；
- payment 是否完成；
- consent 是否完成。

关键原则：

- Send review 不是付款页。
- Send review 不是学校追踪页。
- 未满足必填项时按钮锁定，并告诉学生缺哪个 section。

### 22.8 Submitted tracker 页面

目标：

发送后，学生不再“填写申请”，而是追踪学校处理。

推荐页面：

- 路由：`application.html#submitted`
- 标题：`Sent to schools`
- 主状态：`3 schools received your CUAC record`

学校状态：

- Sent；
- Viewed；
- Contacted；
- Documents requested；
- Next action。

学生最关心：

- 哪所学校已经看了；
- 哪所学校还没看；
- 哪所学校要补材料；
- 是否该等待还是行动。

不应该出现：

- 未发送前的填写卡片；
- 费用支付入口；
- add choice 主入口；
- 大段解释。

## 23. 视觉系统优化方案

### 23.1 当前视觉问题

当前页面的粗糙感主要来自：

- 卡片边框过重或颜色过多；
- 背景渐变和大面积色块使用过频；
- 卡片宽度不稳定；
- 同一页面既有大卡片、表格、表单、进度环，节奏混乱；
- 文案过多，导致视觉上发堵；
- CTA 不够明确或含义不清。

### 23.2 新视觉方向

关键词：

- 清楚；
- 轻；
- 稳定；
- 少字；
- 强行动。

页面背景：

- 使用接近白色的背景。
- 不使用大面积装饰渐变。
- 不使用过强阴影。

卡片：

- 白底；
- 1px 轻边框；
- 6 到 8px radius；
- 轻阴影只用于顶层容器；
- 内部 spacing 稳定。

状态：

- 完成：绿色底条或绿色状态区；
- 当前：teal 边框或状态线；
- 待完成：蓝色细线；
- 阻塞：琥珀提示；
- 危险操作：红色仅用于 remove / stop。

按钮：

- 主按钮只用 teal；
- 次按钮白底边框；
- 危险按钮白底红字；
- 不用粉色按钮作为主 CTA；
- `Add choice` 这种核心入口可以用大按钮，但文字必须明确。

### 23.3 版面宽度规则

统一宽度：

- 总览页：1180 到 1240px。
- Detail 页：内容区 960 到 1100px。
- 表单主列：640 到 760px。
- Section card：3 列布局，每列等宽。

不要再出现：

- 左侧卡片特别窄，右侧卡片特别宽；
- 总览页和 detail 页宽度跳变过大；
- 表单在页面中间形成奇怪小岛；
- 卡片为了填满空间被拉得过宽。

### 23.4 文案减量规则

每个页面的文字预算：

| 页面 | 首屏说明文字 |
| --- | --- |
| Application center | 1 句 |
| Choices | 1 句或无 |
| Student info overview | 1 句 |
| Student info detail | 每个字段最多 1 行说明 |
| Fee review | 1 句 |
| Payment | 1 句 |
| Send review | 1 句 |
| Submitted tracker | 1 句 |

凡是超过 2 行的解释，都应该移到：

- guide link；
- help popover；
- FAQ；
- Agent prompt；
- empty state。

## 24. 交互与路由验收方案

### 24.1 路由表

| 页面 | 路由 | 行为 |
| --- | --- | --- |
| Application overview | `application.html` | 默认总览，不弹窗 |
| Choices | `application.html#choices` | 显示 school choices |
| Add choice | `application.html#choices/add` 或显式 modal | 只能由点击触发 |
| Student info overview | `application.html#profile` | 显示 section 卡片 |
| Personal details | `application.html#profile/personal` | 独立详情页 |
| Nationality details | `application.html#profile/nationality` | 独立详情页 |
| Contact details | `application.html#profile/contact` | 独立详情页 |
| Education | `application.html#profile/education` | 独立详情页 |
| Finance & exams | `application.html#profile/finance` | 独立详情页 |
| Documents | `application.html#profile/documents` | 独立详情页 |
| What schools see | `application.html#profile/school-summary` | 独立详情页 |
| Consent | `application.html#profile/consent` | 独立详情页 |
| Fee review | `application.html#fee` | 独立费用确认 |
| Payment | `application.html#payment` | 独立支付确认 |
| Send review | `application.html#send` | 最终发送确认 |
| Submitted tracker | `application.html#submitted` | 发送后学校处理追踪 |

### 24.2 必须修复的交互

- 从 Hub 点击进入申请中心，不自动弹 Add choice。
- 点击 `Fee review` 必须进入 `#fee`。
- 点击 `Continue to payment` 必须进入 `#payment`。
- Payment 成功后进入 `#send`，不自动发送。
- 点击 `Send to selected schools` 后才进入 `#submitted`。
- Student info 卡片点击进入独立详情路由。
- Detail 页刷新后仍停留当前 section。
- Back / Next section 不改变整体页面结构。
- 未完成必填项时，Send 按钮显示锁定原因。

### 24.3 完成条件

Application overview 完成条件：

- 有至少 1 个 choice；
- choice order 已确认；
- Student info required sections 全部 complete；
- Fee reviewed；
- Payment completed 或 free send confirmed；
- Consent completed。

Send 解锁条件：

- School choices done；
- Student info done；
- Fee reviewed；
- Payment done；
- Consent done。

Submitted tracker 出现条件：

- 已创建 school submission；
- 每个 selected school 都有发送记录；
- 页面不再展示发送前主流程。

### 24.4 QA 清单

每次视觉或交互修改后都要检查：

- `application.html` 默认不弹窗。
- 所有 hash 路由可直达。
- 刷新后页面状态不丢失。
- Section card 不展开表单。
- Detail 页没有显示总览卡片。
- Fee、Payment、Send 三个页面含义清楚。
- 页面没有奇怪宽度。
- 主按钮一眼可见。
- 文案是否还能删。
- 移动端不横向溢出。

## 25. 下一轮执行顺序

建议下一轮不要同时改所有东西，按风险从低到高推进：

1. 先锁定路由和页面显示规则。
2. 彻底清理总览页，只留下状态和入口。
3. 精修 Student info overview 的 section 卡片。
4. 把 Student info detail 做成真正独立页视觉。
5. 精修 Fee / Payment / Send 三个页面的文案和布局。
6. 最后统一视觉系统：宽度、卡片、按钮、状态、移动端。

第一轮应优先做到：

- 默认申请中心无弹窗；
- 总览页无内联表单；
- section card 点击独立跳转；
- Fee review / Payment / Send 路由全通；
- 每页主任务清楚；
- 首屏文字减少至少 40%。

## 26. 最终判断

申请中心不是“信息展示页”，而是“学生完成提交前任务的工作台”。它的体验目标不是把所有信息告诉学生，而是让学生顺着一个清楚的路径完成：

1. 选学校和项目。
2. 确认学生信息。
3. 核对费用。
4. 付款或确认免费发送。
5. 最终发送给学校。
6. 发送后追踪学校处理。

只要页面继续把多个任务混在一起，学生就会觉得复杂。只要页面能像 UCAS 那样把任务拆成清楚的 section，再用 CUAC 自己更轻、更少字、更适合国际学生申请中国高校的视觉表达，申请中心就会从“看起来有很多功能”变成“学生真的知道下一步该做什么”。

## 27. 第四版全面优化方案

### 27.1 这次要解决的核心问题

用户最新反馈已经很明确：当前层级方向接近了，但视觉和交互仍然粗糙，尤其是申请中心还没有真正达到 UCAS 那种“清楚、少字、一步一步完成”的状态。

这次优化不再追求继续堆功能，而是把申请中心压缩成一个清晰任务系统：

- 首页只回答：现在进度怎样，下一步做什么。
- 必填项用 section 卡片呈现。
- 点 section 进入独立页面。
- 每个详情页只处理当前 section。
- 所有必要 section 完成后，才进入付款和发送。
- Hub 只做入口和提醒，不承载申请中心的具体流程。

判断标准很简单：学生打开页面后，5 秒内应该知道自己该点哪里；进入 section 后，只看到当前要完成的表单；完成后自然进入下一项。

### 27.2 产品结构最终建议

申请中心建议拆成 6 个一级状态页：

| 页面 | 路由 | 页面职责 |
| --- | --- | --- |
| Application overview | `application.html` / `#overview` | 看进度和下一步 |
| Choices | `#choices` | 添加、排序、确认学校项目 |
| Student info | `#profile` | 进入学生信息 section 卡片 |
| Student info detail | `#profile/{section}` | 独立填写一个 section |
| Fee review | `#fee` | 核对服务费和费用原因 |
| Payment | `#payment` | 支付或确认免费发送 |
| Send review | `#send` | 发送前最终确认 |
| Submitted tracker | `#submitted` | 发送后学校处理追踪 |

这不是一个长页面上的锚点集合，而是一组页面状态。每个状态都要隐藏其它状态的主内容，避免“点了以后在下面展开”的感觉。

### 27.3 Application overview 优化方案

目标：像 UCAS 的 application status，一眼看到进度和关键 section，不要像产品介绍页。

页面保留：

- `Application center`
- 一句说明：`Complete each section, then send to schools.`
- 4 个申请事实：申请季、学校数、待付金额、最早截止日。
- 4 个 required section：Choices、Student info、Fee review、Send。
- 一个明确的 Next CTA。

页面删除或降级：

- 不展示完整学生信息表单。
- 不展示文档矩阵详情。
- 不展示学校发送追踪，除非已经 submitted。
- 不展示长解释。
- 不展示 Add choice 弹窗。

视觉建议：

- 顶部状态卡不要过高，保持横向稳定。
- 进度环可以保留，但数量要克制，最多表达一级流程。
- Section 卡片用白底、轻边框、底部状态条。
- 完成态用绿色底条；当前态用 teal 细线；锁定态用灰色。
- 主 CTA 只保留一个，不要多个同级按钮抢注意力。

### 27.4 Choices 页面优化方案

目标：让学生完成“选哪些学校项目、顺序是什么”。

页面结构：

- 左侧主列：Add choice 大入口 + 已选学校列表。
- 右侧辅助列：Why this order / Agent 建议。
- 底部：Confirm choices。

需要保留：

- 学校名；
- 项目名；
- 城市；
- 截止日；
- 学费或预算信号；
- 当前角色：Main / Backup / Funding。

需要减少：

- 每张 choice 卡不要写长解释。
- Agent 建议只给短理由，不写完整申请策略。
- 不在 Choices 页面解释 payment、documents、school contact，这些属于后续页面。

交互规则：

- Add choice 只能由点击触发，不因 URL 自动弹出。
- 新增 choice 后回到 choices 列表。
- Confirm choices 后进入 Student info。
- 已发送后不能直接删除 choice，应提示走撤回或学校联系流程。

### 27.5 Student info overview 优化方案

目标：完全采用 UCAS 式 section 卡片，不在当前页面下方展开表单。

建议 section：

| Section | 目的 | 来源 |
| --- | --- | --- |
| Personal details | 姓名、邮箱、生日等身份字段 | 注册已有则只确认 |
| Nationality details | 国家、护照地区、当前所在地区 | 注册 / onboarding 复用 |
| Contact details | 电话、WhatsApp、WeChat、备用邮箱 | 申请中心可补充 |
| Education | 当前学校、学历阶段、目标层级 | 注册已有则只确认 |
| Finance & exams | 预算、奖学金、HSK、IELTS、CSCA | onboarding + 后续更新 |
| Documents | 护照、成绩单、翻译、语言证明状态 | 后续维护 |
| What schools see | 学校可见摘要 | 系统生成 + 学生确认 |
| Consent | 授权 CUAC 发送哪些信息 | 申请中心必须确认 |

卡片内容规则：

- 标题不超过 3 个词。
- 描述只写一行。
- 底部状态只写：`Section complete`、`Start section`、`Review section`、`Needs update`。
- 点击卡片进入 `#profile/{section}`。
- 不在卡片区下方显示任何表单。

字段原则：

- 注册时填过的字段默认带入。
- 带入字段显示为已填，可编辑或确认。
- 申请中心只补充“学校发送所需”信息。
- 不要求学生重复填写已经存在的数据。
- 每个字段需要标明是否会发给学校，但不要在主视图用长文解释。

### 27.6 Student info detail 优化方案

目标：进入独立 section 页后，像 UCAS 一样左侧导航、右侧表单，只处理一件事。

页面结构：

- 顶部：当前 section 标题，例如 `Personal details`。
- 返回：`Return to application overview` 或 `Return to student info`。
- 左侧：所有 Student info sections。
- 右侧：当前 section 表单。
- 底部：Save this section、Back、Next。

视觉规则：

- 详情页不显示总览 section 卡片。
- 表单主列宽度控制在 640 到 760px。
- 左侧导航宽度稳定，当前项高亮。
- 表单字段纵向排列，避免为了填满宽度做怪异双列。
- 已带入字段可以显示浅底 read-only，但要允许编辑入口。
- 每个字段最多一行帮助文案，复杂解释进 tooltip 或 guide。

交互规则：

- 保存当前 section 后才允许标记 complete。
- Next section 进入下一个独立路由。
- 刷新页面仍停留当前 section。
- 未完成必填字段时，在当前字段附近提示，不弹全局大弹窗。
- `Mark complete` 不应该成为理解负担，未来可改成“保存后自动判断完成”。

### 27.7 Fee review 优化方案

目标：学生理解为什么付费、付多少、什么时候付，不混入支付动作。

页面只回答四件事：

- 第一所学校是否包含；
- 额外学校如何计费；
- 本次总额；
- 付款后 CUAC 会进入发送确认，不自动发送。

推荐结构：

- 左侧：总额 + 学校费用明细。
- 右侧：费用规则 + 发送前检查。
- CTA：`Continue to payment`。

需要避免：

- 不暴露内部 payment object、providerTxnId 等字段。
- 不写复杂商业系统说明。
- 不让 `Fee review` 看起来只是一个状态标签。

### 27.8 Payment 页面优化方案

目标：支付是独立确认页，不是弹窗，也不是自动发送。

页面结构：

- 标题：`Confirm payment`
- 总额；
- 付款方式或 demo 状态；
- 失败提示；
- CTA：`Confirm payment`
- 次按钮：`Back to fee review`

交互规则：

- payment 成功后进入 `#send`。
- payment 失败后留在 `#payment`，明确说明 nothing has been sent。
- 免费发送时也要有确认动作，不能绕过 review。

### 27.9 Send review 优化方案

目标：这是发送前最后一页，必须让学生知道“哪些学校会收到什么”。

页面保留：

- 学校数量；
- 学校列表；
- 每所学校自己的项目；
- Student info 已完成；
- Payment 已完成；
- Consent 已确认；
- CTA：`Send to selected schools`。

页面避免：

- 不再展示 choices 编辑；
- 不再展示完整表单；
- 不再展示收费规则；
- 不自动发送。

必须明确：

- 每所学校只收到自己的 school-program record。
- CUAC 不上传文件给学校，学校后续可能向学生要文件。
- 发送不等于录取保证。

### 27.10 Submitted tracker 优化方案

目标：发送后从“提交前任务”切换为“学校处理追踪”。

页面状态：

- Sent；
- Viewed；
- Contacted；
- Documents requested；
- Offer / rejected / withdrawn，后续可扩展。

页面重点：

- 哪所学校已查看；
- 哪所学校未查看；
- 哪所学校要求补材料；
- 学生下一步该等待还是补充。

发送后页面不应该继续显示：

- Add choice；
- Fee review；
- Payment；
- Submit checklist；
- 未发送前的任务卡片。

### 27.11 Hub 与申请中心边界

Hub 应该极简：

- 欢迎学生回来；
- 当前申请状态一句话；
- 进入申请中心；
- 新建申请入口；
- 少量提醒；
- 保存内容和推荐内容。

Hub 不应该展示：

- Student info section 卡片；
- Fee review 明细；
- Payment 状态机；
- Send review；
- 文档矩阵；
- 大段申请说明。

申请中心才展示完整流程。这样学生不会在 Hub 和 Application center 之间看到重复内容。

### 27.12 文案压缩标准

每个页面首屏文字必须严格控制：

| 页面 | 首屏文字上限 |
| --- | --- |
| Overview | 1 个标题 + 1 句说明 |
| Choices | 1 个标题 + 每张卡 1 行摘要 |
| Student info overview | 1 个标题 + section 卡片 |
| Student info detail | 当前 section 标题 + 字段标签 |
| Fee review | 1 句费用说明 |
| Payment | 1 句付款说明 |
| Send review | 1 句发送说明 |
| Submitted | 1 句下一步说明 |

删除优先级：

1. 删除解释功能如何使用的文字。
2. 删除重复说明。
3. 删除内部系统词。
4. 删除不会帮助学生行动的形容词。
5. 删除同一页面里第二个“下一步”提示。

### 27.13 视觉设计原则

整体关键词：清爽、稳定、少字、任务感。

必须坚持：

- 页面最大宽度稳定，不出现奇怪窄栏。
- 主页面使用 3 列 section 卡片。
- 详情页使用左导航 + 表单主列。
- 卡片白底、轻边框、轻阴影或无阴影。
- 状态条比彩色背景更适合任务卡。
- CTA 颜色统一，主按钮必须明显。
- 警告用 amber，危险操作用 red，不滥用彩色背景。

禁止继续出现：

- 大面积渐变装饰；
- 厚彩色边框；
- 内外卡片嵌套；
- 过多圆环同时出现；
- 卡片宽度忽大忽小；
- 表单在页面中间形成小岛；
- 英文内部字段直接暴露给学生。

### 27.14 后端和数据准备要求

申请中心要成为完整网站的一部分，后端需要支持这些对象：

- Student；
- StudentProfile；
- ApplicationSet；
- ApplicationChoice；
- ApplicationSectionStatus；
- FeeQuote；
- PaymentOrder；
- SchoolSubmission；
- SchoolSubmissionEvent；
- SchoolVisibleRecord；
- ConsentRecord；
- DocumentReadiness；
- ExamReadiness；
- AgentRecommendation。

关键状态需要可统计：

- 注册学生数；
- 学生来源国家；
- 学校数；
- 学生完成资料情况；
- 加入 checklist 情况；
- 付费情况；
- 发送给学校情况；
- 学校查看和处理申请情况；
- HSK / CSCA / IELTS 准备情况；
- 经济情况和奖学金需求。

这些数据不仅服务运营后台，也要驱动学生端的 section 完成状态和下一步提示。

### 27.15 下一轮落地顺序

建议执行顺序：

1. 先整理 `application.html` 默认总览，压缩首屏文字。
2. 优化 `#profile`，只显示 UCAS 式 section 卡片，不展开表单。
3. 优化 `#profile/{section}`，做成真正独立详情页。
4. 对齐 Student info 字段与注册/onboarding 字段。
5. 精修 `#fee`，让 Fee review 独立、简单、可信。
6. 精修 `#payment`，明确支付后只进入 send review。
7. 精修 `#send` 和 `#submitted`，区分发送前和发送后。
8. 回头精简 Hub，删除与申请中心重复的申请流程内容。
9. 做路由刷新测试，确保所有 hash 直达不白屏、不弹窗。
10. 做桌面和移动端视觉 QA。

第一轮实现目标：

- 默认进入 `application.html` 不弹窗。
- 总览不展示内联表单。
- Student info 卡片点击进入独立页面。
- Fee review、Payment、Send 都能跳转。
- 主界面文字再减少 30% 到 50%。
- 页面宽度稳定，卡片不再显得粗糙。

### 27.16 验收标准

产品验收：

- 学生打开 application center 后知道下一步。
- 学生能按 section 一个个完成。
- 学生不会被自动弹窗打断。
- 学生不会在 Hub 和 Application center 看到重复流程。
- 所有必要项完成前不能最终发送。
- 发送后页面切换为学校追踪，而不是继续编辑流程。

设计验收：

- 卡片像任务入口，不像表格块。
- 页面视觉不沉重。
- 字少但含义清楚。
- CTA 一眼能看到。
- 状态表达统一。
- 没有内部字段裸露。
- 没有奇怪宽度和布局跳变。

技术验收：

- `application.html` 默认落在 overview。
- `#choices`、`#profile`、`#profile/{section}`、`#fee`、`#payment`、`#send`、`#submitted` 都可直达。
- 刷新不白屏。
- Hub 跳申请中心不触发 Add choice modal。
- 点击 Add choice 才打开 modal。
- Payment 成功不自动发送。
- Send 按钮只在条件满足后可用。

### 27.17 当前设计判断

当前版本已经把方向从“长页面展示”拉回了“申请任务系统”，这是对的。但它还没有真正完成 UCAS 式申请中心的体验，主要差距在：

- 视觉还不够干净；
- 主页面文字仍偏多；
- Student info 卡片和详情页之间的页面感还不够强；
- 某些页面仍像原型拼装；
- Fee / Payment / Send 的页面意义还需要更清楚；
- 后端状态模型还没有完全反哺前端。

下一步不应该继续零碎补样式，而应该按这份方案做一次结构化精修：先把总览和 Student info 做到真正清楚，再处理 Fee、Payment、Send。这样申请中心才会从“看起来有功能”变成“学生真的能顺着完成申请”。

## 28. 第四版第一轮落地记录

日期：2026-08-28

本轮先处理 Student info 的结构语义和视觉稳定性，不继续扩展新功能。

### 28.1 已落地内容

- 将 Student info section 的公开路由语义从内部 key 收敛为用户可理解的命名：
  - `#profile/personal`
  - `#profile/nationality`
  - `#profile/contact`
  - `#profile/education`
  - `#profile/finance`
  - `#profile/documents`
  - `#profile/school-summary`
  - `#profile/consent`
- 保留旧路由兼容：
  - `#profile/account` -> `#profile/personal`
  - `#profile/background` -> `#profile/education`
  - `#profile/funding` -> `#profile/finance`
  - `#profile/notes` -> `#profile/school-summary`
- Student info overview 的卡片继续保持 UCAS 式 section 入口，不在下方展开表单。
- 卡片视觉从“原型浮层”收敛为：
  - 白底；
  - 轻边框；
  - 无阴影；
  - 稳定高度；
  - 底部状态条。
- 修正申请中心总览宽度：
  - Hub 使用 `min(1720px, calc(100vw - 144px))`；
  - Application overview、Choices、Student info overview 等总览态同步使用同一宽度；
  - Student info overview 在宽屏下改为 4 列 section 卡片，两行承载 8 个 section；
  - 只有真正的 profile detail 表单页继续保持较窄阅读宽度。
- Profile detail 页面宽度从 1180px 收敛到 1040px，表单主列从 760px 收敛到 720px，让详情页更像独立填写页。
- 详情页左侧导航维持稳定宽度，右侧只处理当前 section。
- `Return to overview` 改为 `All sections`，避免和 Application overview 混淆。

### 28.2 本轮刻意没有做

- 没改 Fee / Payment / Send 的业务流程。
- 没改 Hub。
- 没新增字段。
- 没引入真实后端。

原因：本轮目标是先把 Student info 的“section 架构”和“独立页面感”打稳。Fee / Payment / Send 下一轮单独精修，避免同时改动太多导致路由回归。

### 28.3 验收点

- `design-lab/application.*` 与 `frontend/public/application.*` 已保持同步。
- 测试增加了新 section 路由语义、旧路由兼容、profile card 视觉约束和 detail 页面宽度约束。
- 后续需要继续做浏览器视觉 QA，重点看：
  - `application.html#profile`
  - `application.html#profile/personal`
  - `application.html#profile/finance`
  - `application.html#profile/school-summary`

## 29. 第四版第二轮落地记录

日期：2026-08-28

本轮处理用户反馈的两个问题：申请中心总览宽度又变窄，以及 Fee / Payment / Send 仍有原型化、字段化表达。

### 29.1 宽度规则

- Hub 的宽度规则继续作为学生端工作台的基准：`min(1720px, calc(100vw - 144px))`。
- 申请中心总览、Student info overview、Fee review、Payment、Send review 等总览型页面必须使用同一宽度。
- 只有进入单个资料 section 后，才使用较窄宽度，保证长表单可读、可填。

### 29.2 支付与发送表达

- Fee review 只说明“总额、学校数量、额外学校费用、是否可进入付款”。
- Payment 页面不再展示 `CommerceOrder`、`PaymentCreateResult` 等内部模型字段。
- 支付记录改成学生可理解的 `Payment reference + status`。
- 删除旧版 Payment modal，所有支付动作都进入独立 Payment 页面。
- 旧状态恢复时只兼容跳转到 Payment 页面，不再恢复遮罩弹窗。
- Payment 成功后只进入 Send review，不自动发送给学校。
- Send review 保留最后确认动作，避免“付款”和“发送”在同一步里混淆。

### 29.3 文案收敛

- 删除“Confirm payment and send”这类混合动作文案。
- 申请中心主说明从 `Complete each section, then send to schools.` 收敛为 `Complete, pay, send.`。
- Submitted 后的说明从长段落收敛为三条短状态：
  - School record sent
  - Files stay with you
  - Watch status
- 保持页面可解释，但避免把后台流程、字段名、过多政策说明直接压给学生。

### 29.4 下一步仍需视觉 QA

- 检查 `application.html#info` 是否与 Hub 同宽。
- 检查 `application.html#fee`、`application.html#payment`、`application.html#send` 在宽屏下是否不再显窄。
- 检查移动端下 section 卡片是否自然换行。
- 检查支付页是否不再出现内部字段名。

## 30. 第四版第三轮落地记录

日期：2026-08-28

本轮继续处理申请中心的视觉与流程语义：

- 顶部状态从 5 步补齐为 6 步：Choices、Student info、Fee review、Payment、Send、Overall。
- Fee review 只表示费用审核完成，不再等同于已付款。
- Payment 独立解锁 Send，Send 必须在付款完成后才能进入。
- 总进度算法加入 Payment 完成状态，避免已付款后进度表达断层。
- `#info` 页面语义改为 Student information，不再使用 `submission` 这种混合命名。
- Student info section 卡片高度加大，并使用轻渐变背景，让它更像 UCAS 式 section card，而不是薄按钮。
- 顶部圆环不再塞入 `6 choices` / `Order confirmed` 这类长文本；圆环只显示短值，完整含义放到下方导航标题和状态，保证它作为导航仍然清楚可读。
- 顶部流程在 1280px 以下先切成单列状态卡，避免 6 个步骤在临界宽度被挤压。
- Student info 卡片加入非常轻的类型渐变，Finance、Documents、学校可见信息等 section 扫描性更强，但仍保持克制。
- Payment 代码语义从 modal 改成 page，右侧支付步骤改为纵向步骤，避免窄侧栏里三枚横向胶囊拥挤。
- 旧的全局 Document matrix 从 Student info 流程中移除，材料差异只在 Documents 独立详情页中展示，避免总览页又退回“所有信息摊开”。

设计判断：

- 总览型页面继续与 Hub 同宽，保证学生工作台视觉统一。
- Student info overview 是“section 入口页”，应该宽、清楚、可扫描。
- 单个 Student info detail 页面外层也与 Hub 同宽，避免页面显窄；只限制内部表单编辑列宽，保证填写舒适。
- 视觉可以有轻渐变，但不能变成厚重彩色边框或过强装饰。

## 31. 第四版第四轮落地记录

日期：2026-08-28

本轮继续处理申请中心详情页与 Student info section 卡片的视觉问题：

- `application.html#profile/nationality` 等设置详情页外层宽度改为与 Hub 一致，使用 `--page-width`。
- 详情页内部编辑架构从 `230px + 720px` 调整为 `260px + 960px`，左侧 section 导航更稳定，右侧表单不再挤在页面中间。
- 详情页底部 `All sections / Previous section / Next section` 操作区跟随新的编辑列宽对齐。
- Student info section 卡片从 184px 提升到 218px，高度更接近 UCAS 式 section card。
- Section 卡片标题从 22px 提升到 26px，状态栏从 13px 提升到 15px，确保卡片作为导航入口时有足够层级。
- Section 卡片底部状态条加高，分隔线加粗，状态反馈更清晰，但不增加额外说明文字。

设计判断：

- 申请中心不是普通设置页，它是学生完成申请的主工作台；详情页宽度应与 Hub 保持体系一致。
- 表单不能无限拉宽，所以外层宽、内容列受控，是更合适的折中。
- Student info 卡片承担“进入 section 页面”的职责，视觉权重不能太小，否则用户会误以为只是静态摘要。

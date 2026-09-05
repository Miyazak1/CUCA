# CUAC 逐项目材料预览合同

日期：2026-09-01。范围：BE-0716 的本人材料核对。已实现并完成本地验收，最终结果见 [演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。前端仍由用户修改，本轮不读取其他 demo 或修改页面。

## 1. 产品边界

学生先选择具体项目及批次，再明确选择希望核对的申请资料。服务器根据本人数据库记录生成短暂预览，供学生检查内容与范围。它与只返回存在性、数量和规则引用的 preflight 不同。

本接口不是同意、正式材料快照、学校收件或递交许可。即使所有资料齐全，响应仍为 mode=self_review、canSubmit=false、persisted=false、consentRecorded=false。没有学校、Ops 或 Agent 读取入口，不保存预览正文或将其写入审计/日志。

正式流程仍须实际审核的告知、适用人群与接收范围、逐项目明确确认、独立保存的材料版本、权威政策与费用权益复核。不能把预览 hash、读取接口、客户端 confirmed=true 或“资料完整”当作授权。预览不表示学校要求或允许接收所选字段。

## 2. 接口

`POST /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/material-preview`

这是带结构化选择的只读计算，不是业务写命令。无查询参数，不使用 Idempotency-Key，不提供 GET/PATCH/DELETE。

```json
{
  "expectedVersions": { "applicationSet": 2, "applicant": 1, "education": 1, "assessments": 1 },
  "selection": {
    "applicantFields": ["fullName", "contactEmail"],
    "educationRecordIds": [],
    "assessmentRecordIds": []
  }
}
```

四个版本和三个选择数组必须明确给出。applicationSet 为正整数，其他版本可为 0，表示该资料尚不存在。没有默认全选，允许全部空选以检查目标。字段仅限 fullName/contactEmail/citizenshipCountry；教育与考试分别最多 20/40 条 UUID，重复、稀疏数组、未知字段和客户端正文均拒绝。集合顺序不表示官方志愿；选择按固定字段序与 UUID 排序规范化。

教育记录按九个既有资料字段完整预览；考试按既有原始分项、分制、日期、报告形式预览，仍标记 unverified，不自动转换成绩或筛选出“最佳”结果。一个记录是本轮选择粒度，不能把同一次考试随意拆成拼分结果。只返回选中记录，不返回其他记录、userId、私有备注、偏好、学校收件正文、Agent 或支付数据。

## 3. 权限与一致性

必须为本人有效 student persona、student surface、student_action purpose、session/step_up，无学校 tenant，具备 student_pii 与 education_record 分类权限。数据库再次检查 active 账号、未撤销 student grant 和精确 parent/choice/owner，不能相信 Cookie 解析前的旧上下文或请求头声明。

只为仍可编辑且未形成 school_application 的草稿生成新预览，目标必须有明确且关系正确的 program/intake。目录是否开放、截止时间、奖学金及官方规则由独立 preflight/正式复核决定，本接口不借此宣布可提交。不存在、移除、错误 parent、跨学生选择或资料 ID 均脱敏 403；本人版本过期、冻结或目标未绑定为 409。

一个独立 READ ONLY / REPEATABLE READ 事务先读取目标和所有版本，再按 owner + 选中 ID 读取资料。未选的资料内容不进入结果查询。所有版本必须与客户端声明的已读版本一致；这并不证明用户实际阅读或同意了内容；即使某个未选字段变动导致资料版本变化，也要求重新核对。读取期间提交的变化不会混入旧快照，下一请求观察新版本。

已发起的只读请求按其数据库快照观察权限，不承诺在途撤权取消所有已开始响应。它不持写锁、不授权未来请求，后续确认/正式提交必须重新检查当前权限、状态与全部版本。

## 4. 内容与恢复

content 包含固定格式版本、申请组/choice/学校/项目/批次标识、四个来源版本、规范化选择及白名单资料。checkedAt 使用数据库时间；contentSha256 由服务器按固定字段顺序和账号范围生成，不包含 checkedAt，因此相同账号/目标/版本/内容的重复预览摘要稳定。不同账号、项目或批次不能共用摘要。

摘要不是签名、验证码、承诺、幂等收据或未来授权 token，服务端不会接受客户端上传的 content 作为正式材料。返回数据不得自动持久化到 localStorage、分析埋点或 Agent 上下文。将来前端需要自己管理短暂预览状态，切换账号/项目后清空。

响应有界，损坏资料/版本/超量结果返回脱敏 503，不自动修复、截断或拿旧值兜底。版本冲突返回 409，调用方重新读版本，保留用户选择供比较，不自动把 expectedVersions 更新后确认。网络失败可明确重发只读请求，无任何副作用可重放；旧版本变动时仍拒绝。

## 5. 验收

- 严格嵌套输入、明确空选、重复/上限、大小写 UUID、未知字段与未配置存储。
- 学生角色/用途/分类、当前账号与角色、精确项目/批次、不同 owner/parent/资料 ID 隔离。
- 只投影选中字段与记录、真实原始分数/日期，不返回私有备注或其他记录。
- 四个来源版本竞争、读取中途更新/删除、同快照值与下一次请求差异；实际 READ ONLY 拒绝误写。
- 摘要稳定与目标/版本/内容绑定；损坏字段/超量正文脱敏，无部分结果或任何数据库写入。
- 构建后的真实 HTTP 验证安全头、无 Cookie、Origin/body/Fetch Metadata、角色撤销和无其他方法。

本轮不新增 schema 或修改已封存迁移，不开放正式授权/提交、真实支付、邮件、文件上传、学校/Ops 写流程或 Agent 私有数据工具。


最终本地验证：425/425 常规后端、285/285 数据库、361/361 数据库与真实 HTTP 联合测试通过，其中本轮新增九项常规、十二项数据库和五项网络场景；数据库与联合入口有重叠。类型检查、ESLint、55 个显式 API 导出入口检查和迁移快照校验通过。Student/Auth 业务写方法仍为 26 个。

迁移仍为 21 条、12 份快照、46 表；发布摘要仍为 `69d8329afe046785bd42da5a44ea44e0a7c61ffe32a90856d7256b243ce7c1b6`。本轮未改已封存 SQL、快照、运行模块或依赖锁，未重跑 Linux 迁移；先前同摘要 7/7 结果不作为本接口的 Linux 部署验收。临时数据库与 HTTP 服务已由演练器停止、清理，独立归属标签检查见统一记录。

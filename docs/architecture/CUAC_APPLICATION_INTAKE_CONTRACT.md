# CUAC 项目入学批次与草稿申请合同

日期：2026-08-31。范围：BE-0716 的项目/批次身份基础，不是完整提交、计费或上线批准。最终验收结果统一见 [PostgreSQL 演练记录](CUAC_POSTGRES_REHEARSAL_REPORT.md)。

## 1. 领域规则

- 学校是归属和接收方，不是合并申请的键。一个已明确目标的草稿指向一个 program 和一个 program_intake；同校不同项目保持独立。
- 草稿阶段允许同一项目的不同入学批次分别准备。它们不是同一份申请，也不意味着学校允许同时正式递交。学校/院系数量限制、志愿互斥、录取选择和官方投递方式在提交策略中另行核验。
- 同一申请集合内，同一 program + intake 只能有一条未移除 choice。不同集合暂可有相同草稿目标；账号级正式递交去重必须在 submit 阶段单独建立，不能靠新建集合绕过。
- 兼容旧学校意向及未指定批次的项目草稿，不自动从 targetIntake 文本、当前时间、排序或“最近一期”猜测身份。集合/学生资料的 targetIntake 是意向标签，不是批次外键。
- 未指定批次时，保留原先“集合内同项目最多一个有效草稿”规则；未指定项目的学校意向沿用旧行为。一个未绑定草稿与该项目的明确批次草稿可以并存，界面应标明待确认；完整提交必须拒绝未补齐目标的记录。
- 身份字段不通过备注/奖学金 PATCH 修改。换项目、换批次或把旧意向明确为具体目标，使用原有移除和带新幂等键的添加命令，生成新 choice ID。两个命令不是原子替换；失败时须显示并恢复当前状态，不能宣称已成功换项。
- 当前 program_intakes 以项目、term、year 唯一；applicationRound 仍是描述字段，不是独立批次身份。多轮投递、校区/授课方式等差异需要真实招生规则和后续增量模型，不用随意更换 term 绕过唯一约束。

## 2. 接口与安全

### 公开批次读取

`GET /api/v1/catalog/programs/:programId/intakes?limit=20&offset=0`

- 不要求注册，仍经统一 HTTP 安全入口及 public_catalog policy；路径 programId 必须是 UUID，最多返回 100 条，沿用目录分页约定。排序为 year、sortOrder、term、id，不能把顺序当身份。该入口不提供关键词搜索。
- 仅返回 active 学校、active 项目下的 open 批次；deadline 已过或 openDate >= deadline 的矛盾窗口不返回。不存在、未公开或无可选批次均为 `200 { data: [] }`。
- 字段白名单：id、programId、intakeTerm、intakeYear、openDate、deadlineDate、deadlineLabel、applicationRound、status。不读或返回学生、账号、申请、支付或审计内容。
- openDate 尚未到达或 deadline 尚未配置时，允许展示并准备草稿；这不是“现在可提交”的承诺。正式提交必须再核验数据库时钟、完整窗口、来源可信度及学校规则。
- 分页读取不是跨请求的一致快照；目录变化后客户端重新查询。HTTP no-store 不意味着结果永久有效。

### 草稿添加与读取

原 `POST /api/v1/student/application-sets/:applicationSetId/choices` 新增可选 programIntakeId，仍必填 Idempotency-Key。提供非空批次时必须同时提供有效 programId；字段类型/UUID 错误为 400。

Student service 与 HTTP 入口共用字段白名单。paid/status 等未知业务字段仍拒绝；原有 userId/role/tenantSchoolId 等 authority 字段沿用忽略规则，绝不作为授权依据。归属仍从会话和路径确定；当前学生角色、教育记录权限、有效账号、父集合 draft/未冻结条件继续强制执行。

写入 SQL 校验所选 intake 确属 program，program 确属 school，三者可用；用数据库时钟排除过期/矛盾窗口。对 intake 获取 FOR SHARE，关闭更新先提交则等待中的添加拒绝，添加先核验则关闭更新等待其事务结束。草稿成功后批次仍可关闭；已有记录保留，正式提交不能沿用此前的可用性判断。

- 不存在、跨范围或不可选的批次统一返回脱敏 403，不能借 ID 探测私有目录。
- 同集合重复目标、父集合不可编辑仍为 409；唯一约束是最后一道去重保护，失败不留下 choice、revision 推进、未完成收据或成功审计。
- 选择 DTO（添加、列表、详情、编辑/排序后重载）新增 programIntakeId，旧数据为 null。只回传绑定身份，不把实时目录信息混成提交快照。
- 成功添加、父集合 revision、审计、收据同事务。审计仅增加批次 ID，不记录备注正文。

本轮未注册新的 Agent 工具，也未给 Agent SQL/迁移权限。后续工具仅可消费经 Gateway 许可的公开投影。

## 3. 收据兼容

- 省略或显式 null 的 programIntakeId 不进入规范化输入对象；原字段顺序、默认值和 v1 摘要字节保持不变。旧收据不回填、不改 hash。
- 只有非空批次选择使用 request digest version 2，规范化 UUID 后将 programIntakeId 加入摘要。版本是内部摘要格式，不是新的 API 路径或可自报字段。
- keyHash 及 user + operation + key 唯一范围不变。同键从旧意向改成明确批次、改成其他批次或取消批次均为 409，不能在 v1/v2 各执行一次。
- 原键恢复读取原 choice 的当前 owner-scoped 表示，包括批次后来关闭/父组冻结时；恢复不是新申请，也不证明该目标现在可递交。移除后原键仍拒绝复活。
- COMMIT 确认丢失不自动重试或换键。明确恢复只能用原键及原输入；更改意图使用新键。保留/限额和备份同点恢复仍遵守 [申请幂等合同](CUAC_APPLICATION_IDEMPOTENCY_CONTRACT.md)。

## 4. 迁移与发布

`0013_application_choice_intake.sql` 是第 14 条增量迁移：

1. 增加 nullable application_choices.program_intake_id，旧记录保持 null，其他字段/状态/revision/收据不变。
2. 增加 program_intakes(id, program_id) 唯一索引，再创建 choice(intake_id, program_id) 复合外键；生成器原输出依赖顺序已在这条未发布 SQL 中修正，没有修改旧迁移。
3. CHECK 保证非空 intake 必须有 program；复合外键防止错绑，不能只靠两个各自存在的 ID。
4. 旧集合+项目部分唯一索引收窄至未绑定批次的有效 choice；新增集合+项目+批次部分唯一索引。removed_at 非空的旧记录不占有效名额。
5. 已绑定 intake 使用 ON DELETE RESTRICT，包括软移除的历史 choice。不能硬删除或改绑已引用的批次/项目来丢失申请身份；应停用目录对象。未来合法数据删除/保留处理需审查关系与收据，不把这个外键当永久保留所有个人数据的政策。

同一事务应用全部 DDL；失败不得留下已删除旧索引却没有新约束的状态。非空升级、完整 schema 对比、重复迁移、受限 Linux 运行和中断恢复都属于发布门槛。

部署须先迁移并升级全部读取/写入实例，再开放新字段与批次选择。排空不识别批次的旧后端及脚本；不能混跑后由旧实例静默丢弃批次或使用旧摘要。回退先暂停相关写入，保留新列、绑定和历史收据；已有绑定数据时不能恢复旧唯一索引或回退旧代码继续接单。

## 5. 下一阶段

后续 `0020` 已为 school_applications 增加精确批次副本和生成目标键外键；仅复制已关联 choice 明确绑定的批次，未知仍未知，项目错配时拒绝整个升级。已有学校记录后项目不能硬删除，学校投影新增 programIntakeId；见 [目标一致性合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md)。这不改变本合同的学生 v1/v2 摘要或批次输入，也不代表已经生成提交材料快照。

本轮不启用正式提交。下一步按稳定领域模型补申请人资料及同意版本、逐项目白名单快照、只读 preflight；再处理跨集合正式申请去重、学校数量/互斥策略、报价/权益、原子提交及 outbox。批次数量不是收费单位，Billing 现有 preview 不构成新价格批准。

前端实施更新（2026-09-03）：申请中心的 choice 读取、新建集合、添加、移除和排序已接入学生 API；添加时只能从公开批次接口选择真实 `programIntakeId`，不再从 targetIntake、硬编码选项或浏览器演示状态猜测批次。页面启动时也不再显示伪造 choice。该更新尚未覆盖申请人资料、材料选择、支付、授权、快照、preflight 与原子提交 UI，不能据此宣称完整申请前端已经上线。

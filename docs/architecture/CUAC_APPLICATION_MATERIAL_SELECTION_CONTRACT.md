# CUAC 逐项目材料选择草稿合同

日期：2026-09-01。范围：学生本人逐项目保存材料选择；不是提交授权、材料快照或高校收件。验证状态以本地演练记录第 49 项为准，未批准生产上线。

## 1. 领域边界

一个学生的一个 choice 对应一个明确招生项目及入学批次。学校是归属和展示分组，不把同校项目合并成一条申请；申请集合只是组织容器。每个 choice 可有一份独立材料选择草稿，不能自动复制其他项目的选择。

program 应表示实际可申请的招生单位，不一定等于毕业专业名称。按学院、大类招生时，不能把入学后分流方向伪装成可单独递交的项目。北大 2026 本科说明按院系志愿招生、申请时不填具体专业；其研究生简章允许最多两个志愿并按志愿收费。这些是特定招生规则的例子，不是全国通用规则。来源：[本科招生学部与院系](https://www.isd.pku.edu.cn/cn/detail.php?id=529)、[2026 研究生招生简章](https://www.isd.pku.edu.cn/cn/news/detail.php?id=727)。

内部项目明细、官方递交包/志愿组和收费单位分离。是否允许同时递交多个项目、官方顺序和费用须按招生周期审核；当前 rankOrder 仅是学生内部排序。详见 [目标关系合同](CUAC_APPLICATION_TARGET_IDENTITY_CONTRACT.md) 和 [正式提交合同](CUAC_APPLICATION_SUBMISSION_BACKEND_CONTRACT.md)。

## 2. 保存什么

新增 application_material_selections，只保存：

- choice、申请集合、本人、学校、项目及批次的受约束标识。
- 独立 revision，及保存时的 applicationSet/applicant/education/assessments 四个来源版本。
- 三组显式选择：applicantFields、educationRecordIds、assessmentRecordIds。
- 创建及更新时间；不可直接填写的数据库生成 target_key。

不保存姓名、联系邮箱值、学校经历正文、成绩内容、预览摘要、告知正文或 consent=true。资料本身只在已有私有资料模块保存。字段名和记录标识仍是私有学生数据，不能作为公开或低敏 Agent 记忆处理。

字段白名单沿用 [材料预览合同](CUAC_APPLICATION_MATERIAL_PREVIEW_CONTRACT.md)：fullName、contactEmail、citizenshipCountry，最多 20 个教育记录 ID、40 个考试记录 ID。三组数组必须显式提供，规范化顺序/UUID，拒绝重复、稀疏、无效值和未知字段。持久化 JSON 最大 8192 字节，HTTP 继续受统一请求体限制。

## 3. API

同一路径提供 GET、PUT：

`/api/v1/student/application-sets/:applicationSetId/choices/:choiceId/material-selection`

GET 不接受查询参数，不自动创建草稿，不默认全选。不存在选择时 revision=0、selection=null、savedVersions=null。明确保存空数组后 selection 为三组空数组且 revision 至少为 1；这两种状态不能混淆。

PUT 只接受以下结构，不接受 userId、schoolId、角色、正文、摘要或授权字段：

```json
{
  "expectedRevision": 0,
  "expectedVersions": {
    "applicationSet": 2,
    "applicant": 1,
    "education": 1,
    "assessments": 1
  },
  "selection": {
    "applicantFields": ["fullName"],
    "educationRecordIds": [],
    "assessmentRecordIds": []
  }
}
```

响应包括 mode=selection_draft、canSubmit=false、consentRecorded=false、target、revision、editable、currentVersions、savedVersions、selection、changedSources 和 unavailable。只返回记录 ID，不返回材料正文或私有备注。全部响应 no-store；不签发新 Cookie。

- 当前有效 student 会话、student surface、student_action 且具有 student_pii 与 education_record 范围才可访问。学校、Ops、游客和 agent_tool 均拒绝；伪造身份头无效。
- 查不到本人集合/choice、已移除目标、他人或未知输入记录均为 403，不透露他人资料是否存在。
- 输入错误 400；版本过期、冻结、未绑定有效项目/批次、已形成学校记录或版本耗尽的变更为 409。
- 存储损坏或无法核对的已存引用为脱敏 503；不返回部分内容、不自动修复。底层意外失败为脱敏 500。

## 4. 版本与资料变化

每次有意义的选择或保存来源版本变化，独立 revision 加一。当前版本且规范化内容/来源完全相同为 no-op，不更新时间，不新增成功审计。旧版本即使内容相同也拒绝，不能用 no-op 绕过比较。

显式清空仍保留记录与新 revision，不能 DELETE 版本头后重置为 0。丢失响应后先 GET 核对，不自动重试事务；旧 expectedRevision 无权覆盖后续修改。最大 revision 为 2147483647，只允许当前 no-op，不能溢出或重置。

本操作不递增 application_sets.revision。集合版本仍覆盖现有 choice 增删、编辑和排序，可能因其他 choice 变化而使 savedVersions.applicationSet 过期；这只要求重新核对，不合并项目状态或修改其他项目的选择。未来授权/正式提交必须额外绑定当前材料选择 revision，不能只检查集合版本。

资料更新不自动更新保存版本。GET 的 changedSources 提示哪些来源变化；选中过的本人教育/考试记录被软移除时，unavailable 列出失效 ID。保存时不能继续选失效记录，学生须显式重新选择并提供新来源版本。其他未选资料不会自动加入。

现有材料预览 POST 仍需显式提供 selection 和四个来源版本，没有自动读取该草稿或自动勾选的捷径。客户端可用 GET 结果构造预览请求，但应明确呈现过期状态，让学生核对当前内容；新的预览仍不等于授权。

## 5. 事务与数据库边界

GET 使用独立 READ ONLY / REPEATABLE READ 事务；读取过程中其他事务提交修改时，返回同一时点的数据，下一次 GET 才观察新状态。这不是对已返回数据的追溯撤销保证。

PUT 依次锁当前 active 用户（FOR UPDATE）、有效 student role（FOR SHARE）、本人集合、未移除 choice、资料及两个记录集合版本头；锁后重新查询权限、归属、可编辑状态及所有版本。账号锁也与现有资料服务配合，避免首次资料版本头不存在时插入穿过检查。选中记录额外按 owner + ID 加共享锁，不读取正文。成功保存与 metadata-only 审计在同连接事务提交或回滚。

审计 action=student.material_selection.save，只含集合标识、选择 revision 和三组数量；不含字段值、记录 ID 列表、预览正文或学业结果。no-op 不重复记成功写审计。

数据库以 choice_id 为主键；四列复合外键固定 choice/set/student/school 归属；生成 target_key 及复合外键固定项目/批次，不允许同校错项目或单边清空。JSON CHECK 校验形状、字段名和数量/大小，服务校验 UUID、重复及嵌套记录归属；JSON 内记录 ID 没有外键，不能声称已由数据库或 RLS 保证其归属。直接 SQL 维护须单独审批并遵循锁、版本、审计协议。

## 6. 生命周期与发布

- 正常移除未提交 choice 时，同事务删除附属选择、擦除原 choice 私有草稿、写状态事件及审计；失败全部回滚。已移除 ID 的迟到 PUT 不能重建；重加项目获得新 ID，不继承旧选择。
- 硬删除 choice 的外键级联清理已验证。账号删除的完整保留/擦除流程仍属于后续数据生命周期工作，不能用局部 FK 代替产品级账号删除验收。
- 已冻结或已有学校记录的本人选择可读，但不可修改。正式提交后应使用独立不可变材料/授权证据，不能把此草稿当作学校收件数据。
- 未实现自动保留期/到期清理。生产前需定义草稿保留、账号注销、审计与备份期限；不能因为只保存 ID 就无限期保留。
- 仅追加 0022_application_material_selection。旧全部迁移/快照不改字节；非空 through-0021 数据逐表保留，不自动为旧 choice 选择任何材料。
- 发布先暂停并排空旧 choice 移除写入者，执行迁移，再整体切换新草稿与关联清理代码，最后开放入口。旧移除服务会漏清理附属选择，不能新旧混跑。
- 回退关闭新增保存和受影响的 choice 移除入口，保留表、版本及约束；不可回退到会遗漏清理的旧写入方式或删除已保存选择。

## 7. 后续闭环门槛

下一步仍是经确认的真实告知、接收范围、适用年龄/监护规则及保留期限，然后实现逐项目授权、不可变材料快照、权威复核和正式提交。需要前端接线时，以当前成熟产品契约协商，不按旧 demo 固化交互。

本轮不修改前端，不开放完整 Agent、自然语言写入、学校/Ops 写接口、文件上传、真实支付或阿里云发布。整体产品目标仍未完成，阶段计划见 [生产计划](CUAC_PRODUCTION_DELIVERY_PLAN_CN.md)。

## 8. 本地证据

- 常规后端 437/437、真库 310/310、数据库与实际 HTTP 联合 398/398、独立 Linux 迁移 7/7 通过；数据库入口有重叠，不能相加。
- 新增 6 项常规、15 项业务真库、1 项非空旧库升级和 6 项网络场景；TypeScript、后端 ESLint、61 个显式 API 安全入口及离线快照检查通过。
- 最终 23 条迁移/14 份快照与 ORM 影子库一致：47 表、622 列、182 约束、156 索引；当前 Student/Auth 业务写方法为 27 个。
- 最终同摘要迁移包：`c9ae5798a5f7cca3e9305f6b74872e4edf18830d071ace9f78bedc904589698e`。历史 0000..0021 SQL/快照、运行模块、依赖及 lockfile 未变；本地临时资源标签核对为空。

所有数据为合成样本，上述不是前端浏览器联调、阿里云或真实招生规则验收。

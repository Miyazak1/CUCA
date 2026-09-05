# CUAC 逐项目不可变材料快照合同

更新：2026-09-01。状态：`0025_application_material_snapshot` 与学生本人 GET/POST 已完成本地实现和全量门禁；后续 `0028` 已要求所有新快照只能由 current route/policy-bound v2 授权创建。它只提供正式提交前的逐项目材料冻结能力，不开放正式提交、学校读取、Agent 读取、费用权益、支付、通知或文件上传，也不是阿里云生产验收。

## 1. 领域边界

一条材料快照只属于一个已登录学生、一个 `application_set`、一个 `application_choice`、一个学校、一个项目和一个入学批次。它以当前 active 的逐项目披露授权为唯一来源：

- 同一学校的不同项目或不同批次必须生成不同授权和不同快照，不能共享正文、状态或摘要。
- 一个授权最多生成一条不可变快照。授权被撤回、supersede 或变为 stale 后，旧快照保留为历史证据，但不能再满足提交前检查。
- 新授权需要生成新的快照；不能更新旧快照正文、改绑项目或覆盖原时间。
- Application Set 只是学生组织选择的容器，不是学校级申请，也不是快照共享边界。

快照不是高校收件。它不会创建 `school_applications`，不会表示大学官方系统已经接收，也不代表学生已付款或资料符合项目要求。

## 2. 创建前置条件

公开学生入口：

`GET /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/material-snapshot`

`POST /api/v1/student/application-sets/:applicationSetId/choices/:choiceId/material-snapshot`

POST 必须带新的 `Idempotency-Key`，请求体仅允许：

```json
{
  "authorizationId": "uuid",
  "expectedAuthorizationScopeSha256": "64 lowercase hex",
  "expectedMaterialContentSha256": "64 lowercase hex"
}
```

服务端在同一事务中重新检查：

1. 当前 Cookie 会话是 active student persona、student surface、`student_action` purpose，具备 `student_pii` 和 `education_record` 分类权限，无学校 tenant。
2. 数据库中的账号和 student role 仍有效；路径 set/choice 精确属于本人。
3. 集合与 choice 仍为可编辑 draft，choice 未移除，目标具有有效的学校、项目和入学批次，尚无 `school_application`。
4. 学校、项目、批次仍可用，数据库时钟处于完整开放窗口内。
5. 指定授权是该 choice 当前 active v2 授权；授权绑定的学校、项目、批次、choice route、精确 policy version/publication/digests、选择 revision、四个来源版本、材料摘要和告知发布证据仍全部 current。v1 或 policy 字段不完整的授权一律拒绝新建快照。
6. 服务器按授权中的白名单选择重新读取本人资料，并重新生成材料内容摘要；客户端不能上传快照正文或替代数据库事实。

任一条件不满足时失败关闭。路径错误、跨学生和不存在的资源统一脱敏；本人状态或版本变化返回 409。客户端的 `paid=true`、`canSubmit=true`、角色、学校 ID、项目 ID、资料正文或其他未知字段均拒绝。

## 3. 持久化模型

`application_material_snapshots` 保存以下证据：

- 不透明 snapshot ID；
- 本人、set、choice、学校、项目、批次和数据库生成的目标键；
- 唯一 authorization ID 及其 scope SHA-256；
- 材料选择 revision、申请集合/申请人/教育/考试四个来源版本；
- 选择摘要、材料内容摘要和完整加密 payload 摘要；
- payload 格式、加密 scheme、key ID、nonce、ciphertext、authentication tag；
- 服务端 request ID 和数据库快照时间。

数据库不保存第二份明文 `selection_json`、姓名、邮箱、国籍、学校经历、考试成绩或 Agent 对话。选择元数据仍由授权证据保存；快照中的完整选择和材料正文只存在于认证加密 payload。

快照行没有 `updated_at`、状态更新或覆盖接口。应用服务不提供 UPDATE/DELETE；生产数据库角色还需通过最小权限禁止普通应用写角色修改历史行。数据库 owner/DBA 能力和备份擦除不由表约束解决，必须进入生产治理。

## 4. 加密合同

payload 使用 AES-256-GCM，随机 96-bit nonce 和 128-bit authentication tag。关联数据绑定：

- snapshot、user、set、choice、school、program、intake、authorization ID；
- authorization scope SHA-256、材料内容 SHA-256、payload SHA-256；
- payload 格式、数据库快照时间和 key ID。

因此密文不能在账号、项目、批次、授权或快照行之间交换。每次读取和 preflight 当前性判断都必须完成 GCM 认证、payload SHA-256 校验和严格结构重建；缺失旧 key、密文篡改、超限正文、未知字段或绑定不一致返回脱敏 503，绝不回退明文或只信数据库布尔值。

本地与测试 keyring 最多保留八把 32-byte key，支持写入 key 轮换和旧快照读取。生产 key material 不进入仓库、日志、命令行或普通配置文件；必须由阿里云 KMS/Secret Manager 受控注入，并在云端门禁中验证轮换、撤销、恢复和审计。本轮本地 AES adapter 不是阿里云 KMS 集成验收。

## 5. 明文 payload

解密后的固定格式为 `cuac.application-material-snapshot.v1`，仅包含：

- owner user ID；
- authorization ID 与 scope SHA-256；
- 由服务端材料预览构造器生成的固定 `content`：精确目标、四个来源版本、白名单选择、选中的申请人字段、教育记录和考试记录。

payload 不包含学生备注、其他项目/学校选择、账号邮箱身份、密码/session、支付、内部审核内容、日志、Agent 上下文或未选择记录。序列化后明文有固定上限；密文和解密缓冲也有独立上限。

## 6. API 投影和当前性

学生 GET/POST 只返回快照证据 DTO，不返回解密正文、envelope、key ID、nonce、tag、选中记录 ID 或学生资料值：

```json
{
  "id": "uuid",
  "mode": "immutable_material_snapshot",
  "persisted": true,
  "canSubmit": false,
  "target": {
    "applicationSetId": "uuid",
    "choiceId": "uuid",
    "schoolId": "uuid",
    "programId": "uuid",
    "programIntakeId": "uuid"
  },
  "authorization": {
    "id": "uuid",
    "scopeSha256": "64 lowercase hex"
  },
  "material": {
    "selectionRevision": 1,
    "sourceVersions": {
      "applicationSet": 1,
      "applicant": 1,
      "education": 1,
      "assessments": 1
    },
    "selectionSha256": "64 lowercase hex",
    "contentSha256": "64 lowercase hex",
    "payloadSha256": "64 lowercase hex"
  },
  "capturedAt": "database timestamp",
  "freshness": {
    "current": true,
    "reasons": []
  }
}
```

Preflight 只增加 `{ id, authorizationId, capturedAt, current }`，不返回上述摘要或密钥信息。只有快照解密验证通过、且对应授权仍 active/current，才移除 `MATERIAL_SNAPSHOT_UNAVAILABLE`；其他官方递交策略、Billing 权益和 submit blocker 保持，`canSubmit=false`。

## 7. 幂等、并发与审计

- idempotency digest 绑定路径目标和三个请求字段。同一键同一请求恢复原 snapshot；同一键改变输入返回 409。
- 不同键并发创建同一授权时，通过统一账号、集合、choice、授权锁顺序收敛到唯一快照，不产生两份密文。
- 原命令成功后状态变化，同一原键仍可恢复历史结果并显示当前 freshness；新键不能用 stale 授权生成新快照。
- 首次创建、命令收据和成功审计同事务提交。审计仅记录 set/choice/authorization ID、版本和记录数量，不记录正文、选择 ID、摘要、密文或 key ID。
- 审计失败必须回滚快照和收据；COMMIT 结果不明时只允许用原键恢复，不能自动换键。

## 8. 明确暂缓

本合同不实现：

- 学校/Ops/Agent 的快照读取；
- 正式 `school_application` 创建；
- 大学官方表单分组或递交 adapter；
- Billing entitlement、真实支付或退款；
- 文件、护照、成绩单扫描件和 OSS；
- 真实告知法律充分性、未成年人/监护、跨境、保留/删除结论；
- 阿里云 KMS、RDS 权限、备份恢复和生产发布。

版本化官方递交政策、显式 choice route 与 policy-bound authorization v2 已完成；下一步是经审核的正式分组适配与 Billing entitlement，二者齐备后才能设计原子 submit/receipt/audit/outbox。

## 9. 本地验收证据

- `0025` 只新增 `application_material_snapshots` 和申请命令 operation；旧 `0000..0024` 字节不变，非空旧库升级不自动生成快照或改写授权。
- 数据库通过复合外键同时绑定 user/set/choice/school/program/intake/authorization；一条 authorization 最多一条快照。表内只有认证加密 envelope 和摘要，没有第二份选择或材料明文。
- 真实 PostgreSQL 验证同校不同项目/批次隔离、旧授权升级、不同键并发收敛、原键恢复、密文篡改失败关闭及审计故障时密文/收据共同回滚。
- 当前全量结果：`test:server` 484/484、真实 PostgreSQL 348/348、生产构建 HTTP 444/444、Linux 迁移 7/7；TypeScript、后端 ESLint 与离线 schema 检查通过。
- schema 为 26 条迁移、17 份快照、50 表、694 列、224 个约束、170 个索引；发布包摘要为 `4e09262ad56ebaf7fea139b0d3f7e44977ccffedfeaa554392439326403f6b24`。全部样本为本地合成数据，临时服务、数据库、容器和运行镜像已清理。

上述数字是 `0025` 里程碑历史证据；`0028`、`0029`、`0030` 和 `0031` 的封存数字也保留为后续切片证据。当前 `0032` 链为 523/523 常规、477/477 PostgreSQL + 构建 HTTP、Linux 7/7；33 条迁移、24 份快照、58 表/864 列/310 约束/210 索引。升级演练保留旧 v1 快照为可读但 non-current 历史证据，新 Program Application 只能精确引用 current v2 snapshot；group/worker/Agent 均无快照正文权限。当前发布摘要为 `b881c770d1a830dd152cecd760cd8cdd983b634154786fd0dad4593e885b94ca`。

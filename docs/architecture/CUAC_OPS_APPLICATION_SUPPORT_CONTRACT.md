# CUAC Ops 申请支持访问合同

状态：2026-09-02，首个生产形态的 Application Set 级 Ops 支持访问会话已完成本地验证，`0041_ops_support_access_session` 已封存。它不是完整 Ops 控制台、真实员工身份系统或云端发布许可。

## 1. 能力范围

支持人员必须先以完整 CUAC ID 和固定原因打开一个短期会话，再以该会话 ID 读取最小申请投影：

- `POST /api/v1/ops/support-sessions`：JSON body 必须且只能包含 `cuacId` 与 `reasonCode`；未知 CUAC ID 返回 `data: null`，不会创建会话。
- `POST /api/v1/ops/application-lookups`：JSON body 必须且只能包含 `supportSessionId`，不再接受 CUAC ID 直接查询。
- `DELETE /api/v1/ops/support-sessions/:supportSessionId`：显式关闭当前员工拥有的会话，body 必须为空。

三个入口都拒绝 query 参数和客户端提供的 userId、role、tenant、purpose 或其他权限字段。系统不提供列表、前缀/模糊搜索、email/userId 查询或批量导出。CUAC ID 是外部引用，不是授权秘密。

## 2. 会话范围与原因

- CUAC ID 格式固定为 `CUAC-YYYY-NNNNNN`；支持会话 ID 为服务端生成的 UUID。
- `reasonCode` 只接受 `student_inquiry`、`school_inquiry`、`payment_inquiry`、`delivery_investigation`、`incident_response`。
- 会话最长 15 分钟，实际到期时间取“数据库当前时间 + 15 分钟”和当前员工授权到期时间的较早者。
- 每个会话绑定创建时的员工、`cuac_ops|cuac_admin` 角色、具体 staff grant、Application Set 和 CUAC ID。授权撤销后重新批准得到的新 grant 不会复活旧会话。
- 关闭、到期、员工授权撤销、角色撤销、账号停用或 owner/role/grant 不匹配后，查询一律失败关闭。
- 原因码不扩大返回数据；`payment_inquiry` 也不会返回 invoice、金额或提供方信息。

## 3. 最小响应

查询响应仅包含：

- CUAC ID；
- Application Set 状态、目标批次、revision、有效 choice 数量和时间；
- 已接收 submission 的状态、提交时间和 transport group 状态计数；
- 每个 Program Application 的内部申请 ID、学校/项目/批次公开身份、状态及有限时间字段。

响应不包含学生 userId、姓名、邮箱、电话、申请人资料、教育/考试记录、学生备注、材料选择、密文快照、文件、支付、invoice、provider 标识、认证数据、内部政策证据或审计日志。

## 4. 授权、事务与并发

请求必须同时具备有效账号、未撤销的 `cuac_ops` 或 `cuac_admin` 角色、Ops surface、`ops_support` purpose、普通或 step-up 会话，以及同角色、已批准、未撤销、未过期的 `cuac_staff_access_grants` 记录。普通 session 解析会把缺少当前 staff grant 的 CUAC 角色降级为 guest。

打开、查询和关闭均在业务与成功审计的同一个数据库事务中重新锁定 `users + user_roles + cuac_staff_access_grants`。查询还锁定 support session 与其精确 Application Set；事务提交前发起的 grant 撤销会等待当前已授权操作完成，撤销提交后的下一次访问立即被拒绝。审计写入失败时不会释放查询结果或留下半完成会话。

学校邀请创建/撤销也复用同一实时员工授权锁。真实 PostgreSQL 阻塞链测试证明，邀请写入已通过权限检查后，grant 撤销必须等到邀请业务与审计事务提交，关闭了 `0040` 阶段记录的竞态。

## 5. 审计与数据库约束

- 打开记录 `ops.application_support_session.open`，resourceId 为 CUAC ID，metadata 只含固定原因、是否命中和有限到期时间。
- 查询记录 `ops.application_support.lookup`，resourceId 为 CUAC ID，metadata 只含固定原因和 Program Application 数量。
- 关闭记录 `ops.application_support_session.close`，resourceId 为 support session ID，metadata 只含是否实际关闭。
- 通用脱敏保留规范 UUID 作为可复核资源引用，仍屏蔽敏感键和连续 PAN 样式内容。

`0040` 约束员工授权的 surface、角色、审批、期限、撤销状态和同用户/角色唯一有效授权。`0041` 增加 `(grant id, user, role)` 唯一引用、`ops_support_access_sessions`、精确 `(Application Set, CUAC ID)` 复合外键、固定原因、角色检查，以及 `created < expires <= created + 15 minutes` 生命周期约束。迁移不回填或推断历史支持会话。

## 6. Agent 与后续边界

这些接口没有注册为 Agent 工具。Agent 不得打开、读取或关闭 Ops 支持会话，也不得提供或推断员工角色、purpose 或 reason。未来 Agent 辅助仍只能通过独立 Tool Gateway、最小 DTO、确定性授权和审计评审。

本里程碑仍未完成岗位级权限、MFA/step-up 强制、员工入离职供应链、真实 IdP、查询限额/告警、支持记录查看、支付或材料调查投影、Ops 前端、阿里云 RDS/WAF/KMS 和浏览器 staging 验收。

## 7. 本地证据

- `npm run test:backend`：661/661；`npm exec tsc -b --pretty false`：通过。
- `npm run db:pg:rehearse`：403/403；包含支持会话、数据库约束及两条真实 grant 撤销阻塞链。
- `npm run db:http:rehearse`：503/503；构建后的生产服务器与一次性 PostgreSQL 16.13 联合通过，包含真实 Cookie 会话、打开/查询/关闭、直接 CUAC 查询拒绝和撤权后拒绝。
- `npm run db:pg:rehearse -- --write-schema-baseline`：403/403，并将基线封存至 `0041`。
- schema：42 条迁移、33 份快照、65 表、981 列、363 个约束、248 个索引。
- `0041` SQL SHA-256：`2acbf25209b18a594d005a6becd11dcd3d3ffa5f62eb79c59b7d04841ecb73f2`。
- `0041` snapshot SHA-256：`8fe3f42ec2710b7b05a5fd28bcdc0eef7ded7b5963db53f8c7d26f12d1da87f4`。
- schema baseline SHA-256：`c2f4bb0598737a6fe608761cde4fc8e833fd9698a233ad00d57f054a8296ee8c`。
- 封存后的 detached migration release：`d1b2a7950f59434bfe56bce1cf217c7da18fbac8308e8dd0d5d7d830ef2664d9`。

所有数据库、HTTP 服务和数据均为一次性本地合成环境并已清理；这些证据不代表真实员工、学生、学校或云服务验收。

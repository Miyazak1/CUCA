# CUAC 官方递交交付合同

日期：2026-09-02。状态：`0036_official_submission_delivery` 已实现、通过真实 PostgreSQL 演练并封存；真实学校或 handoff gateway 的 staging 验收尚未完成，因此不是生产递交许可。

## 1. 完成定义

学生申请被 CUAC 原子接收后只处于 `pending_submission`。这表示 CUAC 已冻结申请证据并创建交付任务，不表示学校已收到。

只有固定网关返回与 provider、payload SHA-256、receipt ID 和接收时间严格绑定的签名 `accepted` 回执，且 CUAC 在同一 PostgreSQL 事务中完成以下写入，申请才成为学校可见的 `new`：

- 插入一条不可重复的 `official_submission_delivery_receipts`；
- 将 outbox 与 group 标记为 `dispatched`；
- 将组内每条独立 Program Application 从 `pending_submission` 改为 `new`；
- 使用数据库时钟设置 `submitted_at`；
- 为每条项目申请插入 revision 1 的系统状态事件；
- 写入只含标识、摘要和数量的脱敏审计。

任一步失败全部回滚。学校队列只读取已经完成以上事务的记录。

## 2. 交付包与权限边界

- 交付包按学校隔离；一个包不得含其他学校成员。
- 每个成员继续使用 `student + program + intake` 的独立申请身份；group 只负责传输，不合并申请。
- worker 在发送前重新计算 outbox、group、member manifest，解密 AES-256-GCM 材料快照，并按授权目标重新解析和校验内容。
- 明文包只存在于 worker 的瞬时内存，不写 outbox、receipt 或 audit。
- provider idempotency key 固定为 `official-submission:${groupId}`，重试不能产生另一业务身份。
- Agent、浏览器、学校用户和客户端输入都不能选择 endpoint、provider、凭据或改写交付结果。

## 3. Provider 合同

当前唯一允许的 provider 名称是 `cuac_handoff_gateway_v1`。

- endpoint 必须是配置中固定、精确 allowlist 的 HTTPS FQDN；禁止凭据、query、fragment、非 443 端口和任意 URL。
- 请求包含 payload SHA-256、时间戳、稳定幂等键及 HMAC 签名。
- 响应正文上限 8192 bytes，只接受严格 JSON 和合法的 `accepted` 或 `not_accepted` 形状。
- 响应 HMAC、provider 名称及 payload SHA-256 必须全部匹配；无签名、超限、非 JSON、错误绑定和非法时间均视为不确定结果。
- HMAC secret 和材料快照 keyring 只能来自受保护运行环境，不得进入日志、数据库或示例文件。

## 4. 租约、重试与隔离

outbox 生命周期为：

```text
pending -> leased -> sending -> dispatched
                    |       |
                    |       -> pending       仅明确 not_accepted
                    -> quarantined           不确定、损坏或达到上限
```

- `leased` 是发送前租约；过期后可回到 `pending`。
- `sending` 表示发送意图已经和 provider/payload digest 持久绑定。该租约过期时结果可能已经到达外部系统，只能 `quarantined`，不得自动重发。
- 只有签名且明确的 `not_accepted` 可以指数退避重试，最多 5 次。
- provider exception、timeout、断连、畸形响应、错误签名、错误回执时间或 payload 损坏均隔离。
- 缺少历史材料密钥时保持发送前租约，供配置恢复；密文损坏则隔离。
- quarantined 任务需要人工对账，不能通过修改状态绕过数据库生命周期约束。

## 5. 运行与发布门禁

worker 以独立受监管进程运行：

```powershell
npm run start:official-submission-worker
```

staging/production 必须提供并保护：

- `CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID` 与 `CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON`；
- `CUAC_SUBMISSION_DELIVERY_PROVIDER=cuac_handoff_gateway_v1`；
- 固定 endpoint、精确 allowed host 和至少 32-byte 的 base64url HMAC secret；
- 有界 poll、recovery、timeout 配置；
- `CUAC_SUBMISSION_DELIVERY_WORKER_SUPERVISED=true` 的实际监管证据；
- `CUAC_SUBMISSION_DELIVERY_STAGING_ACCEPTED=true` 对应的一次真实签名回执往返证据。

最后两个值是发布审查的 attestations，不替代运行日志、网关记录、数据库 receipt、告警和人工审批。模板默认全部关闭，生产预检必须失败关闭。

## 6. 封存证据

- migration baseline：through index 36，37 条迁移、28 份 snapshot、62 张 public 表；
- 真实 PostgreSQL：`npm run db:pg:rehearse -- --write-schema-baseline`，389/389；
- schema parity：937 列、330 个约束、228 个索引；
- 交付专项真库用例：366/367，覆盖并发 claim、签收原子性、审计回滚、明确拒绝重试、不确定隔离、租约恢复、错误密钥与密文篡改；
- 常规后端：`npm run test:backend`，server 588/588，Agent 边界 17/17；
- 聚焦配置/契约/迁移测试：63/63；
- TypeScript、`npm run db:pg:schema:check`、生产 `vinext build`：通过；
- `0036` SQL SHA-256：`257938ddcf11fae0e8de2f33462bb6ed1b1da8b7618b284120188c993f68bfd3`；
- `0036` snapshot SHA-256：`d0a9b97d064b5c3ad956e0b50c70c800748e0dcdf2c99f6ec7d45953bcf537ca`；
- migration release SHA-256：`0ca60c503e997865c8138209aaf3d7c15cd1448aa6a7153f1763c4dccb6d4673`。

两次成功的完整真实 PostgreSQL 演练均删除了隔离容器和内存数据。一次失败的旧封存工具演练被人工中止，其残留隔离容器随后按精确名称删除。

以上证据证明本地代码和 PostgreSQL 事务边界，不证明学校已收到申请、真实 gateway 已部署、阿里云权限已验收或产品整体达到生产发布标准。

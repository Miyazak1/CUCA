# CUAC 本地上线准备交接 — 2026-09-22

状态：**仓库内发布准备完成；下一阶段需要真实香港云资源、域名、邮件和受保护凭据。本文不是生产批准。**

## 已完成并由自动门禁覆盖

- 发布范围固定为 `school-handoff-v1`。公开能力清单、健康信息、全站共享运行时和每个延后 API 使用同一服务端范围；缺失或未知的生产范围直接失败。
- Agent、真实付款、学生文件、材料选择/预览/授权/快照/正式提交，以及对应的运营审核接口均在服务端不可用。学校基本信息交接保持可用。
- 生产构建使用显式静态资源白名单；旧 Demo 页面、`localStorage` 原型脚本、Agent Demo 数据和历史设计文档不进入 `dist`/应用镜像。
- 应用运行时统一注入严格 CSP、HSTS、禁止嵌入、`nosniff`、跨窗口隔离和最小浏览器权限；正式 HTML 无内联脚本/样式。
- Linux 应用镜像固定基础镜像摘要、非 root、支持只读根文件系统。只打包当前范围需要的 Auth 邮件、通知、数据权利提醒和保留任务。
- 香港 Compose 模板只监听回环地址，容器丢弃全部 Linux capabilities，启用 `no-new-privileges`、只读文件系统、受限 tmpfs 和受保护证据只读挂载。
- PostgreSQL 迁移发布包只包含锁定的 `pg`/`drizzle-orm` 运行闭包；构建不访问网络或用户 npm 缓存，重复构建一致，启动前验证全部文件哈希并拒绝额外/篡改文件。
- `npm run build`、`npm run lint`、80/80 活跃前端合同和完整 `npm run test:backend` 链在本地通过。新增硬化测试已纳入 `test:release-gate`。
- `npm run container:rehearse` 已用实际 Linux/amd64 镜像和一次性 PostgreSQL 通过迁移、非 root/只读运行、健康与发布范围、安全响应头以及优雅停机验证；临时容器和网络均已清理。

## 真实环境到位后必须执行

1. 在受控 CI 从干净提交构建并扫描镜像，生成 SBOM/签名，记录 Git SHA、镜像摘要和迁移清单摘要。
2. 建立香港 staging：私网 RDS、`verify-full` CA、独立应用/迁移账号、KMS/Secret Manager、镜像仓库和最小权限部署身份。
3. 配置 `cuca.com`、DNS、TLS、WAF/共享 Auth 与搜索限流、健康摘流、访问日志和告警；验证边缘保留或强化应用安全头。
4. 开通并验证 `privacy@cuca.com`、`support@cuca.com`、发信子域/地址、Direct Mail 区域与最小权限凭据；使用真实验收邮箱完成验证、重置、监护人同意、学校邀请、通知、退信和重放测试。
5. 迁移 staging，验证 schema parity/幂等重放；完成备份恢复、RPO/RTO、密钥轮换、任务恢复、三角色端到端、浏览器/移动端/无障碍、负载与回滚演练。
6. 为固定 staging 控制生成互不复用的脱敏证据摘要，完成 `infra:production-check`、`infra:staging-evidence-check` 和 `infra:release-gate`，再进行人工生产批准。

## 需要项目负责人提供或开通

- 香港云账号/项目、VPC、ECS/容器运行环境、RDS、KMS/Secret Manager、镜像仓库及管理员权限边界。
- `cuca.com` 域名和 DNS/TLS 控制；生产与 staging 主机名。
- Direct Mail 账号、发送域/地址、区域选择、退信/投诉处理人和至少两个真实验收邮箱。
- WAF/CDN/日志/指标/告警产品选择及通知接收人。
- 首批学校及联系人、基本信息接收字段和正式合作/隐私安排。
- 受保护渠道中的所有密码、密钥、CA 和资源标识；不得通过 Git 或聊天发送。

详细字段见 [香港外部信息清单](HONG_KONG_DATA_FLOW_MISSING_INPUTS.md)，部署命令与拓扑见 [`deploy/hong-kong/README.md`](../../deploy/hong-kong/README.md)。

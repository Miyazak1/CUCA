# CUAC 官方目录采集规程

状态：官方来源采集 MVP。采集结果只作为待审核证据，不自动发布、不写持久数据库。

## 数据边界

- 只请求 `catalog-sources/official-sources.json` 中人工登记的精确 HTTPS URL。
- 每个来源必须声明允许的精确官方 hostname；跨域重定向会失败关闭。
- 不递归发现链接，不登录，不提交表单，不绕过验证码、访问控制或限流。
- 不采集录取名单、学生信息、联系方式明细或其他个人数据页面。
- CSCA.app 等第三方聚合站仅能人工用于发现线索，不能进入自动采集注册表。
- HTML、PDF、XLS、XLSX 的单文件上限为 15 MiB。

## 运行

先离线检查来源配置：

```powershell
npm run catalog:official:validate
```

采集全部已登记来源：

```powershell
npm run catalog:official:collect
```

只采集一个来源，或与上次 manifest 对比：

```powershell
node scripts/catalog-official-collect.ts --source=zhejiang-university-undergraduate-2026
node scripts/catalog-official-collect.ts --baseline=work/catalog-official/<previous-run>/manifest.json
```

输出写入已被 Git 忽略的 `work/catalog-official/<timestamp>/`：

- `raw/`：不可覆盖的原始响应快照，文件名包含 SHA-256；
- `manifest.json`：最终 URL、采集时间、响应类型、大小、ETag、Last-Modified 和 SHA-256；
- `diff.json`：存在 baseline 时记录新增、删除、内容变化和未变化来源。

## 审核与转化

采集成功只证明“已保存该时间点的官方页面”，不证明内容适合发布。编辑人员必须：

1. 检查页面年份、适用学生类型和招生轮次；
2. 排除新闻、公示名单和已经过期的规则；
3. 将每个目标字段映射到具体来源页面或附件位置；
4. 对费用、截止日期、CSCA、语言要求和奖学金进行二次复核；
5. 生成目录 v2 包并完成已有迁移校验及一次性数据库演练；
6. 在独立审批后才能进入 staging 或持久数据库。

来源页面结构变化、内容类型异常、跨域跳转或摘要变化都应进入人工复核，不能由采集器猜测修复。

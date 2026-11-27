# 学校校徽补齐与官方来源核验 — 2026-11-21

本轮只处理当前本地公开目录中的 100 所学校校徽及其展示；未推送、未部署、未执行线上迁移。沿用 [前轮校徽管理验收](SCHOOL_LOGO_MANAGEMENT_2026-11-20.md)，本文件为其素材覆盖与展示回归更新。

## 统计口径

| 类别 | 数量/结果 |
| --- | --- |
| 公开学校记录 | 100 所 |
| 原有校徽 | 12 张，全部逐项对照官方标识并替换为官方来源版本 |
| 新增学校校徽 | 88 所 |
| 当前覆盖 | 100/100，无缺失 |
| 官方来源 | 100/100，有明确 HTTPS 图片 URL、原始摘要、获取时间及视觉核验记录 |
| 相关自动化 | 84 项通过；另外详情/资源版本 8 项通过，合计 92 项，0 失败（不计入问题数） |
| 额外迁移检查 | 快照/历史 6 项、迁移打包 3 项，在隔离放宽时限的复核中全部通过；与 92 项分列，重跑不重复计数 |
| HTTP 图片验收 | 100 个 200 + 摘要匹配；100 个条件请求 304 |
| 浏览器场景 | 三类列表 + 三类详情 × 六语 × 桌面/手机 = 72 组，通过 |
| 完整学校列表 | 桌面 13 页，共 100 所、100 张，逐页加载通过；手机末页 4 张通过 |
| 追加问题 | 1 项：详情页旧占位蓝底和内边距导致校徽缩小，已修复 |

## 验收清单及对应证据

| 编号 | 验收项 | 对应测试/检查 | 结果 |
| --- | --- | --- | --- |
| LG-10 | 补齐其余学校，不错配母校/医学部/学院标识 | 100 张候选/最终联系表实看；school-logo-official-assets.test.mjs；逐校来源表 | 88 所新增，100/100 覆盖。排除了事业单位、IPv6、装饰图和国际学院专属徽标 |
| LG-11 | 原有 12 张官方来源核验 | 下方 12 张对照表；原文件、0081 迁移和版本历史保留 | 12/12 替换为官方来源版本；不把维基原来源改写为官方原始文件 |
| LG-12 | 格式、摘要与图片输出 | prepareSchoolLogo 校验；100 张清单与迁移摘要测试；100 张 HTTP 字节/缓存验收 | 全部为校验后的 256×256 PNG；不公开原始 SVG、脚本或内部备注 |
| LG-13 | 导入、迁移及后台修改保护 | local-school-logo-official-acceptance.mjs；真实 PostgreSQL 回滚演练 | 新学校填充、重复执行、旧导入升级、后台上传保护、自定义备注保护、移除保护、归档跳过共 7 场景通过；合成数据全回滚 |
| LG-14 | 详情页真实校徽完整展示（本轮新增问题） | public/catalog-detail.css；三类详情在 6 语/2 宽度下的浏览器记录 | 移除有校徽时的占位蓝底/内边距；桌面校徽 88px、375px 手机 64px；保留无图片/加载失败时原占位逻辑 |
| LG-15 | 三类列表、关联详情及全部现有语言 | logo-ui-results.json：6 页面 × en/vi/th/id/ms/ar × 1280/375px | 72/72，通过。图片正常解码、无横向溢出、footer 16 链接；阿拉伯语 RTL 正常 |
| LG-16 | 分页、延迟加载、手机实看 | logo-school-pages.json、logo-scroll-checks.json、三类手机卡片截图、阿语 footer 截图 | 桌面 13 页 100 校不重复且校徽正常；手机末页、三类卡片 46px 校徽及 footer 实看通过。未把视口外尚未触发的懒加载当成失败 |
| LG-17 | 缓存更新与原功能保护 | 详情页契约/资源版本 8 项；TypeScript、定向 ESLint、公共资源版本检查 | 均通过。仅修复详情校徽容器；本轮未改导航、footer、首页、国际化正文或招生状态逻辑 |

上述是素材/功能验收项，**不增加原始反馈表的问题总数，也不把 100 张图片、200 次 HTTP 请求或 72 组浏览器场景混算成 bug 数**。历史清单中的线上 301、真机 iPhone Safari 约定不变。375px 是浏览器响应式检查，不冒称真机 Safari 测试。

## 获取与处理规则

来源按项目 cuac-official-catalog 规范明确登记，取自学校官方站点，保留原始快照 SHA-256、请求结果、时间和裁切记录；无递归抓取。图库里每张候选和每张最终图都做了视觉检查，不能仅因文件名有 logo 就接受。

组合式页眉只截取完整学校标志，不重画、不换成其他学校的徽标。白色图案保持原色并置于深绿底，防止在浅底中消失；官方原图自身已有底色时保留。统一 PNG 画布为 256×256 不代表原图是高清：部分学校官网仅提供小尺寸页眉资源，详情放大后仍可能较软；保留真实来源及原始像素记录，不通过生成图片伪造细节。

中国美术学院站点证书链无法被当前 Node 证书库验证，采用 Windows Schannel 的 curl 并保持完整 TLS 校验；通过同一采集器适配器保留 HTTPS/明确域名/跳转/大小限制，未关闭证书校验。贵州医科大学根路径曾返回异常 HTTP 响应头，改用其明确的学校标识页取得原图。部分猜测路径的 404/410、412 和不合格候选保留在任务证据，不标记为核验成功。

可机读清单：[学校校徽](../../seeds/school-logos.official-20261121.json)、[来源注册](../../catalog-sources/school-logo-sources.20261121.json)、[逐校核验](../../catalog-sources/school-logo-review.20261121.json)。官方原始快照仅在任务证据目录，不把整站 HTML 放入仓库。

## 数据与后续发布衔接

新增 0082_school_logo_official_assets.sql；不改已应用的 0080/0081。100 张素材随迁移携带，避免将来只更新前端却没有校徽数据。迁移锁定学校行、追加版本，只填无历史记录或升级完全匹配的初始维基导入；后台上传、自定义来源备注、移除记录均保留，不覆盖。

本地已应用到 83 个迁移。北京大学 v4 是上一轮后台演练的恢复记录，自动迁移按规则保护；本轮根据明确授权与旧摘要/来源/版本校验，单独追加官方版本 v5，v1–v4 保留。其余原有 11 所升级为官方版本，新 88 所为首版。默认本地导入清单改为 100 校官方清单；只读重复预览显示 100 项均保持既有版本。

未来新增学校仍通过学校数据包的 logo 字段导入，未提供素材时显示占位，不从相似校名猜测图片。所有公开关联列表/详情从学校 ID 读取统一图片。

## 原有 12 张对照

| 学校 | 原始素材来源（保留） | 本轮官方来源 | 结果 |
| --- | --- | --- | --- |
| 清华大学 | [原始来源](https://commons.wikimedia.org/wiki/File:Tsinghua_University_Logo.svg) | [官方核验/替换来源](https://vi.tsinghua.edu.cn/__local/8/1C/21/2F02A66E31BF084FE340463BB47_B9A95F73_185BC.jpg) | 已替换为官方素材，旧记录保留 |
| 北京大学 | [原始来源](https://commons.wikimedia.org/wiki/File:Peking_University_seal.svg) | [官方核验/替换来源](https://www.pku.edu.cn/pku_logo_red.png) | 已替换为官方素材，旧记录保留 |
| 上海交通大学 | [原始来源](https://en.wikipedia.org/wiki/File:Sjtu-logo-standard-red.png) | [官方核验/替换来源](https://global.sjtu.edu.cn/en/assets/images/logo_white_130.png) | 已替换为官方素材，旧记录保留 |
| 浙江大学 | [原始来源](https://en.wikipedia.org/wiki/File:Zhejiang_University_Logo.svg) | [官方核验/替换来源](https://www.zju.edu.cn/_upload/article/images/c3/98/1fb1d281492eb477a098ef7a2901/6d8d432f-56ac-47eb-b22d-a23b103aed01.png) | 已替换为官方素材，旧记录保留 |
| 复旦大学 | [原始来源](https://commons.wikimedia.org/wiki/File:Fudan_University_Logo.svg) | [官方核验/替换来源](https://www.fudan.edu.cn/_upload/site/00/02/2/logo.png) | 已替换为官方素材，旧记录保留 |
| 南京大学 | [原始来源](https://en.wikipedia.org/wiki/File:Nanjing_University_Logo.svg) | [官方核验/替换来源](https://www.nju.edu.cn/images/footer_logo.svg) | 已替换为官方素材，旧记录保留 |
| 武汉大学 | [原始来源](https://en.wikipedia.org/wiki/File:Wuhan_University_Logo.png) | [官方核验/替换来源](https://www.whu.edu.cn/new2024/js/logo.png) | 已替换为官方素材，旧记录保留 |
| 中山大学 | [原始来源](https://en.wikipedia.org/wiki/File:Sun_Yat-sen_University_Logo.png) | [官方核验/替换来源](https://www.sysu.edu.cn/images/logo1.png) | 已替换为官方素材，旧记录保留 |
| 四川大学 | [原始来源](https://en.wikipedia.org/wiki/File:Sichuan_University_logo_%28seal%29.svg) | [官方核验/替换来源](https://www.scu.edu.cn/images/logo.png) | 已替换为官方素材，旧记录保留 |
| 厦门大学 | [原始来源](https://commons.wikimedia.org/wiki/File:Xiamen_University_logo.svg) | [官方核验/替换来源](https://www.xmu.edu.cn/images/logo2.png) | 已替换为官方素材，旧记录保留 |
| 北京邮电大学 | [原始来源](https://en.wikipedia.org/wiki/File:BUPT_LOGO.png) | [官方核验/替换来源](https://vi.bupt.edu.cn/images/logo1.png) | 已替换为官方素材，旧记录保留 |
| 西湖大学 | [原始来源](https://en.wikipedia.org/wiki/File:Westlake_University.png) | [官方核验/替换来源](https://en.westlake.edu.cn/images/header_icon_color.png) | 已替换为官方素材，旧记录保留 |

## 100 校来源及结果

裁切尺寸为官方原图坐标中的选取范围，具体位置及原图完整尺寸见逐校核验 JSON。学校展示尺寸由页面 CSS 控制，不使用这里的 256px 画布直接撑大卡片。

| 学校 | 本轮处理 | 官方原图 | 原始 SHA-256 前缀 | 处理 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 安徽农业大学 | 新增 | [官方图片](https://www.ahau.edu.cn/static/img/logo123.png) | 6ac7e78ba2a3… | 75×75 → 256×256 | 通过 |
| 安徽大学 | 新增 | [官方图片](https://www.ahu.edu.cn/_upload/tpl/07/cc/1996/template1996/images/logonew.png) | 0ffd7804daf2… | 80×80 → 256×256 | 通过 |
| 北京航空航天大学 | 新增 | [官方图片](https://www.buaa.edu.cn/images/logo.png) | f25d77b0c25b… | 68×68 → 256×256 | 通过 |
| 北京外国语大学 | 新增 | [官方图片](https://www.bfsu.edu.cn/images/logo.png) | 05046021a260… | 79×79 → 256×256 | 通过 |
| 北京林业大学 | 新增 | [官方图片](https://www.bjfu.edu.cn/images/logo.svg) | dc1cdb829a1c… | 120×120 → 256×256 | 通过 |
| 北京理工大学 | 新增 | [官方图片](https://www.bit.edu.cn/images/gb20190805/logo_01.svg) | 6039e5ee856b… | 完整原图 → 256×256 | 通过 |
| 北京语言大学 | 新增 | [官方图片](https://www.blcu.edu.cn/images/logoft.png) | 1ee078445eac… | 101×101 → 256×256 | 通过 |
| 北京师范大学 | 新增 | [官方图片](https://english.bnu.edu.cn/images/logo_01.png) | a04bf05abaa7… | 88×87 → 256×256 | 通过 |
| 北京科技职业大学 | 新增 | [官方图片](https://www.bpu.edu.cn/wwwz/images/logo.png) | 253c9fb2e0c7… | 90×90 → 256×256 | 通过 |
| 北京体育大学 | 新增 | [官方图片](https://www.bsu.edu.cn/images/logo.png) | 8c6e26338cd8… | 52×52 → 256×256 | 通过 |
| 北京工商大学 | 新增 | [官方图片](https://www.btbu.edu.cn/images2024/logo.png) | 950c4dfbcc5c… | 60×60 → 256×256 | 通过 |
| 北京化工大学 | 新增 | [官方图片](https://www.buct.edu.cn/_upload/tpl/01/f4/500/template500/images/logo1.svg) | ed93ffff8df0… | 完整原图 → 256×256 | 通过 |
| 北京邮电大学 | 原有 12 张：官方版本替换 | [官方图片](https://vi.bupt.edu.cn/images/logo1.png) | 7469ce8ffc62… | 91×91 → 256×256 | 通过 |
| 华中师范大学 | 新增 | [官方图片](https://dge.ccnu.edu.cn/dfiles/27359/ccnu_gnhzb/images/logo2.png) | 231e769a5800… | 80×80 → 256×256 | 通过 |
| 中南大学 | 新增 | [官方图片](https://www.csu.edu.cn/images/logo2.png) | 023d2de57f58… | 85×85 → 256×256 | 通过 |
| 中央财经大学 | 新增 | [官方图片](https://www.cufe.edu.cn/images/ksdhlogo.png) | 2efe443bbc89… | 94×97 → 256×256 | 通过 |
| 长安大学 | 新增 | [官方图片](https://www.chd.edu.cn/images/logo.png) | 8c2ce0dfab72… | 85×85 → 256×256 | 通过 |
| 长春理工大学 | 新增 | [官方图片](https://www.cust.edu.cn/static2026/images/logo.png) | 39f9ef10042a… | 67×67 → 256×256 | 通过 |
| 中国美术学院 | 新增 | [官方图片](https://admission.caa.edu.cn/dfiles/6837/site/templates/maincn/images/logo1.png) | 8a0ca37b4a63… | 52×85 → 256×256 | 通过 |
| 中国农业大学 | 新增 | [官方图片](https://www.cau.edu.cn/static2022/images/logo2.png) | 1ce2ae18da74… | 53×64 → 256×256 | 通过 |
| 重庆师范大学 | 新增 | [官方图片](https://www.cqnu.edu.cn/2023xsy8/images/logo2.png) | bfcdc59a346a… | 58×58 → 256×256 | 通过 |
| 大连理工大学 | 新增 | [官方图片](https://sie.dlut.edu.cn/English/images/logo.png) | 8d86b1d8e54c… | 68×150 → 256×256 | 通过 |
| 东华大学 | 新增 | [官方图片](https://www.dhu.edu.cn/_upload/tpl/0b/3f/2879/template2879/image/logo.png) | 4b69ea12c94b… | 127×127 → 256×256 | 通过 |
| 华东交通大学 | 新增 | [官方图片](https://www.ecjtu.edu.cn/images/logo20210811.png) | ce2f9ce5001f… | 62×62 → 256×256 | 通过 |
| 华东师范大学 | 新增 | [官方图片](https://www.ecnu.edu.cn/images/21/03/19/1r916g9urn/logo-bottom.svg) | 634deddfc31a… | 62×62 → 256×256 | 通过 |
| 华东政法大学 | 新增 | [官方图片](https://www.ecupl.edu.cn/_upload/tpl/02/16/534/template534/images/logo.svg) | b5d9154425e7… | 91×91 → 256×256 | 通过 |
| 华东理工大学 | 新增 | [官方图片](https://www.ecust.edu.cn/_upload/tpl/00/2c/44/template44/images/logo.png) | 12c104ce3be2… | 500×500 → 256×256 | 通过 |
| 复旦大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.fudan.edu.cn/_upload/site/00/02/2/logo.png) | 6902c4ad7e17… | 72×72 → 256×256 | 通过 |
| 福州大学 | 新增 | [官方图片](https://www.fzu.edu.cn/images/footer_logo.png) | f0216e00724b… | 60×60 → 256×256 | 通过 |
| 广东外语外贸大学 | 新增 | [官方图片](https://www.gdufs.edu.cn/images/logo.png) | a391614a0dc2… | 73×73 → 256×256 | 通过 |
| 广西医科大学 | 新增 | [官方图片](https://www.gxmu.edu.cn/images/gxmu_logo.png) | e5e3366c387b… | 63×63 → 256×256 | 通过 |
| 贵州医科大学 | 新增 | [官方图片](https://www.gmc.edu.cn/__local/0/0D/6C/A7FB45BE37E59583D365353A007_044A37B8_B197.png) | 4ff3a8ef0f04… | 240×240 → 256×256 | 通过 |
| 杭州电子科技大学 | 新增 | [官方图片](https://www.hdu.edu.cn/_upload/tpl/02/12/530/template530/images/logo_main.svg) | 023b2536ce71… | 70×70 → 256×256 | 通过 |
| 哈尔滨工程大学 | 新增 | [官方图片](https://www.hrbeu.edu.cn/images/logo.png) | 820e87fcb001… | 67×67 → 256×256 | 通过 |
| 哈尔滨工业大学 | 新增 | [官方图片](https://www.hit.edu.cn/_upload/site/00/ee/238/logo.png) | 4c770a1cde5e… | 678×678 → 256×256 | 通过 |
| 哈尔滨工业大学（深圳） | 新增 | [官方图片](https://www.hitsz.edu.cn/_upload/tpl/00/0d/13/template13/images/logo.png) | 0e50d9b63880… | 67×67 → 256×256 | 通过 |
| 哈尔滨理工大学 | 新增 | [官方图片](https://www.hrbust.edu.cn/images/logo-top.png) | afc81db4366d… | 64×64 → 256×256 | 通过 |
| 合肥师范学院 | 新增 | [官方图片](https://www.hfnu.edu.cn/images/logo.png) | c6eac722db5c… | 80×80 → 256×256 | 通过 |
| 华中科技大学 | 新增 | [官方图片](https://www.hust.edu.cn/images/logo20240628.png) | b818d74ac39e… | 126×94 → 256×256 | 通过 |
| 湖南工商大学 | 新增 | [官方图片](https://ev.hutb.edu.cn/upload/ywz/site/logo/image/3348a6a94dbc4f71ab4bfdf1414b9710.png) | 4545fb269ad9… | 95×95 → 256×256 | 通过 |
| 江苏科技大学 | 新增 | [官方图片](https://www.just.edu.cn/_upload/tpl/03/4d/845/template845/images/logo.png) | 85210c259e70… | 66×66 → 256×256 | 通过 |
| 吉林大学 | 新增 | [官方图片](https://www.jlu.edu.cn/images/logo.jpg) | 6c239873e119… | 75×90 → 256×256 | 通过 |
| 暨南大学 | 新增 | [官方图片](https://www.jnu.edu.cn/_upload/tpl/00/f5/245/template245/images/home/logo.png) | c427ed296b18… | 306×306 → 256×256 | 通过 |
| 昆明医科大学 | 新增 | [官方图片](https://www.kmmu.edu.cn/temple/image/logo_copy.png) | 6cd620793873… | 136×136 → 256×256 | 通过 |
| 昆明学院 | 新增 | [官方图片](https://www.kmu.edu.cn/images/logo.png) | 4c84d77a668f… | 57×57 → 256×256 | 通过 |
| 辽宁中医药大学 | 新增 | [官方图片](https://www.lnutcm.edu.cn/images/logo.png) | 868214c71334… | 84×84 → 256×256 | 通过 |
| 泸州职业技术学院 | 新增 | [官方图片](https://www.lzy.edu.cn/images/logo.png) | 22eddeb98c13… | 99×99 → 256×256 | 通过 |
| 南京大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.nju.edu.cn/images/footer_logo.svg) | 9ab63be7c3bf… | 811×720 → 256×256 | 通过 |
| 南京航空航天大学 | 新增 | [官方图片](https://www.nuaa.edu.cn/_upload/tpl/05/f7/1527/template1527/images/logo_b.png) | 24cabc3b7cc9… | 92×92 → 256×256 | 通过 |
| 南开大学 | 新增 | [官方图片](https://www.nankai.edu.cn/_upload/tpl/02/58/600/template600/images/logo.png) | e1219a954b23… | 75×75 → 256×256 | 通过 |
| 西北工业大学 | 新增 | [官方图片](https://www.nwpu.edu.cn/images/logo2.png) | b8a1c9f0c926… | 63×63 → 256×256 | 通过 |
| 中国海洋大学 | 新增 | [官方图片](https://www.ouc.edu.cn/_upload/tpl/0c/00/3072/template3072/images/logo.svg) | 0a408bc4af40… | 88×88 → 256×256 | 通过 |
| 北京大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.pku.edu.cn/pku_logo_red.png) | b328ed3c9e57… | 360×360 → 256×256 | 通过 |
| 北京大学医学部 | 新增 | [官方图片](https://www.bjmu.edu.cn/images/logo.svg) | dde59dc1d621… | 44×44 → 256×256 | 通过 |
| 青岛大学 | 新增 | [官方图片](https://www.qdu.edu.cn/images/logo3.png) | 6c7cd13dd9d8… | 59×59 → 256×256 | 通过 |
| 山东师范大学 | 新增 | [官方图片](https://www.sdnu.edu.cn/images/logosmall2.png) | 5e065397dda9… | 224×225 → 256×256 | 通过 |
| 山东大学 | 新增 | [官方图片](https://www.sdu.edu.cn/images/logo.svg) | a35165d4b64e… | 163×163 → 256×256 | 通过 |
| 山东财经大学 | 新增 | [官方图片](https://www.sdufe.edu.cn/dfiles/12798/images/main_03-8.png) | bfb72b1a0a9d… | 80×80 → 256×256 | 通过 |
| 上海外国语大学 | 新增 | [官方图片](https://www.shisu.edu.cn/assets/images/logo.png) | 60aa8cc927d1… | 76×76 → 256×256 | 通过 |
| 上海交通大学 | 原有 12 张：官方版本替换 | [官方图片](https://global.sjtu.edu.cn/en/assets/images/logo_white_130.png) | b9af15404e3f… | 166×166 → 256×256 | 通过 |
| 上海交通大学医学院 | 新增 | [官方图片](https://www.shsmu.edu.cn/dfiles/logohs.png) | 55d545c5f8cf… | 619×619 → 256×256 | 通过 |
| 上海大学 | 新增 | [官方图片](https://www.shu.edu.cn/images/logoft.svg) | 5ac50dff6c0c… | 136×168 → 256×256 | 通过 |
| 上海电力大学 | 新增 | [官方图片](https://www.shiep.edu.cn/_upload/tpl/00/e0/224/template224/images/logo.png) | 97d7a4dececc… | 160×160 → 256×256 | 通过 |
| 上海政法学院 | 新增 | [官方图片](https://www.shupl.edu.cn/_upload/tpl/01/03/259/template259/images/logo2.png) | 82aabe569fd8… | 57×57 → 256×256 | 通过 |
| 深圳大学 | 新增 | [官方图片](https://en.szu.edu.cn/images/blacklogo.png) | 6e82f48f6296… | 80×80 → 256×256 | 通过 |
| 四川外国语大学 | 新增 | [官方图片](https://www.sisu.edu.cn/images/logo.png) | a765f8c710ee… | 80×80 → 256×256 | 通过 |
| 四川大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.scu.edu.cn/images/logo.png) | 76b6a006cfad… | 68×68 → 256×256 | 通过 |
| 华南师范大学 | 新增 | [官方图片](https://statics.scnu.edu.cn/statics/css/scnuportal/contentlogo.png) | 288870c8c7e9… | 82×90 → 256×256 | 通过 |
| 华南理工大学 | 新增 | [官方图片](https://www.scut.edu.cn/_upload/site/01/3b/315/logo.png) | ebbcd850c82b… | 180×300 → 256×256 | 通过 |
| 东南大学 | 新增 | [官方图片](https://www.seu.edu.cn/_upload/tpl/0c/ea/3306/template3306/images/logo.svg) | 0b4c443d2ef8… | 73×73 → 256×256 | 通过 |
| 南方科技大学 | 新增 | [官方图片](https://www.sustech.edu.cn/static/images/sustech-logo-en.png) | 518adeb797cd… | 60×86 → 256×256 | 通过 |
| 西南财经大学天府学院 | 新增 | [官方图片](https://www.tfswufe.edu.cn/images/logo-white.png) | b32289949914… | 145×170 → 256×256 | 通过 |
| 中山大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.sysu.edu.cn/images/logo1.png) | 6725f365b51e… | 69×69 → 256×256 | 通过 |
| 天津外国语大学 | 新增 | [官方图片](https://www.tjfsu.edu.cn/_upload/tpl/00/07/7/template7/images/logo.svg) | 417eb962c613… | 57×78 → 256×256 | 通过 |
| 天津师范大学 | 新增 | [官方图片](https://gjjl.tjnu.edu.cn/images/logo.png) | 68021876ee60… | 64×64 → 256×256 | 通过 |
| 天津大学 | 新增 | [官方图片](https://www.tju.edu.cn/images/tjulogo.png) | 66d6b280b679… | 230×288 → 256×256 | 通过 |
| 天津财经大学 | 新增 | [官方图片](https://www.tjufe.edu.cn/template_files/1/images/logo.png) | a14dcf1da4af… | 284×284 → 256×256 | 通过 |
| 天津理工大学 | 新增 | [官方图片](https://www.tjut.edu.cn/images/plogo.png) | c6e4daf3a624… | 68×68 → 256×256 | 通过 |
| 同济大学 | 新增 | [官方图片](https://www.tongji.edu.cn/images/18/05/03/1d0wfqyjja/footlogo.png) | a3450052a8f9… | 68×68 → 256×256 | 通过 |
| 清华大学 | 原有 12 张：官方版本替换 | [官方图片](https://vi.tsinghua.edu.cn/__local/8/1C/21/2F02A66E31BF084FE340463BB47_B9A95F73_185BC.jpg) | 90132d030d8a… | 完整原图 → 256×256 | 通过 |
| 中国科学院大学 | 新增 | [官方图片](https://www.ucas.ac.cn/images/logo.png) | fa63aa5c3bee… | 120×120 → 256×256 | 通过 |
| 电子科技大学 | 新增 | [官方图片](https://en.uestc.edu.cn/images/logo.png) | d8fe5cde0f42… | 77×77 → 256×256 | 通过 |
| 对外经济贸易大学 | 新增 | [官方图片](https://www.uibe.edu.cn/2025/images/logo.png) | 2c30c6aff5e1… | 150×150 → 256×256 | 通过 |
| 三亚学院 | 新增 | [官方图片](https://www.sanyau.edu.cn/_upload/tpl/00/18/24/template24/images/tago.svg) | 95a9902d16bd… | 完整原图 → 256×256 | 通过 |
| 北京科技大学 | 新增 | [官方图片](https://www.ustb.edu.cn/images/u_logo2.png?240103) | 24d5c1bf8d8f… | 47×47 → 256×256 | 通过 |
| 中国科学技术大学 | 新增 | [官方图片](https://www.ustc.edu.cn/news/images/logo.svg) | 39d2d180e96f… | 90×90 → 256×256 | 通过 |
| 温州大学 | 新增 | [官方图片](https://www.wzu.edu.cn/dfiles/9987/template/default/newzhuzhan/wenda/images/logo.png) | f4842fbf8b06… | 63×63 → 256×256 | 通过 |
| 西湖大学 | 原有 12 张：官方版本替换 | [官方图片](https://en.westlake.edu.cn/images/header_icon_color.png) | b1f0794bc3b4… | 162×162 → 256×256 | 通过 |
| 武昌理工学院 | 新增 | [官方图片](https://www.wut.edu.cn/img/logo.png) | 8b6ebf92097b… | 158×158 → 256×256 | 通过 |
| 武汉大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.whu.edu.cn/new2024/js/logo.png) | 32fc6fa119b6… | 734×734 → 256×256 | 通过 |
| 西安交通大学 | 新增 | [官方图片](https://www.xjtu.edu.cn/img/logo_pic99.png) | a6cfe2c43bf1… | 84×84 → 256×256 | 通过 |
| 厦门大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.xmu.edu.cn/images/logo2.png) | 42d4e2ef80c3… | 83×83 → 256×256 | 通过 |
| 湘潭大学 | 新增 | [官方图片](https://www.xtu.edu.cn/images/logo.png) | d6af3be4bff4… | 80×80 → 256×256 | 通过 |
| 新疆农业大学 | 新增 | [官方图片](https://cie.xjau.edu.cn/_upload/tpl/02/80/640/template640/logoT.png) | 5f40839609b3… | 80×80 → 256×256 | 通过 |
| 徐州医科大学 | 新增 | [官方图片](https://gjjyen.xzhmu.edu.cn/img/h-logo.png) | 30d6146749a5… | 82×82 → 256×256 | 通过 |
| 燕山大学 | 新增 | [官方图片](https://ies.ysu.edu.cn/images/logo-ies2024.png) | ec371f31cb41… | 287×287 → 256×256 | 通过 |
| 云南财经大学 | 新增 | [官方图片](https://www.ynufe.edu.cn/images/logo.png) | e07c017b1333… | 70×70 → 256×256 | 通过 |
| 浙江工商大学 | 新增 | [官方图片](https://sie.zjgsu.edu.cn/_upload/tpl/00/85/133/template133/img/LOGO.png) | 5d7566feef7d… | 74×72 → 256×256 | 通过 |
| 浙江大学 | 原有 12 张：官方版本替换 | [官方图片](https://www.zju.edu.cn/_upload/article/images/c3/98/1fb1d281492eb477a098ef7a2901/6d8d432f-56ac-47eb-b22d-a23b103aed01.png) | dc914cc634bd… | 完整原图 → 256×256 | 通过 |
| 浙江工业大学 | 新增 | [官方图片](https://www.zjut.edu.cn/_upload/site/00/04/4/logo.png) | 6bc97d56327d… | 53×53 → 256×256 | 通过 |

## 重复验收

~~~powershell
node --test tests/server/catalog/school-logo.test.mjs tests/server/catalog/school-logo-import.test.mjs tests/server/catalog/school-logo-official-assets.test.mjs tests/server/catalog/official-source.test.mjs tests/server/catalog/catalog-mappers.test.mjs tests/server/catalog/catalog-seed-contract.test.mjs tests/server/catalog/catalog-seed-writer.test.mjs tests/server/catalog/postgres-repository.test.mjs tests/catalog-design.test.mjs tests/catalog-list-public-contract.test.mjs tests/school-logo-editor.test.mjs tests/server/infra/public-release-assets.test.mjs
node --test tests/catalog-detail-public-contract.test.mjs tests/public-asset-versions.test.mjs
node scripts/local-school-logo-official-acceptance.mjs
node scripts/school-logo-import-local.ts
node scripts/public-asset-versions.mjs
~~~

本地回归证据：E:\CodexData\build\CUCA\school-logos-20261121。包含官网原始快照、候选/最终联系表、逐校选择及摘要、72 组浏览器记录、分页结果、桌面/手机截图、自动化/类型/lint/HTTP/数据库演练结果。未执行全站生产构建或线上部署。

## 额外迁移检查的耗时记录

为复核新增数据迁移，另外运行了快照及迁移打包测试，不能将首次运行全部写成通过：原套组 17 项中 16 项通过、1 项因 180 秒限制取消。打包测试的相同断言在临时副本中仅将本次上限放宽到 600 秒后，3/3 通过，打包完整性/防篡改场景实际耗时约 267 秒。仓库原测试文件和阈值均未修改，默认 180 秒在本机仍不足。

快照检查原套组 6 项通过；单独重复时有一次迁移预检子进程超过原 10 秒上限，导致外层断言失败。临时副本将子进程上限放宽到 60 秒、整体上限放宽到 180 秒后，6/6 通过，保留生成器无变更、单表变更、历史保护以及连接前拒绝等原断言。完整运行约 69 秒。当前 83 个迁移的直接快照校验也通过。

这些记录与 92 项校徽/目录/资源测试分开。原超时和失败日志、隔离重跑日志均归档；没有删除失败记录，也未更改线上配置来规避检查。

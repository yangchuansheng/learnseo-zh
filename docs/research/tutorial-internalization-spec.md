# First-party Tutorial Internalization Specification

## Decision

LearningSEO 将已收录的公开单页 HTML 教程按需导入为双语站内教程。每个来源 URL 对应一个稳定 slug、一个受控快照和两份本地 HTML：英文页保留来源文字，简体中文页提供忠实翻译。页面与数据始终保留来源标题、发布者、作者（可为空）、canonical URL、来源路线、更新时间、抓取时间、内容哈希和许可/署名信息。

首个 Pilot Tutorial 是 [Google Search Central SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)。验收示例锁定 slug `google-seo-starter-guide` 与以下 URL contract，URL/SEO 子票据负责实现和测试：

- https://learningseo.io/tutorials/google-seo-starter-guide/
- https://learningseo.io/en/tutorials/google-seo-starter-guide/

实现边界保持在决策地图：本票交付规格、数据契约、验收矩阵和 Pilot 证据；页面、导入器、批量迁移和部署由下列子票据承接。

## Scope and ownership

### Eligible Source Tutorial

来源必须满足五项资格清单：公开可访问、连续正文、主题闭合、单页边界和 canonical 已核对。资源卡仍由当前 LearningSEO 子页面 manifest 作为来源证明；课程、文档中心、工具、下载、登录/付费内容、目录集合和纯视频进入人工处理队列。导入前 preflight 再次检查 HTTP 状态、最终 URL、响应类型、canonical、正文根节点和媒体来源。

页面实现复用现有 Next.js App Router、根 locale 与 `/en/...` 路由、生成 HTML 内容和本地化 manifest；教程只增加独立的内容模型、页面 renderer 与导入边界。

Issue #13 的盘点包含 914 个外部资源目标，其中 587 个是待 preflight 的 likely single-page 估计。这个数字用于迁移容量规划，单条来源只有通过五项资格清单后才进入导入队列。

### Data roots

    src/content/tutorials/
      manifest.json             # zh-CN route records
      manifest.en.json          # English route records
      content/<sha256>.html
      fixtures/semantic-fixture.html
    public/sites/learningseo-io-071dae18/tutorials/
    docs/research/tutorial-internalization-pilot.md

contentFile 只接受当前正文 SHA-256 文件名。snapshot.history 保留旧版本的哈希、版本、canonical 审计和更新时间；旧正文文件继续接受完整性校验。两份 manifest 必须按 slug、path、source canonical、status 和 snapshot version 成对存在。

## Normalized content model

每条 TutorialRecord 包含：

| 区域 | 必填字段 |
| --- | --- |
| 路由 | slug、path、title、description、provider、status |
| 来源 | source.title、source.provider、source.author（可为空；无个人作者时显示 source.provider）、source.canonicalUrl、source.sourcePath、可选 license |
| 快照 | version、capturedAt、sourceUpdatedAt、pageCanonicalUrl、canonicalMatched、sourceContentHash、contentHash、history |
| 翻译 | sourceLanguage: en、language: zh-CN、译者、译文时间、审校时间、源/译章节数 |
| 审校 | decision、审校人、时间、说明、十一项 checklist、历史 |
| 资格 | decision、审核人、时间、五项 checklist |
| 正文 | contentFile、toc、media、contentMetrics |
| SEO | seo.title、seo.description、seo.indexable |

正文块覆盖 h1–h6、段落、无序/有序列表、链接、表格、行内/块级代码、引用、图片、图注和受控 iframe。Pilot 本身覆盖标题、段落、列表、链接、四张本地图片、两张表格和行内代码；fixtures/semantic-fixture.html 补充块级代码、引用和 YouTube-nocookie embed 的模板校验。

## Lifecycle and rollback

状态流转为 draft → review → published，返工进入 draft，来源变化进入 stale。导入器创建 draft，审校命令在双语内容和资格检查完整后转为 review，发布动作由审校人确认后转为 published。已发布来源的快照或 canonical 变化会转为 stale；重新采集并补齐双语内容后可进入 review，翻译或内容返工进入 draft。只有资格清单、双语章节数、正文安全检查、媒体检查、来源署名和十一项编辑 checklist 全部通过时才进入 published。draft、review 和 stale 页面继续提供静态预览，输出 noindex,nofollow，目录只列出已发布页面。Issue #12 的状态守卫、重复来源映射、刷新审校、原子提交、失败恢复和回滚命令详见 [lifecycle decision](./tutorial-internalization-lifecycle.md)。

导入按 slug 幂等。原 canonical 对 slug 保持不变；新来源创建新 slug。来源快照或正文变化时版本递增，旧版本写入 history。rollback-tutorial.mjs --slug <slug> --version <n> 以旧正文创建新的递增候选版本，候选状态为 draft，当前 published 版本及 activeVersion 指针继续提供线上内容，候选通过重新审校后再一次性切换并将旧版本写入 history。canonical 变更通过显式 rebind 命令创建新来源记录和单向 alias，旧 slug 继续保留。

每次导入、发布和回滚都以双语 manifest、两份 locale 正文以及媒体索引作为一个原子版本单元。操作目录和 journal 记录阶段，generation marker 约束两种 locale 一致；任何校验或写入失败都会保留当前已发布版本及其媒体引用，recover 命令可完成已验证提交或恢复最近备份；新版本完整写入后再一次性切换两个 locale 的 manifest。

资源卡链接在页面渲染时按已发布来源 canonical 映射到本地双语路径。草稿和待更新来源继续显示外部 URL；同一个来源在多个资源卡出现时共用一个 slug，显式 rebind 的旧 key 在新记录发布后按 alias 映射。

## Child-ticket handoff

| 子票据 | 本规格锁定的输入 | 子票据交付 |
| --- | --- | --- |
| [#12 生命周期、链接与回滚](./tutorial-internalization-lifecycle.md) | 状态机、canonical 映射、版本历史 | 命令行为、资源卡转换、失败恢复和回滚 |
| #14 Pilot 验收 | 本文 Acceptance contract 与 Pilot 盘点 | 可执行验收清单和真实页面证据 |
| #15 URL 与 SEO | 已锁定的 slug、locale 路径、alternate、canonical、robots、sitemap 约束 | 路由实现、SEO 测试和结构化数据 |
| #16 内容模型 | TutorialRecord 字段表 | 类型、manifest schema 和版本兼容 |
| #17 页面原型 | 语义块、归因、媒体边界 | 双语 renderer 与响应式样式 |
| #18 导入器 | preflight、失败分类、双语输入 | 采集、媒体本地化、导入和校验命令 |

## Import command

    npm run tutorials:inventory
    npm run tutorials:collect -- --url https://developers.google.com/search/docs/fundamentals/seo-starter-guide --source-path /seo_roadmap/seo-fundamentals/ --slug google-seo-starter-guide --output temp/seo-starter.snapshot.json
    npm run tutorials:import -- --input temp/seo-starter.snapshot.json --translation temp/seo-starter.zh-CN.html
    npm run tutorials:review -- --slug google-seo-starter-guide --input temp/seo-starter.review.json

采集器输出英文来源 HTML、元数据和媒体清单。翻译员据此创建 UTF-8 `temp/seo-starter.zh-CN.html`，文件只包含正文语义片段，保留英文稿的标题锚点、块顺序和媒体引用，并记录译者身份；导入命令要求显式 `--translation`，缺失时立即失败且禁止英文回退。审校员根据导入生成的双语 draft 填写 `temp/seo-starter.review.json`，至少包含 `decision`、`reviewer`、`reviewedAt`、十一项 `checklist` 和 `notes`，审校命令验证该文件后才允许进入 published。

Collector 只访问 HTTPS 公共地址，逐跳跟随有限重定向并重新解析 DNS；私网地址、超大响应和跨策略主机进入失败报告。失败分类包含 redirect-loop、bot-challenge、authentication、non-html、unavailable、canonical-mismatch、extraction-failure、unsafe-markup 和 unsupported-media。Google adapter 优先提取 .devsite-article-body，再使用明确的 article/main profile。图片下载到教程媒体根并按来源 URL 哈希命名；YouTube/Vimeo iframe 使用 allowlist，交互内容保留来源链接或静态截图。

Import 阶段必须同时接收英文来源 HTML 和简体中文译稿，执行最终 HTML sanitizer、URL 协议校验、图片本地化检查、iframe host 校验、heading anchor 检查、内容哈希和 manifest schema 检查。正文和 manifest 通过校验后使用临时文件原子替换；失败时保留现有已发布数据。

## URL, metadata and SEO

本票锁定根 locale 使用 /tutorials/<slug>/，英文使用 /en/tutorials/<slug>/。#15 负责按此 contract 实现页面自引用绝对 canonical、互相输出 hreflang=zh-CN 与 hreflang=en、同步输出 locale、已发布页进入 sitemap、预览状态 noindex，以及 TechArticle JSON-LD（headline、description、inLanguage、dateModified、author、publisher、mainEntityOfPage、isBasedOn）。

## Acceptance contract

Issue #14 将完整的 Pilot 通过/失败标准锁定在
[`tutorial-internalization-acceptance.md`](./tutorial-internalization-acceptance.md)。
该契约覆盖 source-content coverage、media integrity、translation fidelity、
accessibility、responsive rendering、security、SEO、internal navigation、
provenance、build verification、refresh drift 和 rollback，并把每项标准
绑定到可检查的 manifest、HTML、媒体、运行时或生命周期证据。

可执行门禁为 `npm run tutorials:check`；门禁同时验证 Pilot 的真实内容
指标与重复链接、刷新漂移、中断提交恢复、回滚四类生命周期场景。发布还需
通过 `npm run check:data`、`npm run lint`、`npm run typecheck`、
`npm run build` 和 `npm run test:smoke`。

## Operations

迁移按来源清单逐篇执行，每篇独立完成 preflight、快照、媒体、英文源、中文翻译、人工审校和发布。定时同步属于后续能力；当前流程由仓库命令显式触发，生成产物进入代码审阅和版本控制。

## Out of scope

多页指南与课程、PDF 教程、视频主体教程、工具/模板/目录/落地页、定时自动同步、批量生产迁移和生产部署均由后续决策或执行票据处理。

# SEO Fundamentals 来源处理研究

- 关联决策票：[Define source-specific normalization and attribution decisions（Issue #22）](https://github.com/yangchuansheng/learnseo-zh/issues/22)
- 所属地图：[SEO Fundamentals tutorial completion（Issue #19）](https://github.com/yangchuansheng/learnseo-zh/issues/19)
- 研究日期：2026-08-31（Asia/Shanghai）
- 研究范围：`/seo-fundamentals` 路线页上的七个待处理来源，以及已经发布的 Google SEO Starter Guide 基线。

## 结论

候选来源应按来源本身的语义拓扑进入不同处理路径：Google 的两篇单页文档进入第一批导入；Ahrefs 与 Mangools 在 `2026-09-01` 获得项目 owner 书面授权后进入 Wave 2 内化发布，并需要来源专用抽取器、媒体处理、元数据补齐和授权交接证据；Moz 是九章多页指南入口，ContentKing/Conductor 是资源集合页，Semrush 是视频课程目录，这三项应保留外部入口并进入后续人工项目。Google SEO Starter Guide 继续作为已发布 Pilot 基线。

当前导入器的 Google adapter 以 `.devsite-article-body` 为首选抽取边界，随后才尝试第一个 `article` 或 `main`；发布模型要求记录请求 URL、最终 URL、页面 canonical、来源路径、内容类型、更新时间、抓取时间、内容哈希和许可证/归因证据。教程 HTML 只接受语义内容块（标题、段落、列表、链接、表格、代码、引用、图片、图注及受控 iframe），图片必须仓库本地化，iframe 必须使用 HTTPS 允许列表。

## 决策表

| 来源卡 | 当前页面与拓扑证据 | 归一化处理 | 归因与 provenance | 处置 |
| --- | --- | --- | --- | --- |
| [Google How Search Works](https://developers.google.com/search/docs/fundamentals/how-search-works) | 请求 URL 与页面 canonical 一致；Google 单页文档，正文围绕 crawling、indexing、serving 三阶段组织；页面标注 `2025-12-18 UTC` 更新。 | 复用 `google-devsite` 抽取边界 `.devsite-article-body`；保留标题、段落、列表、链接及原有锚点；当前页面未发现必须转化的表格、代码块或 iframe。 | provider：`Google Search Central / Google for Developers`；页面无个人作者时 `author: null`；一般内容采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，代码采用 [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)，并记录 [Google site policies](https://developers.google.com/terms/site-policies)。 | **第一批直接导入候选**。进入双语翻译、媒体快照和发布门禁。 |
| [Google Search Essentials](https://developers.google.com/search/docs/essentials) | 请求 URL 与页面 canonical 一致；单页文档，覆盖 technical requirements、spam policies 和 key best practices；页面标注 `2025-12-10 UTC` 更新。 | 复用同一 Google adapter；保留语义标题、列表、链接和内部锚点；不引入来源页面之外的教程章节。 | provider：`Google Search Central / Google for Developers`；无个人作者时 `author: null`；记录页面的 [CC BY 4.0 / Apache 2.0 code](https://developers.google.com/terms/site-policies) 证据和更新时间。 | **第一批直接导入候选**。完成 Google How Search Works 后处理。 |
| [Moz Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo) | 页面 canonical 为请求 URL；当前页面是指南目录/简介，article 中列出 9 个独立章节 URL：quick start、search engines、keyword research、on-page、technical、links、measurement、glossary 等。完整内容分散在多页。 | 保留资源卡和目录页外链；将九个章节视为独立来源候选，逐章重新做 preflight。页面的简介、目录和 CTA 可作为索引内容，不能把目录页宣称为完整教程；去除空 `alt` 的促销 banner，实质性图示在获得权利并完成本地化后再保留。 | provider：Moz；页面 JSON-LD 提供 `datePublished: 2022-10-05`、`dateModified: 2025-12-02`，作者/发布方标识指向 Moz 身份；页面页脚显示 SEOMoz/Ziff Davis 版权并链接 [Moz Terms of Use](https://moz.com/terms-of-use)。全文翻译再发布及图示复用需要单独版权审核。 | **保留外部入口，进入多页指南人工队列**。来源卡暂不转换为单个内部教程。 |
| [Ahrefs SEO Basics](https://ahrefs.com/blog/seo-basics/) | 请求 URL HTTP 301 到 `https://ahrefs.com/seo/seo-basics`；最终页面 canonical 为新 URL。最终页是连续单页文章，含 H1、分层 H2/H3/H4、约 130 个段落和文章图片；页面有跨文章 SEO Guide 导航。Wave 2 采集使用 HTTP `Last-Modified` 作为发布门禁更新时间证据。 | 将来源卡和 source key 显式 rebind 到最终 canonical，保留请求/最终 URL 关系；为 React/CSS 结构添加稳定来源专用 adapter，只抽取文章主体，排除全局导航、促销和 related cards；保留文章引用链接；17 张批准图片下载到教程媒体根，保留 `alt`、来源 URL、顺序和 SHA-256；当前无正文表格、代码、iframe。 | provider：Ahrefs；页面显示 Joshua Hardwick（former Head of Content），contributors Sam Oh、Louise Linehan，reviewer Ryan Law；这些角色分别记录于 provenance，`author` 取页面主作者 Joshua Hardwick。版权依据为 [Ahrefs Terms](https://ahrefs.com/legal/terms)：内容权利归相应权利人，条款只授予明示范围内的使用，适用时要求归因；项目 owner 在 `2026-09-01` 确认已取得书面许可，敏感凭证保留在仓库外。 | **已授权内化**。完成 canonical rebind、稳定抽取器、更新时间证据、媒体审核、授权交接、翻译 review 和发布门禁后，发布到 `/tutorials/ahrefs-seo-basics/`。 |
| [ContentKing SEO Guide](https://www.contentkingapp.com/academy/seo-guide/) | 请求 URL HTTP 301 到 `https://www.conductor.com/academy/technical-seo-hub/`；最终 canonical 为 Conductor 新品牌 URL。最终页是 Technical SEO 资源集合页，使用资源卡网格、试用表单和营销/导航壳，包含多篇独立文章链接。 | 不抽取集合页壳、表单、GTM iframe、促销图或卡片摘要作为教程正文；保留外部资源入口。未来若选择具体 Conductor 文章，必须为每篇文章建立新的 source card，并重新核验 canonical、主体完整性、更新时间和许可。 | provider 需按最终页面记录为 Conductor；原 ContentKing 请求 URL、最终 URL、页面 canonical 和 301 关系全部写入 provenance；页面页脚显示 `© Conductor 2026`，并链接 [Conductor Terms of Use](https://www.conductor.com/legal/terms-of-use/)。 | **保留外部入口，标记 canonical mismatch 并进入资源集合人工队列**。当前页面不具备单个教程的连续完整主体。 |
| [Mangools Learn SEO](https://mangools.com/blog/learn-seo/) | 请求 URL 与 canonical 一致；页面是一个连续长文，标题为 “The Complete SEO Guide for Beginners”，分为 8 个章节并使用 `#part1`–`#part8` 锚点；页面标注阅读时长 130 分钟、作者 Vlado Pavlik、`Last updated May 19, 2026`。 | 使用 WordPress/自定义主题 adapter 抽取 `.mg-post-content`；保留章节顺序和锚点，将正文中的多个章节级 H1 降为一个 H1 下的 H2；将图片 `data-src` 归一到 `src` 后下载本地，保留描述性 `alt`、尺寸和来源 URL；79 张批准图片本地化，活动 `mangools-seo-academy.svg` 按 unsupported-media 审核排除。保留有标题的 YouTube iframe `https://www.youtube.com/embed/wTwnFcWUM3k?feature=oembed`，因为 host 在现有允许列表内；quiz/certificate/newsletter 表单转为静态来源 CTA。 | provider：Mangools；author：Vlado Pavlik；JSON-LD 提供 `datePublished: 2026-05-14`、`dateModified: 2026-05-19`；记录抓取时 HTTP `Last-Modified` 作为快照证据，并链接 [Mangools Conditions](https://mangools.com/conditions)。页面含 Google、Mangools 和第三方外链，保持原始链接及来源归因；项目 owner 在 `2026-09-01` 确认已取得书面许可，敏感凭证保留在仓库外。 | **已授权内化，人工规范化已完成**。完成 quiz/certificate 静态处理、YouTube allowlist、图片审核、授权交接、翻译 review 和发布门禁后，发布到 `/tutorials/mangools-complete-seo-guide/`。 |
| [Semrush SEO Fundamentals Course](https://www.semrush.com/academy/courses/seo-fundamentals-course-with-greg-gifford/) | 请求 URL HTTP 308 到 `https://www.semrush.com/academy/courses/seo-essentials-with-semrush/`；最终 canonical 为新 URL。最终页是免费课程目录，列出 20 个 video-led lessons、讲师、时长、Enroll CTA 和试用营销内容；课程索引没有连续教程正文、明确更新时间或可直接抽取的视频 iframe。 | 不把课程目录展平为单个教程；保留课程卡及最终 canonical 外链。未来课程项目应按 lesson 逐项建立来源记录，明确视频 URL、字幕/文字稿可用性、媒体权利和课程交互；排除 enrollment buttons、表单和营销壳。 | provider：Semrush；页面列出 Kyle Byers、Rita Cidre 讲师；记录请求/最终/canonical URL 和课程 lesson 数量；页面页脚显示 Semrush 版权并链接 [Semrush Legal](https://www.semrush.com/company/legal/)。页面未提供 source update 值；课程视频、字幕及讲师内容需要单独权利确认。 | **保留外部入口，标记 canonical mismatch，进入课程/视频人工队列**。当前不生成单个双语内部教程。 |
| [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)（已发布 Pilot） | 请求 URL 与 canonical 一致；已发布双语路径 `/tutorials/google-seo-starter-guide/` 与 `/en/tutorials/google-seo-starter-guide/`。Google 单页正文当前基线计数为 `h1:1, h2:11, h3:13, h4:2, p:63, ul:6, li:17, a:54, img:4, table:2, code:16`，无 iframe/pre；页面标注 `2025-12-10 UTC` 更新。 | 继续作为 Google adapter、图片本地化、表格语义、行内代码、双语结构、canonical/hreflang/TechArticle JSON-LD 和发布门禁的基线；源页面之外的导航、反馈控件和页脚不进入正文。 | provider：`Google Search Central / Google for Developers`；无个人作者时 `author: null`；一般内容 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，代码 [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)，页面政策见 [Google site policies](https://developers.google.com/terms/site-policies)。 | **保持已发布状态**。后续来源处理以 Pilot 的 provenance、媒体哈希和双语结构门禁为回归基线。 |

## 来源专用处理决定

### 1. URL 身份、canonical 和重定向

- 每个候选至少保存 `requestedUrl`、重定向后的 `finalUrl`、页面声明的 `canonicalUrl`、抓取时间和内容哈希。来源卡的旧 URL 发生 301/308 时，先更新来源卡或执行显式 one-way rebind，再启动导入。
- Ahrefs、ContentKing/Conductor、Semrush 都有请求 URL 与最终 canonical 不同的情况。它们分别代表品牌/路径迁移、资源集合迁移和课程迁移；这些关系要在 provenance 中可审计。Ahrefs 已通过 manifest alias、`canonicalRebind` 和资源卡映射记录旧 URL 与最终 canonical 的关系。
- Google 两篇候选与 Starter Guide 的请求 URL、最终 URL、canonical 对齐，适合作为直接导入波次。

### 2. 单页完整性与导航

- “单页”指一个页面中包含可独立阅读的完整主题主体。Moz 的目录页只有简介和九个章节链接；Semrush 的课程索引只有 lesson 元数据和视频/报名入口；两者都按集合/课程导航处理。
- Mangools 的八个章节全部存在同一 HTML article 中，属于一个连续长文，章节锚点保留并重建标题层级。
- Ahrefs 的正文是一篇连续文章；跨文章 “Master SEO Step by Step” 导航保留为来源外链或在主体边界外过滤。
- Conductor 集合页的卡片摘要、footer、表单和营销 CTA 不构成教程正文；具体文章需要各自 preflight。

### 3. HTML 语义、表格与代码

- 归一化结果只使用现有教程语义模型支持的标题、段落、列表、链接、表格、代码、引用、图片、图注和 iframe。保留原始顺序、标题 ID、链接及数据值。
- Google Starter Guide 已证明表格和行内代码可以通过当前渲染与发布门禁；How Search Works、Search Essentials 当前快照没有需要额外适配的表格/代码块，导入器不应凭空新增结构。
- Ahrefs、Mangools 当前页面未发现需要迁移的原生表格/代码块。Mangools 的“quiz”是表单交互，不能当作表格语义或普通段落直接保留。

### 4. 图片、延迟加载和第三方媒体

- 当前模型要求每个 `<img>` 使用仓库本地路径、非空且有意义的 `alt`，并建议记录 `sourceUrl`、宽高与 SHA-256。Ahrefs、Moz、Conductor、Mangools 页面含营销/装饰图片，应先按语义筛选。
- Mangools 约 91 张 article 图片中大部分使用 `data-src`；Ahrefs 图片也使用来源资源路径。来源专用 adapter 必须先把有效的 `data-src` 归一到 `src`，再执行 URL 解析、下载和哈希。`data-src` 为空或缺少可访问 alt 的装饰图片进入丢弃清单。
- 当前 allowlist 支持 YouTube/Vimeo 等 HTTPS iframe。Mangools 的 YouTube 教学 iframe可保留，补齐 `src` 和可访问的 `title`；Semrush 课程目录中的视频/客户端交互没有可直接抽取的 iframe，应保留课程外链并开展单独视频权利工作。Conductor 的 GTM iframe属于页面壳，删除。

### 5. 表单、测验、证书和其他交互

- 当前 sanitizer 明确排除 `form`、`input`、`button`、脚本和可执行页面壳。交互内容的归一化决定是保留说明性文本与来源链接，或在教程中加入清晰的“在来源页面完成”外链。
- Mangools 含 SEO quiz、certificate download 和 newsletter 表单。教程保留测验/证书的文字说明与来源链接；本地页面只呈现已审校的静态 CTA。这个静态处理已随 Wave 2 owner 授权进入导入 handoff。
- Moz article 中的 HubSpot loader 和 CTA 属于来源壳，删除脚本/表单，仅保留具有教程语义的内容与合法来源链接。
- Semrush 的 Enroll CTA、课程按钮和报名流属于课程产品交互，保留外部课程入口；内部教程不模拟报名状态。

### 6. 归因、许可证与 provenance

发布记录应至少包含来源标题、provider、可空的个人 author、请求/最终/canonical URL、source path、`text/html` content type、canonical match 结果、来源更新时间、captured-at、source/content hashes 及 license/attribution text；渲染页面显示 canonical 来源链接，结构化数据输出 `isBasedOn`。

- Google 页面提供明确 CC BY 4.0 与 Apache 2.0 code evidence，可以作为第一批公开翻译导入来源；遵循许可证要求及 Google site policies。
- Ahrefs、Moz、Mangools、Conductor、Semrush 页面显示品牌版权或条款入口，研究中未发现可直接支持全文翻译再发布的开放许可证。Ahrefs 与 Mangools 通过 Wave 2 owner 授权进入内化发布；Moz、Conductor、Semrush 仍需版权/许可审查，记录页面条款 URL 和抓取时的版权证据。
- Ahrefs 页面明确 Joshua Hardwick 为主作者，并列出 contributors/reviewer；Mangools JSON-LD 明确 Vlado Pavlik 为作者；Semrush 页面列出 Kyle Byers、Rita Cidre 讲师，但课程未满足单页导入条件。Moz 页面 JSON-LD 提供 Moz 身份/creator 标识而未形成清晰个人作者字段，记录 `author: null` 并保留 publisher/provider 证据更稳妥。

## 与本地实现的衔接

本研究基于以下本地约束形成决定：

- [tutorial-internalization-spec.md](tutorial-internalization-spec.md)：五项资格检查为 `publiclyAccessible`、`continuousBody`、`topicComplete`、`singlePage`、`canonicalVerified`；课程、文档中心、工具、下载、登录/付费内容、多页指南及纯视频来源进入人工队列。
- [tutorial-internalization-acceptance.md](tutorial-internalization-acceptance.md)：要求双语语义结构一致、图片有用 `alt`、iframe 有标题、表格保持语义、媒体本地化、来源归因完整。
- [tutorial-internalization-lifecycle.md](tutorial-internalization-lifecycle.md)：发布前要求五项资格检查、双语章节 parity、sanitizer/media/attribution 检查、reviewer 和完整 checklist。
- [src/lib/tutorials/model.ts](../../src/lib/tutorials/model.ts)：允许的正文语义标签和 iframe host allowlist；发布快照需要 `sourceUpdatedAt`、许可证证据与 provenance。
- [scripts/lib/tutorial-importer.mjs](../../scripts/lib/tutorial-importer.mjs)：当前 extractor 首选 `.devsite-article-body`，图片只读取 `src`，因此 Mangools/Ahrefs 的延迟加载和自定义 DOM 需要来源专用 adapter 或预归一化快照。

## 未决问题

1. Moz 的全文简体中文再发布、截图/插图本地化及第三方引用图片许可仍需单独落定。
2. Ahrefs 与 Mangools 的外部书面授权凭证位置由项目 owner 在仓库外保存；仓库记录授权范围和执行 handoff。
3. Ahrefs 的页面缺少 HTML `dateModified`；当前发布记录使用 HTTP `Last-Modified` 与 capture/hash 证据，后续 refresh 继续复核。
4. Conductor 和 Semrush 的 canonical 迁移资源卡更新仍需后续人工确认；Ahrefs 旧 URL 已作为来源别名保留。
5. Ahrefs React/CSS、Mangools WordPress 主题的稳定抽取边界需要在 refresh 时复核 selector 变化。
6. Semrush 课程未来是否拆为 lesson 级内容；需要先确认可用字幕/文字稿、视频许可、讲师归因和课程页面的索引策略。

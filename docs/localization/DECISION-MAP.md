# LearningSEO.io 双语实现决策

## 语言与路由

- 简体中文（`zh-CN`）拥有现有根路径：`/`、`/about/`、`/seo_roadmap/...`。
- English 使用 `/en/...` 前缀；同一路径的两种语言共享静态路由清单。
- `/en` 与 `/en/` 指向英文首页；根路径旧版 roadmap URL 继续永久跳转到 `/`，英文对应路径跳转到 `/en/`。
- 缺少等价页面时，语言切换器回退到同一源路径的默认简体中文；当前 161 条清单已完成两种语言的路由配对。

## 渲染与内容源

- `HomePage`、`SubpageDocument` 和所有站点组件共享渲染逻辑，locale 只决定内容、链接和文案。
- 英文源文件保留在原位置；中文首页内容位于 `content.zh-CN.json`，中文子页面位于 `generated/content-zh-CN/`，中文 manifest 位于 `manifest.zh-CN.json`。
- `translation-manifest.json` 记录英文源内容与每个页面的 SHA-256；刷新源站后先做差异检查，再只翻译变更项。

## SEO 与可访问性

- 页面 canonical 使用 `https://learningseo.io` 生产 origin，中文与英文互相输出 `hreflang`。
- `app/sitemap.ts` 输出所有可索引 canonical 页面及语言替代项；旧 URL 只保留 308 永久跳转。
- `app/robots.ts` 允许两种语言并指向生产 sitemap。
- 根 layout 根据代理设置的 locale 输出 `html[lang]`；语言切换器保留等价路径并提供可访问名称。

## 内容规则

- SEO 首次出现使用中文术语加英文缩写，例如“搜索引擎优化（SEO）”；品牌、产品、人名和 URL 保持原文。
- 数字、事实、日期、引用、链接、HTML 结构与媒体地址保持一致；标题和 CTA 使用面向中文搜索意图的主动表达。
- 图像替代文本、表单标签、按钮状态、导航、页脚与生成 HTML 同步本地化。

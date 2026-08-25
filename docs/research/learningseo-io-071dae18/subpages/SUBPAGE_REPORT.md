# LearningSEO.io 子页面复刻报告

## 范围

- 来源站点：<https://learningseo.io>
- Sitemap 条目：161
- 去重后的最终公开路径：159
- 保留重定向：`/the-seo-learning-roadmap/` → `/`；`/seo_roadmap/seo-fundamentals/introduction-to-seo/` → `/seo_roadmap/seo-fundamentals/`
- 页面组成：156 个 SEO roadmap 内容路由、`/about/`、`/updates/`、`/privacy-policy-terms-of-use/` 与首页内容入口

## 实现

- `src/app/[...slug]/page.tsx` 提供 Next.js App Router 动态 catch-all 路由、静态参数、页面 metadata、规范化路径和重定向。
- `data.json` 保存抓取后的页面标题、描述、canonical、body class、HTML 内容和来源路径，页面内容使用服务端渲染。
- `subpage.css` 由原站主题样式生成并限定在 `.learningseo-subpage` 下，避免影响首页设计系统。
- 原站主题资源与页面媒体资源存放于 `public/sites/learningseo-io-071dae18/subpages/`，共 17 个主题资源和 50 个媒体资源。
- `SubpageRuntime` 保留 roadmap 折叠、FAQ 折叠、视频播放、分享弹层和 tips 瀑布流布局行为。
- `SubpageFooter` 复刻子页面的 newsletter、站点地图、社交链接和版权区域，并将内部链接映射到本地路由。
- 首页与子页面共享的 Header、Footer、正文 HTML、搜索表单和 canonical 均使用本地路径；第三方资源与社交分享链接保持外部目标。

## 代表性模板

| 模板 | 路径示例 | 验证视口 |
| --- | --- | --- |
| Roadmap detail | `/seo_roadmap/seo-fundamentals/` | 1440×900、390×844 |
| Roadmap category | `/seo_roadmap/execute-seo/` | 1440×900、390×844 |
| Content page | `/about/`、`/privacy-policy-terms-of-use/` | 1440×900、390×844 |
| Updates | `/updates/` | 1440×900、390×844 |
| Accelerator content | `/seo_roadmap/accelerate-learning/seo-accelerator/` | 1440×900、390×844 |

截图与原站对照文件位于 [`docs/design-references/learningseo-io-071dae18/subpages/`](../../../design-references/learningseo-io-071dae18/subpages/)。

## 验证

- `npm run check`：通过
- 生产构建：通过，生成首页与 157 个动态路由参数页面
- Sitemap 中的 161 个来源路径：本地生产服务逐一请求并返回可访问页面
- 代表性页面：完成桌面端、移动端几何检查和交互检查

原站自身保留一个空 YouTube ID 缩略图引用，复刻数据沿用该页面行为。

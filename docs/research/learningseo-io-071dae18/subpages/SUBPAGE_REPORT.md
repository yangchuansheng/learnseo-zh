# LearningSEO.io 子页面复刻报告

## 范围

- 来源站点：<https://learningseo.io>
- Sitemap 条目：161
- 去重后的最终公开路径：159
- 保留重定向：`/the-seo-learning-roadmap/` → `/`；`/seo_roadmap/seo-fundamentals/introduction-to-seo/` → `/seo_roadmap/seo-fundamentals/`
- 页面组成：156 个 SEO roadmap 内容路由、`/about/`、`/updates/`、`/privacy-policy-terms-of-use/` 与首页内容入口

## 实现

- `src/app/[...slug]/page.tsx` 提供 Next.js App Router 动态 catch-all 路由、静态参数、页面 metadata、规范化路径和重定向。
- `generated/manifest.json` 保存 161 条轻量路由元数据；158 份 HTML 按内容哈希拆分到 `generated/content/`，构建时读取并静态生成。
- `generated/subpage.css` 由原站主题样式生成并限定在 `.learningseo-subpage` 下，避免影响首页设计系统。
- 原站主题资源与页面媒体资源存放于 `public/sites/learningseo-io-071dae18/subpages/`，共 17 个主题资源和 50 个媒体资源。
- 生成器使用浏览器 DOM 解析清理 HTML，严格拦截危险标签、事件属性与 URL 协议，并校验内部链接和本地资源。
- `SubpageRuntime` 保留移动端资源侧栏、FAQ 折叠、视频播放、分享弹层和 tips 瀑布流布局行为。
- 首页与 157 个内容页共用 React roadmap；当前阶段和当前资源带有可访问状态标记。
- `SubpageFooter` 复刻子页面的 newsletter、站点地图、社交链接和版权区域，并将内部链接映射到本地路由。
- 首页与子页面共享 Header 和 Footer；正文链接与 canonical 使用本地路径；搜索提交到 LearningSEO.io 原站。

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
- 生产构建：通过，共静态生成 164 个页面
- 数据完整性：161 条来源路由、158 份内容文件、1937 个内部链接和 43 个页面内本地资源通过校验
- 生产冒烟：规范化重定向、canonical、搜索、移动侧栏、FAQ、视频、分享和 roadmap 状态通过真实浏览器检查
- 代表性页面：完成桌面端、移动端视觉检查

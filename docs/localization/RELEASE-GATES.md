# 双语发布门禁

- 路由：161 条源路由与中文 manifest 顺序、路径、重定向完全一致；每份 HTML 都有中文对应文件。
- 覆盖：首页 JSON、生成正文、title、description、导航、页脚、表单、按钮、aria-label、alt、document `lang` 和内部链接均通过覆盖检查。
- SEO：canonical 使用生产 origin；中文、英文 `hreflang` 成对；sitemap 不含旧重定向 URL；robots 指向 sitemap。
- 安全：生成 HTML 继续通过既有清理规则，中文产物不含 script 或事件属性，URL 协议和媒体源保持白名单约束。
- 事实：数字、日期、品牌、人名、URL、HTML 标签和媒体引用通过源译文对照检查。
- 行为：语言切换保持等价路径；FAQ、资源侧栏、视频、分享、roadmap 状态和搜索在两种语言下可用。
- 工程：`npm run check:data`、`npm run lint`、`npm run typecheck`、`npm run build` 和 `npm run test:smoke` 全部通过。

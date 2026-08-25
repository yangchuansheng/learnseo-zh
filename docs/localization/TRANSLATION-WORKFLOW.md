# 翻译与上游刷新工作流

## Source of truth

英文抓取产物是事实源，中文文件是可审阅的派生编辑产物。每次刷新都保留英文 manifest、HTML 哈希和中文译文哈希，构建阶段只读取已提交的本地文件。`translation-manifest.json` 同时按英文源片段保存中文编辑结果，供后续刷新复用。

## 日常流程

1. 运行 `npm run generate:subpages` 更新英文快照。
2. 运行 `node scripts/translate-learningseo.mjs`，脚本根据源文件哈希缓存翻译，并写入中文 manifest、HTML 与 `translation-manifest.json`。
3. 人工检查代表性模板：roadmap detail、category、content、updates、accelerator，以及移动端导航、FAQ、分享和语言切换。
4. 运行 `npm run check`；数据完整性、翻译覆盖、lint、类型检查和生产构建全部通过后再合并。

源文件变化会让 `check-learningseo-localization.mjs` 失败，形成显式 review 门禁。中文编辑内容只在对应源片段变化时重翻，未变化片段保持原译文；变化片段进入翻译和人工审核队列。

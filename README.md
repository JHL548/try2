# Word 重复点插件 Demo

这是一个端到端技术验证工程，用于验证：

- 后端将 `doc/docx` 转为前端可编辑的 HTML 标准模型。
- agent 或模拟 agent 输出重复点范围、相似度和关联从文档。
- npm 插件只处理单个已转换文档的渲染、编辑、高亮和滚动定位。
- Vue3 Demo 负责主/从文档编排、重复点切换、从文件切换和导出。
- 后端将编辑后的 HTML 回写为 DOCX。

## 目录结构

- `packages/core`：框架无关类型、相似度颜色、范围处理、Tiptap 高亮扩展。
- `packages/vue`：Vue3 适配组件。
- `packages/react`：React 适配组件。
- `apps/frontend`：Vue3 + TS 技术验证页面。
- `apps/backend`：FastAPI 转换、模拟 agent 和 DOCX 导出服务。

## 启动

```bash
npm install
pip install -r apps/backend/requirements.txt
npm run dev:backend
npm run dev:frontend
```

如本机安装了 LibreOffice，后端会优先使用 `soffice --headless` 进行 Word 转换；否则 `.docx` 会走 `python-docx` 的基础文本兜底转换。当前上传入口仅支持 `.doc` 和 `.docx`。兜底转换会有更多格式损失，但足够验证高亮定位与编辑回写流程。

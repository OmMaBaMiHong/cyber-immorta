# Cyber Immorta · 赛博永生

> **把每个人蒸馏成一个可对话、可调用、可持续演进的数字人格。**

## 项目简介

Cyber Immorta（赛博永生）是一个开源的人类蒸馏产品前端。它允许用户上传聊天记录、对话、文档、截图等个人材料，通过后端引擎将其转化为 **结构化画像、记忆图谱、技能卡片和可对话的数字人格**。

这不是玄学意义上的永生，而是：

- **证据驱动** — 所有画像结论必须带来源引用
- **可对话** — 蒸馏完成后可与人格对象持续对话
- **可演进** — 新材料可以持续补充，人格持续更新
- **可调用** — 人格可被 agent 系统作为 skill / persona 调用

## 功能

- **蒸馏项目** — 上传材料 → 解析 → 提取 → 生成画像报告 → 可对话人格
- **人物画像** — MBTI / 价值观 / 能力雷达 / 叙事风格分析
- **报告广场** — 公开报告图文动态，可互动
- **重生模板** — 人格风格化视觉封面生成
- **多版本 UI** — v2 / v3 多套界面风格
- **管理员面板** — 模型 provider 配置、SMTP 设置、系统管理

## 快速开始

```bash
# 安装依赖
npm install

# 配置 API 地址
cp .env.example .env

# 启动开发服务器
npm run dev -- --host 127.0.0.1 --port 5173
```

默认地址: `http://127.0.0.1:5173`

> 你需要同时运行后端服务（distill-machine-agent）以提供完整功能。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS |
| 路由 | Vue Router |
| HTTP | Axios |
| PWA | vite-plugin-pwa |

## 相关项目

| 项目 | 说明 |
| --- | --- |
| [Cyber Immorta](https://github.com/OmMaBaMiHong/cyber-immorta) | 开源前端（本仓库） |
| **赛博永生·人类蒸馏计划** | [https://zhen.ai-ni.store](https://zhen.ai-ni.store) — 产品官网 & 在线服务 |
| distill-machine-agent | 后端蒸馏引擎（即将开源） |

## 白皮书

详见 [`docs/whitepaper-cyber-immortality-human-distillation-plan.md`](docs/whitepaper-cyber-immortality-human-distillation-plan.md)，涵盖项目背景、核心命题、技术架构、伦理边界和开放路线。

## 许可

MIT License

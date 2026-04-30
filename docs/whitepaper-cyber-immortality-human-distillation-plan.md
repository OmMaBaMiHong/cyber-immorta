# 赛博永生·人类蒸馏计划白皮书

版本：0.1  
日期：2026-04-28  
项目：zhengliu-renlei / distill-machine-agent / distill-human-web / Hermes execution base

## 摘要

“赛博永生·人类蒸馏计划”不是关于玄学意义上的永生，也不是声称 AI 可以复制一个完整的人。

它要解决的是一个更具体、更工程化的问题：

**如何把一个人的记忆材料、表达方式、知识结构、关系模式和行动方法，蒸馏成一个可解释、可对话、可调用、可持续演进的数字人格对象。**

在这个项目里，“永生”指的是人格信息和能力模式的长期保存；“蒸馏”指的是从用户授权材料中提取证据、形成画像、构建记忆、生成报告，并进一步沉淀为可被 agent runtime 调用的 skill / persona / digital twin。

当前仓库已经具备三层基础：

- `distill-human-web`：普通用户可操作的蒸馏产品界面。
- `distill-machine-agent`：负责蒸馏、检索、对话、报告、动作建议和持久化的后端产品层。
- `distill-machine-agent/vendor/hermes-agent`：作为执行底座，承接 skill、tools、gateway、scheduler 和 agent execution 能力。

本白皮书定义项目的开源叙事、核心概念、技术架构、伦理边界、开放路线和社区协作方式。

## 1. 背景：为什么需要人类蒸馏

大模型已经让“问答”变得廉价，但真正稀缺的不是通用回答，而是一个人长期积累下来的：

- 经验判断
- 表达风格
- 价值排序
- 关系记忆
- 决策模式
- 工作方法
- 可复用技能

这些信息过去分散在聊天记录、文档、社交媒体、代码仓库、语音、照片、作品集和共同经历里。它们不是结构化知识库，却构成了一个人被他人识别、理解和记住的方式。

“人类蒸馏计划”的目标，是把这些非结构化材料变成可治理的数字人格资产：

```text
原始材料
  -> 证据切片
  -> 画像报告
  -> 记忆结构
  -> 人物卡
  -> 可对话 persona
  -> 可调用 skill
  -> 可执行 agent
```

项目的核心判断是：

**未来的 AI 产品不会只围绕模型展开，也会围绕“被蒸馏出来的对象”展开。**

这些对象可以是自己、亲友、专家、创作者、职业角色、团队方法论，也可以是一个开源 skill 仓库。对象被蒸馏以后，才有可能进入长期对话、持续学习、工具调用和社区分发。

## 2. 核心命题

### 2.1 赛博永生不是复制灵魂，而是保存可验证的人格痕迹

本项目不假设存在一个可被完整复制的“灵魂实体”。它只处理可观察、可授权、可解释的信息：

- 用户主动上传的材料
- 公开或授权导入的文档
- 已生成报告中的证据链
- 对话过程中的可追溯上下文
- skill / pack 中声明的能力边界

所以项目的基本承诺不是“还原一个人”，而是：

**在明确材料边界内，生成一个诚实说明来源、置信度和限制的数字人格代理。**

### 2.2 数字人格必须是证据驱动的

没有证据的画像只是幻觉。

蒸馏报告必须带有：

- `support_ids`
- `evidence_card_ids`
- `confidence`
- `honest_limits`

这意味着任何人格结论都应该能回答三个问题：

1. 这个判断来自哪些材料？
2. 这个判断有多确定？
3. 哪些部分不能被现有材料支持？

### 2.3 人格对象与执行能力要分层

一个数字人格对象不应该天然拥有无限行动权。

项目把对象分成三类层级：

- **可理解对象**：画像、报告、人物卡。
- **可对话对象**：persona、聊天会话、长期记忆。
- **可执行对象**：skill、typed action、tool runtime、agent workflow。

对用户来说，这三者可能表现为一个“数字分身”。但在系统内部，它们必须保持分层，因为理解、对话和执行的风险完全不同。

## 3. 产品定义

一句话定义：

**把“把一个人蒸馏成 skill / 专家分身 / 可执行代理”的开发者能力，降门槛成普通用户也能直接操作的 GUI 产品。**

首阶段产品不追求成为通用 agent 平台，而是聚焦三个可感知场景。

### 3.1 蒸馏自己

用户上传自己的材料，系统生成：

- 自我画像
- 表达风格分析
- 关系模式分析
- 决策偏好
- 人物卡
- 可对话的自我镜像
- 可继续训练的个人 skill

这个场景的价值不是“替用户活着”，而是帮助用户整理自己、理解自己、复用自己的经验。

### 3.2 蒸馏关系对象

用户基于合法、授权或个人持有的材料，生成某个关系对象的画像：

- 关系对象的人格线索
- 相处策略
- 沟通风险
- 对话模拟
- 关系阶段判断

这个方向必须受到最严格的伦理约束：不能鼓励骚扰、操控、欺骗、越权跟踪或未经同意的敏感推断。

### 3.3 蒸馏专家与职业角色

专家型或职业型对象可以沉淀为：

- 专家分身
- 方法论 skill
- 职业 agent
- 可被克隆和二次使用的 pack

典型对象包括教育规划专家、行业顾问、创作者方法论、工程师工作流、设计师工作流等。

## 4. 对象模型

项目主链路为：

```text
蒸馏对象
  -> 蒸馏项目
  -> 蒸馏过程
  -> 蒸馏报告
  -> 人物卡 / 项目 skill
```

### 4.1 蒸馏对象

用户想要蒸馏或对话的目标，例如：

- 自己
- 某个关系对象
- 某位专家
- 某个 GitHub skill
- 某个职业角色

### 4.2 蒸馏项目

围绕某个对象创建的用户实例，绑定：

- 用户关系
- 对象信息
- 上传材料
- 聊天记录
- 任务状态
- 可选 `pack_slug`

### 4.3 蒸馏过程

项目内的取证、解析、切片、问答、检索、报告生成和审查任务流。

### 4.4 蒸馏报告

蒸馏任务的终态资产，必须基于证据生成，包括画像、结论、建议、置信度和诚实限制。

### 4.5 人物卡与 skill

人物卡是展示层，skill 是可调用能力包。二者相关，但不能混为一谈：

- 仅安装或克隆 skill，不等于已经生成正式报告。
- 仅生成报告，不等于对象已经具备任意工具执行权。
- 同一个对象可以被多个项目引用，但对象卡片应该有唯一身份。

## 5. 技术架构

当前项目采用单仓结构：

```text
zhengliu-renlei/
  distill-human-web/
  distill-machine-agent/
    agent_runtime/
    vendor/hermes-agent/
    sql/
    tests/
  docs/
```

### 5.1 前端产品层：distill-human-web

职责：

- 项目创建
- 材料上传
- 蒸馏状态展示
- 报告查看
- 人物卡展示
- 对话界面
- 广场 / pack / clone 等消费入口

它把 agent 能力翻译为普通用户可以理解的产品流程。

### 5.2 后端控制面：distill-machine-agent

职责：

- 项目、素材、任务、报告、聊天等产品模型
- PostgreSQL 真相层
- 文档解析与 evidence fragment 切分
- 检索、rerank、上下文压缩
- LangGraph phase graph
- 报告生成与 review
- skill cache 与 Chroma 记忆
- action preflight 与 typed action
- trace / recovery / eval 骨架

后端控制面的边界是：

**负责为什么执行、对谁执行、执行后沉淀成什么产品资产。**

### 5.3 执行底座：Hermes

职责：

- agent kernel
- tool runtime
- skill runtime
- gateway
- scheduler / automation
- memory plugins
- 多后端执行环境

Hermes 的边界是：

**负责怎么执行。**

它不应该持有蒸馏对象生命周期、人物报告版本、工厂审核规则和普通用户产品权限等业务真相。

### 5.4 运行时主干

长期架构应保持八层：

```text
Observe
  -> Recall
  -> Reason
  -> Plan
  -> Policy
  -> Act
  -> Reflect
  -> Eval
```

这条主干保证系统不是一次性文本生成器，而是可观察、可恢复、可评估、可治理的 agent runtime。

## 6. 当前已经存在的能力

截至本白皮书版本，仓库里已经落地的能力包括：

- 蒸馏项目创建与任务启动
- PDF / DOCX / 图片等材料解析入口
- evidence fragment 切分
- 四阶段报告生成 graph：`planner -> extractor -> critic -> reviewer`
- 带证据引用、置信度和诚实限制的报告结构
- PostgreSQL 持久化
- Chroma 记忆同步
- 用户消息入库
- 检索 query planning
- vector + lexical recall
- reranker
- JSON 与 SSE 对话链路
- GitHub skill / pack import
- public pack catalog
- pack clone 后的项目聊天
- typed action catalog
- entitlement / target_scope / risk_pacing preflight
- trace 与 recovery event 骨架

这些能力说明项目已经不只是概念 demo，但也还没有完成通用 agent platform 的全部要求。

## 7. 当前限制

开源时必须诚实说明以下限制。

### 7.1 还不是完整 agent kernel

当前 LangGraph 主要承担蒸馏与检索阶段编排，还没有完整承接：

- session resume
- tool loop recovery
- human-in-the-loop interrupt
- checkpoint replay
- 多实例 durable workflow

### 7.2 持久化仍需增强

部分状态仍偏向单进程快照思路。后续需要转向实体级增量持久化、幂等更新和真正可恢复的 workflow state。

### 7.3 policy 仍需补全

当前 preflight 覆盖 entitlement、target scope 和 risk pacing，但还需要补齐：

- provider budget
- token cost
- compliance escalation
- tool execution rollback
- abuse prevention

### 7.4 伦理与合规不是附加功能

本项目处理人格、关系和记忆材料。隐私、授权、撤回、删除、未成年人保护、反骚扰、反冒充必须成为产品协议和系统设计的一部分。

## 8. 开源边界

本项目适合开源，但不适合把所有运行数据、密钥、个人材料和生成资产直接公开。

### 8.1 建议开源的内容

- 前端界面源码
- 后端 runtime 源码
- schema 与迁移脚本
- 本地开发说明
- 测试用例
- 示例 skill / pack
- 示例材料与合成 demo 数据
- 架构文档
- 白皮书与路线图

### 8.2 不应开源的内容

- `.env`
- API keys
- 用户上传材料
- 真实聊天记录
- 真实蒸馏报告
- Chroma / PostgreSQL 运行数据
- Hermes home 运行态数据
- 未确认授权的第三方人物材料
- 版权不清晰的生成图片、视频、音频资产

### 8.3 根仓库开源前阻塞项

开源前至少需要补齐：

- 根目录 `LICENSE`
- 根目录 `CONTRIBUTING.md`
- 根目录 `SECURITY.md`
- 根目录 `.env.example` 审查
- `.gitignore` 审查
- vendored Hermes 的 license / notice 说明
- 示例数据脱敏
- 生成资产版权审查
- README 中“私有仓库”表述更新
- 开源版与内部版能力边界说明

## 9. 伦理原则

### 9.1 同意优先

任何人格蒸馏都应优先基于本人授权材料。涉及第三方对象时，系统应提供更严格的限制和提示，避免把产品用于骚扰、控制或侵犯隐私。

### 9.2 可撤回

用户应能撤回材料、删除项目、删除报告、清理记忆和停用数字人格对象。

### 9.3 可解释

系统输出的关键判断必须能追溯证据，不能把模型猜测包装成事实。

### 9.4 不冒充

数字人格对象必须明确标注为 AI 生成代理，不得被设计成让第三方误以为真实本人正在发言。

### 9.5 不操控

关系建议不能以操控、欺骗、胁迫、骚扰为目标。系统应把高风险建议降级为草稿、拒绝或转向安全建议。

### 9.6 最小化

只收集完成蒸馏所需的材料，不把无关隐私默认纳入长期记忆。

## 10. 开放协议建议

根仓库当前需要先做 license 决策。建议按目标选择：

- 如果希望最大化商业友好与生态采用：Apache-2.0。
- 如果希望防止云服务闭源托管后不回馈社区：AGPL-3.0。
- 如果希望前后端宽松开放、核心 runtime 强 copyleft：可拆分多 license，但维护成本更高。

无论采用哪种协议，都应明确：

- 模型输出不等同于项目作者意见。
- 用户上传材料的权利归属用户或原权利人。
- 示例 pack 不代表允许蒸馏任意真实人物。
- 第三方 vendored 代码遵守其原始许可证。

## 11. 社区协作方向

开源社区可以参与的高价值方向：

- 文档解析适配器
- evidence graph
- durable workflow runtime
- retrieval benchmark
- report schema
- persona card schema
- skill pack 格式
- policy engine
- privacy tooling
- red-team 测试集
- 本地模型适配
- 多语言界面
- 可视化人物卡
- Hermes 集成层

第一阶段不建议社区把重点放在“无限自治 agent”上。项目更需要先把对象蒸馏、证据链、持久化、恢复和治理做扎实。

## 12. 路线图

### 阶段一：开源可运行

目标：

- 根 README 重写为开源入口
- 补齐 license / contributing / security
- 清理私有材料和运行数据
- 提供本地一键启动路径
- 提供合成 demo 数据
- 前后端最小链路可跑通

交付：

- 创建项目
- 上传示例材料
- 启动蒸馏
- 生成报告
- 查看人物卡
- 开始对话

### 阶段二：证据与恢复

目标：

- 实体级增量持久化
- session / turn / artifact 作为 durable workflow state
- recovery recipe 显式化
- evidence provenance 强化

交付：

- 任务中断后可恢复
- 报告结论可追溯
- 失败原因可审计
- 同一项目可重放关键流程

### 阶段三：policy 与 eval

目标：

- budget / provider / token policy
- safety escalation
- eval harness
- gold set
- regression board

交付：

- 每次蒸馏可评估质量
- 对话可评估证据使用质量
- 高风险动作有统一治理
- 成本与质量可被持续优化

### 阶段四：对象工厂

目标：

- pack submit / review / publish workflow
- GitHub skill import 规范化
- public catalog 治理
- clone / fork / remix 机制

交付：

- 专家 pack 可发布
- 用户可 clone 对象
- 社区可提交 skill
- 平台可审核与下架

### 阶段五：可执行分身

目标：

- Hermes tool runtime 深度融合
- typed action 执行闭环
- channel gateway
- scheduler
- sandbox / remote execution

交付：

- 人格对象不只会聊，还能在授权边界内执行任务
- 职业型 agent 可作为独立产品面出现
- 所有执行都有 trace、policy 和 rollback 设计

## 13. 成功标准

这个项目的成功不应只用 star 数或 demo 炫技衡量。

更可靠的标准是：

- 用户能否用自己的材料生成一份可信报告
- 报告能否明确说明证据和限制
- 人物卡是否能形成可持续使用的对象入口
- 对话是否能稳定利用蒸馏记忆
- skill 是否能从报告自然生成
- pack 是否能被 clone、复用和治理
- 高风险场景是否被系统性约束
- 运行时是否能恢复、重放和评估
- 社区是否能贡献新的蒸馏对象类型和工具适配器

## 14. 结语

“赛博永生”不是把人变成一段神秘的 prompt。

它更像一套新的数字遗产、人格工程和智能体基础设施：把人类经验变成有证据、有边界、有版本、有治理的可持续对象。

人类蒸馏计划的长期目标，是让每个人都能把自己真正有价值的部分保存下来、解释清楚、继续被使用，并在授权边界内与他人、工具和未来的 agent 生态发生连接。

这个项目选择开源，是因为数字人格不应该只由封闭平台定义。它需要透明的格式、可审计的流程、可替换的执行底座、可讨论的伦理边界，以及一个愿意长期把复杂问题讲清楚的社区。

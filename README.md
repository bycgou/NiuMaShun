# NiuMaShun (牛马顺)

**Claude Code Activity Tracker** — 用 K 线图可视化 Claude Code 对项目的每一次修改

将 Claude Code 的编辑行为映射为股票交易：每个文件是一只"股票"，行数变化就是"股价"波动，每一次编辑就是一笔"交易"。实时监控项目文件变化，以 A 股风格的 K 线图呈现开发轨迹。



## 功能特性

- **实时文件监控** — 自动监听项目目录的文件增删改，基于 chokidar + 内容哈希去重 + 语义波动检测
- **K 线图可视化** — 每个文件独立的蜡烛图，支持 6 种时间粒度（实时 / 3min / 5min / 15min / 1h / 1d）
- **A 股配色** — 红涨绿跌，符合 A 股习惯的视觉风格
- **股票列表** — 所有被编辑文件以股票行情形式展示，含涨跌幅、编辑次数、状态标签
- **Token 追踪** — 自动解析 Claude Code 日志，关联每次编辑的 Token 消耗（输入/输出/缓存读/缓存写）
- **事件合并** — 1.5 秒合并窗口，防止快速连续编辑产生噪音
- **退市生命周期** — 文件删除后标记"退市"状态，30 秒后自动清除
- **会话追踪** — 5 分钟无操作自动结束会话，关联事件到会话
- **磁盘监控** — 自动检测磁盘空间和数据库完整性

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron 31 | 跨平台桌面应用 |
| 前端 | React 18 | UI 渲染 |
| K 线图表 | lightweight-charts 4 | TradingView 开源图表库 |
| 数据库 | better-sqlite3 11 | 嵌入式 SQLite，WAL 模式 |
| 文件监听 | chokidar 4 | 跨平台文件系统监听 |
| Git 操作 | simple-git 3 | 读取 Git diff 信息 |
| 构建 | Vite 5 | 前端构建 + HMR |
| 语言 | TypeScript 5.5 | 全项目严格类型 |
| 测试 | Vitest 2 | 单元测试 |
| 打包 | electron-builder 24 | 多平台打包发布 |

## 架构

```
Electron 双进程架构

┌─────────────────────────────────────────────────────┐
│  主进程 (Node.js)                                    │
│                                                      │
│  FileWatcher ──→ EventCoalescer ──→ handleFileChange │
│       │                                    │         │
│  内容哈希去重                        DelistManager   │
│  语义波动检测                              │         │
│                                      Database        │
│  LogParser ──→ Token 关联 ──────────→ │         │
│  SessionTracker ──→ 会话管理 ────────→ │         │
│  KlineAggregator ──→ 多粒度聚合 ────→ │         │
│  DiskMonitor ──→ 磁盘/数据库健康      │         │
│                                      IPC Handlers   │
└──────────────────────────────────────┬──────────────┘
                                       │ IPC (contextBridge)
┌──────────────────────────────────────┴──────────────┐
│  渲染进程 (Chromium)                                   │
│                                                       │
│  TitleBar ── 项目选择 + 窗口控制                       │
│  TickerBar ── 选中文件的行情概览                       │
│  IntervalBar ── 时间粒度切换                           │
│  StockList ── 文件股票列表（搜索/排序/状态标签）        │
│  KlineChart ── K 线图（蜡烛图 + 成交量）              │
│  BottomPanel ── 实时活动 / Token 排行 / 今日概况       │
└───────────────────────────────────────────────────────┘
```

## 数据模型

项目使用"股票"隐喻来映射代码编辑行为：

| 股票概念 | 对应含义 |
|----------|----------|
| 股票 | 项目中的一个文件 |
| 股价 (Score) | 基准值 10000 + 行数变化 x 2 |
| IPO | 文件首次被创建 |
| 退市 | 文件被删除 |
| 涨跌 | 行数净增减 |
| 成交量 | 编辑次数 |
| 开盘/收盘 | 周期内首/末次编辑的分数 |
| 最高/最低 | 周期内分数极值 |

## 项目结构

```
NiuMaShun/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 应用入口，模块编排
│   │   ├── database.ts          # SQLite 数据层
│   │   ├── file-watcher.ts      # 文件监听 + 行级 diff + 哈希去重
│   │   ├── event-coalescer.ts   # 事件合并窗口
│   │   ├── delist-manager.ts    # 退市生命周期管理
│   │   ├── kline-aggregator.ts  # K 线多粒度聚合
│   │   ├── score-calculator.ts  # 分数计算器
│   │   ├── session-tracker.ts   # 编辑会话追踪
│   │   ├── log-parser.ts       # Claude Code 日志解析
│   │   ├── git-engine.ts       # Git diff 读取
│   │   ├── disk-monitor.ts     # 磁盘空间 + 数据库健康
│   │   └── ipc-handlers.ts     # IPC 通信处理
│   ├── renderer/               # React 渲染进程
│   │   ├── App.tsx             # 根组件
│   │   ├── main.tsx            # 入口
│   │   ├── components/         # UI 组件
│   │   │   ├── TitleBar.tsx     # 标题栏
│   │   │   ├── TickerBar.tsx    # 行情条
│   │   │   ├── IntervalBar.tsx # 粒度切换
│   │   │   ├── StockList.tsx    # 股票列表
│   │   │   ├── KlineChart.tsx   # K 线图
│   │   │   ├── FileTree.tsx     # 文件树
│   │   │   ├── BottomPanel.tsx  # 底部面板
│   │   │   ├── EventStream.tsx  # 实时活动流
│   │   │   ├── TokenRanking.tsx # Token 排行
│   │   │   ├── DailyStats.tsx   # 今日概况
│   │   │   └── StartupScreen.tsx# 启动页
│   │   ├── styles/
│   │   │   └── global.css       # 全局样式（暗色主题）
│   │   └── utils/
│   │       └── format.ts        # 格式化工具
│   ├── shared/                  # 主进程/渲染进程共享
│   │   ├── types.ts             # TypeScript 类型定义
│   │   ├── ipc-channels.ts      # IPC 通道常量
│   │   └── constants.ts         # 业务常量
│   └── preload.ts               # Electron 预加载脚本
├── tests/                       # 单元测试
│   ├── main/                    # 主进程测试
│   └── shared/                  # 共享类型测试
├── electron-builder.yml         # 打包配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置（渲染进程）
├── tsconfig.node.json           # TypeScript 配置（主进程）
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/bycgou/NiuMaShun.git
cd NiuMaShun

# 安装依赖（需要编译 better-sqlite3 原生模块）
npm install

# 开发模式（启动 Vite 开发服务器 + Electron）
npm run dev:electron

# 运行测试
npm test

# 构建并打包
npm run build
npm run package
```

### 开发模式

```bash
# 终端 1：启动 Vite 开发服务器（HMR）
npm run dev

# 终端 2：编译主进程 TypeScript 并启动 Electron
npm run dev:electron
```

## 使用方式

1. 启动应用后，点击 **选择一个 Git 项目目录**
2. 在 Claude Code 中编辑该项目文件
3. 左侧股票列表实时更新被编辑的文件
4. 点击文件名查看该文件的 K 线图
5. 切换时间粒度查看不同周期的 K 线
6. 底部面板查看实时活动、Token 排行、今日概况

## 数据库

应用使用 SQLite（WAL 模式）存储数据，数据库文件位于：

- **Windows**: `%APPDATA%/claude-code-tracker/tracker.db`
- **macOS**: `~/Library/Application Support/claude-code-tracker/tracker.db`
- **Linux**: `~/.config/claude-code-tracker/tracker.db`

数据保留期为 90 天，过期数据自动归档到 `daily_summary` 表。

## License

MIT

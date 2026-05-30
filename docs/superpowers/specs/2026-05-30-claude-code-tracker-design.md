# Claude Code Activity Tracker — 设计文档

## 概述

一个 Electron 桌面应用，用 K 线图可视化 Claude Code 对项目的每次修改。

- 添加代码 → K 线上升
- 删除代码 → K 线下降
- 创建文件 → 上市（IPO）
- 删除文件 → 退市（Delisted）
- 记录每个文件消耗的 token 数

## 技术栈

- **框架**: Electron + React + TypeScript
- **数据库**: SQLite (better-sqlite3)，WAL 模式
- **图表**: Lightweight Charts (TradingView)
- **文件监听**: chokidar
- **Git 操作**: simple-git
- **打包**: electron-builder

## 架构

```
┌─────────────────────────────────────────────────────┐
│                    Electron App                      │
│  ┌───────────────┐        ┌───────────────────────┐ │
│  │  Main Process  │  IPC   │   Renderer Process    │ │
│  │                │◄──────►│                       │ │
│  │ • GitEngine    │        │ • React UI            │ │
│  │ • FileWatcher  │        │ • Lightweight Charts  │ │
│  │ • LogParser    │        │ • Dashboard           │ │
│  │ • SessionTracker│       │                       │ │
│  │ • KlineAggregator│      │                       │ │
│  │ • ScoreCalculator│      │                       │ │
│  │ • SQLite DB    │        │                       │ │
│  └───────────────┘        └───────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Main Process 模块

| 模块 | 职责 |
|------|------|
| GitEngine | 封装 git 操作：diff、log、commit 解析 |
| FileWatcher | chokidar 监听项目目录，排除 node_modules/.git/dist 等 |
| LogParser | 解析 ~/.claude/projects/ 下的 JSONL 对话日志 |
| SessionTracker | 检测 Claude Code 活跃会话（进程检测 + 心跳判断） |
| KlineAggregator | 定时检查周期边界，固化已完成的 K 线周期 |
| ScoreCalculator | 加权累计分数计算 |
| Database | SQLite 初始化、WAL 配置、定期 checkpoint |
| StateRecovery | 启动时从 SQLite 重建内存状态 |
| DiskMonitor | 磁盘空间检测，低于阈值停止写入 |
| IpcHandlers | 处理渲染进程的 IPC 请求 |

### EventCorrelator（内嵌于主流程）

FileWatcher 和 LogParser 的联动机制：

1. FileWatcher 检测变化 → 记录事件到 SQLite events 表（带精确时间戳）
2. LogParser 扫描日志 → 提取 token 使用量
3. 用时间戳匹配：同一文件、时间差 < 30 秒的事件归为同一次操作

## 数据模型

### 加权累计分数

```
基准分 = 10,000
每添加 1 行代码 → +2 分
每删除 1 行代码 → -2 分
创建文件 → +100 分（IPO）
删除文件 → -100 分（退市）
```

Y 轴使用加权累计分数（而非纯 LOC），确保 K 线有明显的波动形态。LOC 作为辅助指标单独存储。

### SQLite Schema

```sql
PRAGMA journal_mode=WAL;

-- 项目配置
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  is_git_repo INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- K 线数据
CREATE TABLE kline (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  timestamp DATETIME NOT NULL,
  granularity TEXT NOT NULL,           -- 'event' | '3min' | '5min' | '15min' | '1h' | '1d'
  open_score REAL NOT NULL,
  close_score REAL NOT NULL,
  high_score REAL NOT NULL,
  low_score REAL NOT NULL,
  open_loc INTEGER NOT NULL,
  close_loc INTEGER NOT NULL,
  volume INTEGER DEFAULT 0,            -- 操作次数
  tokens INTEGER DEFAULT 0,            -- 该周期 token 消耗
  files_created INTEGER DEFAULT 0,
  files_deleted INTEGER DEFAULT 0,
  UNIQUE(project_id, timestamp, granularity)
);

-- 事件记录（原子数据）
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  file_path TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  file_created INTEGER DEFAULT 0,
  file_deleted INTEGER DEFAULT 0,
  score_delta REAL NOT NULL,
  tokens INTEGER DEFAULT 0,
  session_id INTEGER REFERENCES sessions(id)
);

-- 文件 token 历史
CREATE TABLE file_token_history (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  file_path TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  cumulative_tokens INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话记录
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  total_tokens INTEGER DEFAULT 0
);

-- 日级聚合（数据清理时保留）
CREATE TABLE daily_summary (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  date DATE NOT NULL,
  total_loc INTEGER,
  active_minutes INTEGER,
  total_tokens INTEGER,
  UNIQUE(project_id, date)
);
```

### 粒度映射

| UI 按钮 | DB granularity 值 | 说明 |
|---------|-------------------|------|
| 实时 | event | 每次文件变化一根 K 线 |
| 3min | 3min | 3 分钟聚合 |
| 5min | 5min | 5 分钟聚合 |
| 15min | 15min | 15 分钟聚合 |
| 1h | 1h | 1 小时聚合 |
| 1d | 1d | 1 天聚合 |

### TickerBar 指标定义

- **当前分数**：最新 close_score
- **涨跌幅**：(当前分数 - 昨日收盘分数) / 昨日收盘分数 × 100%
- **ATH (All Time High)**：历史最高 close_score
- **ATL (All Time Low)**：历史最低 close_score
- **24H Vol**：过去 24 小时的操作次数（volume 之和）

### 数据清理策略

- event 级数据保留 90 天
- 清理前先聚合为 daily_summary
- 定期执行 `PRAGMA wal_checkpoint(PASSIVE)`

## 核心工作流

### 实时数据流

```
文件变化 ──► FileWatcher 检测
              │
              ├─► GitEngine: git diff → 计算行数增删
              │     │
              │     └─► ScoreCalculator: 更新分数（+2/-2 per line, +100/-100 per file）
              │     └─► 更新当前 K 线周期的 OHLCV
              │     └─► 写入 events 表
              │
              ├─► SessionTracker: 判断 Claude 是否活跃
              │     └─► 标记当前时间段为 Claude 会话
              │
              └─► IPC 推送到渲染进程 → 实时更新图表

Claude Code 日志 ──► LogParser 定期扫描
              │
              ├─► 提取 token 使用量
              ├─► EventCorrelator: 匹配 events 表中的记录
              └─► 更新对应事件的 token 字段
```

### K 线周期管理

- 应用启动 → 启动 KlineAggregator 定时器（每分钟检查）
- 检查当前时间是否跨越周期边界
- 跨越边界 → 固化上一个周期的 K 线，开始新周期
- event 粒度：每次变化立即生成一根新 K 线

### 状态恢复（启动时）

1. 读取 projects 表 → 恢复项目列表
2. 对每个项目：
   - 读取最新 kline 记录 → 恢复 currentScore
   - 读取最近 events → 恢复未完成的周期
   - 未固化的周期 → 立即固化并开始新周期
3. 重新启动 FileWatcher + SessionTracker
4. 系统休眠/唤醒后 → 全量扫描补偿

### 模式切换

- event 数据是原子数据，聚合视图从 event 数据派生
- 切换视图 = 查询不同粒度的 kline 表
- 从 event 切到 5min：查 kline WHERE granularity='5min'，数据不足时从 events 聚合生成
- 切回 event：直接查 kline WHERE granularity='event'

## SessionTracker

检测 Claude Code 是否在运行：

1. **进程检测**：检测 `claude` 进程是否在运行
2. **心跳判断**：有文件变更 = 会话中，超过 5 分钟无变更 = 会话结束

K 线图上用半透明色块标记活跃区间（绿色 = Claude 会话中）。

## 错误处理与边界情况

### Git 操作

- 项目初始化时一次性检测 `git rev-parse --is-inside-work-tree`，结果缓存
- git 命令失败 → 记录错误日志，不中断监听
- 非 git 仓库 → 标记 is_git_repo=0，跳过 git 相关功能

### 文件过滤

**排除目录**（可配置）：
```
node_modules, .git, dist, build, out, .next, __pycache__
```

**二进制文件检测**（组合判断）：
1. 扩展名黑名单：.db, .sqlite, .png, .jpg, .zip, .pdf 等
2. MIME type 检测：非 text/ 开头的跳过
3. 大小阈值：> 1MB 跳过 diff

**符号链接**：chokidar follow_links=False，UI 提示软链接项目

### SQLite

- WAL 模式 + 每日 `PRAGMA wal_checkpoint(PASSIVE)`
- 并发写入安全
- 数据库损坏 → 自动备份 + 重建

### 系统事件

- 系统休眠/唤醒 → 唤醒后全量扫描补偿
- 时间戳统一 UTC，展示转本地时区
- 磁盘空间检测，低于阈值停止写入并提示用户

### Claude Code 日志

- 优先检测 `schema_version` 字段，回退到格式指纹匹配
- 日志文件被删除/移动 → 跳过，不影响其他功能
- 多实例 → 按项目目录 + PID 区分

## UI 组件树

```
App
├── TitleBar                          // 自定义标题栏（无边框窗口）
│   ├── Logo + 品牌名
│   ├── ProjectSelector               // 项目切换下拉 + 添加按钮
│   └── WindowControls                // 最小化 / 最大化 / 关闭
│
├── TickerBar                         // 行情头部
│   ├── PriceDisplay                  //   当前分数 + 实时变动
│   ├── ChangeIndicator               //   涨跌幅 + 颜色（绿涨红跌）
│   ├── MarketStats                   //   24H Vol / ATH / ATL / 活跃文件数
│   └── ConnectionStatus              //   监听状态指示灯
│
├── IntervalBar                       // K线粒度切换条
│   ├── IntervalButton × 6            //   [实时] [3min] [5min] [15min] [1h] [1d]
│   └── SessionToggle                 //   会话色块开关
│
├── MainLayout                        // 主体内容
│   ├── FileTree (22%)                // 左侧：文件树
│   │   ├── SearchBar                 //   文件搜索框
│   │   ├── TreeRoot                  //   根目录
│   │   │   ├── TreeNode (dir)        //     可折叠目录
│   │   │   └── TreeNode (file)       //     文件行
│   │   │       ├── FileIcon          //       文件类型图标
│   │   │       ├── FileName          //       文件名
│   │   │       ├── TokenBadge        //       token 消耗标签
│   │   │       └── StatusBadge       //       状态标记
│   │   │           ├── active        //       无特殊标记
│   │   │           ├── ipo           //       绿色 "IPO"
│   │   │           ├── delisted      //       红色 "退市"
│   │   │           └── hot           //       黄色 "🔥"
│   │   └── FileTreeFooter            //   文件数统计
│   │
│   └── ChartArea (78%)               // 右侧：图表区
│       ├── KlineChart                //   K线图
│       │   ├── CandlestickSeries     //     蜡烛图
│       │   ├── VolumeSeries          //     成交量柱
│       │   ├── MASeries (可选)        //     均线
│       │   └── CrosshairTooltip      //     十字光标浮窗
│       ├── SessionOverlay            //   会话色块叠加
│       └── FileFocusBar              //   文件聚焦模式提示条
│
├── BottomPanel                       // 底部面板（Tab 切换）
│   ├── TabBar                        //   [实时活动] [Token 排行] [今日概况]
│   └── TabContent
│       ├── EventStream               //     实时事件流
│       ├── TokenRanking              //     Token 消耗排行 Top 5
│       └── DailyStats                //     今日统计卡片
│
├── StartupScreen                     // 启动引导（无项目时显示）
│   ├── Logo + 项目名 + Slogan
│   ├── [选择项目目录] 按钮
│   └── RecentProjects
│
└── CrosshairTooltip                  // K线图十字光标浮窗
```

### StatusBadge 说明

| 状态 | 样式 | 含义 |
|------|------|------|
| active | 默认 | 正常文件 |
| ipo | 绿色 badge "IPO" | 本次会话新创建的文件 |
| delisted | 红色 badge "退市" | 本次会话删除的文件 |
| hot | 黄色 badge "🔥" | 高频变更文件（短时间内多次修改） |

## 项目结构

```
claude-code-tracker/
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── .gitignore
│
├── src/
│   ├── main/                          # 主进程
│   │   ├── index.ts                   #   入口，创建窗口
│   │   ├── git-engine.ts              #   Git 操作封装
│   │   ├── file-watcher.ts            #   文件监听
│   │   ├── log-parser.ts              #   Claude Code 日志解析
│   │   ├── session-tracker.ts         #   会话检测
│   │   ├── kline-aggregator.ts        #   K 线周期聚合
│   │   ├── score-calculator.ts        #   加权分数计算
│   │   ├── database.ts                #   SQLite 初始化 + WAL
│   │   ├── state-recovery.ts          #   启动状态恢复
│   │   ├── disk-monitor.ts            #   磁盘空间检测
│   │   └── ipc-handlers.ts            #   IPC 消息处理
│   │
│   ├── renderer/                      # 渲染进程
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TitleBar.tsx
│   │   │   ├── TickerBar.tsx
│   │   │   ├── IntervalBar.tsx
│   │   │   ├── FileTree.tsx
│   │   │   ├── KlineChart.tsx
│   │   │   ├── SessionOverlay.tsx
│   │   │   ├── BottomPanel.tsx
│   │   │   ├── EventStream.tsx
│   │   │   ├── TokenRanking.tsx
│   │   │   ├── DailyStats.tsx
│   │   │   └── StartupScreen.tsx
│   │   ├── hooks/
│   │   │   ├── useKlineData.ts
│   │   │   ├── useFileTree.ts
│   │   │   └── useProject.ts
│   │   └── styles/
│   │       └── global.css
│   │
│   ├── shared/                        # 共享代码
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── ipc-channels.ts
│   │
│   └── preload.ts
│
├── resources/
│   └── icon.png
│
└── docs/
    └── superpowers/specs/
```

## 关键依赖

| 包名 | 用途 |
|------|------|
| electron | 桌面框架 |
| better-sqlite3 | SQLite 数据库 |
| chokidar | 文件监听 |
| lightweight-charts | K 线图渲染 |
| react + react-dom | UI 框架 |
| simple-git | Git 操作 |
| electron-builder | 打包 |

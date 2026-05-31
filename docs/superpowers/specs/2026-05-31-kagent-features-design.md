# KAgent 特性移植设计文档

## 概述

从 KAgent 项目移植 4 个核心功能到 Claude Code Activity Tracker：

1. **内容哈希去重** - 防止「保存但内容没变」产生的虚假事件
2. **语义波动检测** - 内容改变但行数不变时仍记录变化
3. **合并窗口 (Coalescing)** - 防止快速连续编辑产生的噪音
4. **退市生命周期** - 文件删除后优雅地显示「退市」状态

## 实现方案

采用**渐进式实现**（方案 A），按依赖关系分层：

```
第 1 层：内容哈希去重（基础设施）
  ↓
第 2 层：语义波动检测（依赖内容比较）
  ↓
第 3 层：合并窗口（依赖哈希去重）
  ↓
第 4 层：退市生命周期（独立功能）
```

## 第 1 层：内容哈希去重

**目的**：防止「保存但内容没变」产生的虚假事件

**实现位置**：`src/main/file-watcher.ts`

**核心逻辑**：
- 在 `FileWatcher` 中添加 `contentHashes: Map<string, number>` 缓存
- 使用 Java 风格哈希函数：`Math.imul(31, h) + charCode`
- 在 `createEvent` 中检查：如果哈希相同，返回 `null` 跳过事件

**影响范围**：仅修改 `file-watcher.ts`，不影响其他模块

## 第 2 层：语义波动检测

**目的**：当文件内容改变但行数不变时，仍然记录变化

**实现位置**：`src/main/file-watcher.ts`

**核心逻辑**：
- 增强 `calculateLineDiff` 方法，新增 `changed` 字段
- 统计实际变化的行数（逐行比较）
- 如果 `added === 0 && removed === 0 && changed > 0`，则 `linesAdded = changed, linesDeleted = changed`

**效果**：行数不变的编辑也会在 K 线图上显示波动（上下影线）

## 第 3 层：合并窗口 (Coalescing)

**目的**：防止快速连续编辑产生的噪音

**实现位置**：新建 `src/main/event-coalescer.ts`

**核心逻辑**：
- 新建独立的 `EventCoalescer` 类
- 维护 `pendingEvents: Map<string, PendingEvent>`
- 1500ms 窗口内的同一文件事件会被合并
- 合并逻辑：累加 `linesAdded` 和 `linesDeleted`，使用最新时间戳

**使用方式**：在 `index.ts` 的 `handleFileChange` 中使用：
```typescript
const coalescer = new EventCoalescer();
fileWatcher = new FileWatcher(projectPath, (event) => {
  coalescer.process(event, (mergedEvent) => {
    handleFileChange(mergedEvent, projectId);
  });
});
```

## 第 4 层：退市生命周期

**目的**：文件删除后优雅地显示「退市」状态

**实现位置**：新建 `src/main/delist-manager.ts`

**核心逻辑**：
- 新建独立的 `DelistManager` 类
- 维护 `delistedFiles: Map<string, DelistState>`
- 文件删除时 → `markDelisted(filePath)`，设置 30 秒定时器
- 文件创建时 → `cancelDelist(filePath)`，取消退市
- 30 秒后自动清除退市状态

**集成方式**：
- 文件删除事件 → `delistManager.markDelisted()`
- 文件创建事件 → `delistManager.cancelDelist()`
- 获取股票列表时 → 包含退市状态的文件

## 数据流

```
文件变化
  ↓
FileWatcher (含哈希去重 + 语义波动)
  ↓
EventCoalescer (合并窗口)
  ↓
DelistManager (退市状态)
  ↓
Database (存储事件 + K 线)
  ↓
Renderer (显示图表)
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/file-watcher.ts` | 修改 | 添加哈希去重 + 语义波动检测 |
| `src/main/event-coalescer.ts` | 新建 | 合并窗口逻辑 |
| `src/main/delist-manager.ts` | 新建 | 退市生命周期管理 |
| `src/main/index.ts` | 修改 | 集成新模块 |
| `src/main/database.ts` | 修改 | 获取股票列表时包含退市文件 |
| `src/renderer/components/StockList.tsx` | 修改 | 显示退市状态样式 |

## 测试策略

1. **单元测试**：
   - `event-coalescer.test.ts` - 测试合并逻辑
   - `delist-manager.test.ts` - 测试退市状态管理

2. **集成测试**：
   - 快速连续编辑 → 验证合并
   - 内容不变的保存 → 验证去重
   - 文件删除/创建 → 验证退市状态

## 依赖关系

```
contentHashes (file-watcher.ts)
    ↓
semanticVolatility (file-watcher.ts)
    ↓
EventCoalescer (event-coalescer.ts)
    ↓
DelistManager (delist-manager.ts) - 独立，无依赖
```

// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import Database from './database';
import FileWatcher, { FileChangeEvent } from './file-watcher';
import SessionTracker from './session-tracker';
import KlineAggregator from './kline-aggregator';
import LogParser from './log-parser';
import DiskMonitor from './disk-monitor';
import IpcHandlers from './ipc-handlers';
import EventCoalescer from './event-coalescer';
import DelistManager from './delist-manager';
import { AGGREGATOR_CHECK_INTERVAL_MS, LOG_SCAN_INTERVAL_MS, SCORE_BASE, SCORE_PER_LINE, SCORE_PER_FILE_CREATE, SCORE_PER_FILE_DELETE } from '../shared/constants';
import { createPetWindow, destroyPetWindow } from './pet/pet-window';
import { startPetServer } from './pet/pet-server';

let mainWindow: BrowserWindow | null = null;
let db: Database;
let fileWatcher: FileWatcher | null = null;
let sessionTracker: SessionTracker | null = null;
let ipcHandlers: IpcHandlers;

// 每个文件独立的状态追踪
interface FileState {
  currentLines: number;  // 当前行数
  openLines: number;     // IPO 时的行数（第一次被编辑时）
  score: number;         // 当前分数（基于行数变化）
  highScore: number;
  lowScore: number;
}

const projectStates = new Map<number, {
  aggregator: KlineAggregator;
  fileStates: Map<string, FileState>;  // filePath -> FileState
  projectPath: string;
  coalescer: EventCoalescer;
  delistManager: DelistManager;
  logScanInterval: ReturnType<typeof setInterval> | null;
}>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startMonitoring(projectPath: string, projectId: number): Promise<void> {
  // Stop previous watchers if any
  if (fileWatcher) {
    fileWatcher.stop();
    fileWatcher = null;
  }
  if (sessionTracker) {
    sessionTracker.stop();
    sessionTracker = null;
  }

  // Clean up all old project states (clear intervals and data)
  for (const [, state] of projectStates) {
    if (state.logScanInterval) clearInterval(state.logScanInterval);
  }
  projectStates.clear();

  const aggregator = new KlineAggregator();
  const fileStates = new Map<string, FileState>();
  const coalescer = new EventCoalescer();
  const delistManager = new DelistManager();

  // Start file watcher with coalescer
  fileWatcher = new FileWatcher(projectPath, (event: FileChangeEvent) => {
    coalescer.process(event, (mergedEvent) => {
      // Handle delist lifecycle
      if (mergedEvent.type === 'unlink') {
        delistManager.markDelisted(mergedEvent.filePath, () => notifyRenderer(projectId));
      } else if (mergedEvent.type === 'add') {
        delistManager.cancelDelist(mergedEvent.filePath);
      }
      handleFileChange(mergedEvent, projectId);
    });
  });
  fileWatcher.start();

  // Start session tracker
  sessionTracker = new SessionTracker(projectPath);
  sessionTracker.setCallbacks(
    () => {
      // Session start: insert a new session record and set its ID
      const result = db.prepare(
        'INSERT INTO sessions (project_id, started_at) VALUES (?, ?)'
      ).run(projectId, new Date().toISOString());
      sessionTracker?.setSessionId(Number(result.lastInsertRowid));
    },
    () => {
      // Session end: update the session record
      const sessionId = sessionTracker?.currentSessionId;
      if (sessionId) {
        db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
      }
    }
  );
  sessionTracker.onFileChange();

  // Start log parser
  const logParser = new LogParser();
  const logScanInterval = setInterval(async () => {
    const usages = await logParser.scanForTokenUsage(projectPath);
    const events = db.getRecentEvents(projectId, 100);
    const correlations = logParser.correlateWithEvents(usages, events.map(e => ({
      filePath: e.filePath,
      timestamp: e.timestamp,
      id: e.id,
    })));
    for (const [eventId, tokenUsage] of correlations) {
      db.prepare(`
        UPDATE events SET
          tokens = ?,
          input_tokens = ?,
          output_tokens = ?,
          cache_read_tokens = ?,
          cache_creation_tokens = ?
        WHERE id = ?
      `).run(
        tokenUsage.totalTokens,
        tokenUsage.inputTokens,
        tokenUsage.outputTokens,
        tokenUsage.cacheReadTokens,
        tokenUsage.cacheCreationTokens,
        eventId
      );
    }
  }, LOG_SCAN_INTERVAL_MS);

  projectStates.set(projectId, { aggregator, fileStates, projectPath, coalescer, delistManager, logScanInterval });

  // 通知渲染器更新文件列表
  notifyRenderer(projectId);
}

function getFileState(projectId: number, filePath: string): FileState {
  const state = projectStates.get(projectId);
  if (!state) return { currentLines: 0, openLines: 0, score: SCORE_BASE, highScore: SCORE_BASE, lowScore: SCORE_BASE };

  let fileState = state.fileStates.get(filePath);
  if (!fileState) {
    // 从数据库恢复状态
    const klines = db.getFileKlines(projectId, filePath, 'event', 1);
    if (klines.length > 0) {
      const lastKline = klines[0];
      fileState = {
        currentLines: lastKline.closeLoc,
        openLines: lastKline.openLoc,
        score: lastKline.closeScore,
        highScore: lastKline.highScore,
        lowScore: lastKline.lowScore,
      };
    } else {
      fileState = { currentLines: 0, openLines: 0, score: SCORE_BASE, highScore: SCORE_BASE, lowScore: SCORE_BASE };
    }
    state.fileStates.set(filePath, fileState);
  }
  return fileState;
}

async function handleFileChange(event: FileChangeEvent, projectId: number): Promise<void> {
  const state = projectStates.get(projectId);
  if (!state) return;

  sessionTracker?.onFileChange();

  const isCreate = event.type === 'add';
  const isDelete = event.type === 'unlink';
  const linesAdded = event.linesAdded;
  const linesDeleted = event.linesDeleted;

  // 获取或创建文件状态
  const fileState = getFileState(projectId, event.filePath);
  const prevScore = fileState.score;
  const prevLines = fileState.currentLines;

  // 计算分数变化（在更新状态之前）
  let scoreDelta: number;
  if (isCreate) {
    scoreDelta = linesAdded * SCORE_PER_LINE + SCORE_PER_FILE_CREATE;
  } else if (isDelete) {
    scoreDelta = -(fileState.currentLines) * SCORE_PER_LINE + SCORE_PER_FILE_DELETE;
  } else {
    scoreDelta = linesAdded * SCORE_PER_LINE - linesDeleted * SCORE_PER_LINE;
  }

  // 更新文件状态
  if (isCreate) {
    fileState.openLines = linesAdded;
    fileState.currentLines = linesAdded;
    fileState.score = SCORE_BASE + scoreDelta;
  } else if (isDelete) {
    fileState.score = SCORE_BASE - fileState.currentLines * SCORE_PER_LINE + SCORE_PER_FILE_DELETE;
    fileState.currentLines = 0;
  } else {
    fileState.currentLines += linesAdded - linesDeleted;
    fileState.score += scoreDelta;
  }

  // 更新高低分
  if (fileState.score > fileState.highScore) fileState.highScore = fileState.score;
  if (fileState.score < fileState.lowScore) fileState.lowScore = fileState.score;

  state.fileStates.set(event.filePath, fileState);

  // 插入事件
  db.insertEvent({
    projectId,
    filePath: event.filePath,
    timestamp: event.timestamp,
    linesAdded,
    linesDeleted,
    fileCreated: isCreate,
    fileDeleted: isDelete,
    scoreDelta,
    tokens: 0,
    sessionId: sessionTracker?.currentSessionId || null,
  });

  // 更新该文件的所有 K 线粒度
  const granularities = ['event', '3min', '5min', '15min', '1h', '1d'] as const;
  for (const granularity of granularities) {
    const periodStart = granularity === 'event'
      ? event.timestamp
      : state.aggregator.getPeriodStart(granularity);

    db.upsertKline({
      projectId,
      filePath: event.filePath,
      timestamp: periodStart,
      granularity,
      openScore: prevScore,
      closeScore: fileState.score,
      highScore: fileState.highScore,
      lowScore: fileState.lowScore,
      openLoc: prevLines,
      closeLoc: fileState.currentLines,
      volume: 1,
      tokens: 0,
      linesAdded,
      linesDeleted,
    });
  }

  // 通知渲染器
  notifyRenderer(projectId);
}

function notifyRenderer(projectId: number): void {
  if (!mainWindow) return;

  // 发送文件股票列表
  const stocks = db.getFileStocks(projectId);
  ipcHandlers.sendToRenderer('stocks:update', stocks);

  // 发送最新事件
  const latestEvent = db.getRecentEvents(projectId, 1)[0];
  if (latestEvent) {
    ipcHandlers.sendToRenderer('event:new', latestEvent);
  }
}

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'tracker.db');
  db = new Database(dbPath);

  const diskMonitor = new DiskMonitor(dbPath);
  const { safe } = await diskMonitor.checkDiskSpace();
  if (!safe) {
    console.error('Low disk space, stopping writes');
  }

  createWindow();
  ipcHandlers = new IpcHandlers(db, mainWindow!);

  ipcHandlers.setOnProjectAdded(async (id, projectPath) => {
    await startMonitoring(projectPath, id);
  });

  // 切换项目时开始监控
  ipcHandlers.setOnProjectSwitched(async (id) => {
    const project = db.getProject(id);
    if (project) {
      await startMonitoring(project.path, id);
    }
  });

  // Auto-start monitoring for the last active project
  const projects = db.getProjects();
  if (projects.length > 0) {
    await startMonitoring(projects[0].path, projects[0].id);
  }

  // 初始化宠物系统
  try {
    const petWin = createPetWindow(db);
    const petPort = await startPetServer();
    console.log(`Pet server started on port ${petPort}`);
  } catch (err) {
    console.error('Failed to start pet system:', err);
  }
});

app.on('window-all-closed', () => {
  fileWatcher?.stop();
  sessionTracker?.stop();
  destroyPetWindow();
  db.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

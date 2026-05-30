// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import Database from './database';
import GitEngine from './git-engine';
import FileWatcher, { FileChangeEvent } from './file-watcher';
import SessionTracker from './session-tracker';
import KlineAggregator from './kline-aggregator';
import ScoreCalculator from './score-calculator';
import LogParser from './log-parser';
import DiskMonitor from './disk-monitor';
import StateRecovery from './state-recovery';
import IpcHandlers from './ipc-handlers';
import { AGGREGATOR_CHECK_INTERVAL_MS, LOG_SCAN_INTERVAL_MS } from '../shared/constants';

let mainWindow: BrowserWindow | null = null;
let db: Database;
let fileWatcher: FileWatcher | null = null;
let sessionTracker: SessionTracker | null = null;
let ipcHandlers: IpcHandlers;

const projectStates = new Map<number, {
  score: ScoreCalculator;
  gitEngine: GitEngine;
  aggregator: KlineAggregator;
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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startMonitoring(projectPath: string, projectId: number): Promise<void> {
  const gitEngine = new GitEngine(projectPath);
  const isRepo = await gitEngine.isGitRepo();

  if (!isRepo) {
    db.prepare('UPDATE projects SET is_git_repo = 0 WHERE id = ?').run(projectId);
  }

  const stateRecovery = new StateRecovery(db);
  const recovered = stateRecovery.recoverAllProjects();
  const projectState = recovered.find(p => p.projectId === projectId);

  const score = projectState?.score || new ScoreCalculator();
  const aggregator = projectState?.aggregator || new KlineAggregator();

  projectStates.set(projectId, { score, gitEngine, aggregator });

  // Start file watcher
  fileWatcher = new FileWatcher(projectPath, async (event: FileChangeEvent) => {
    await handleFileChange(event, projectId);
  });
  fileWatcher.start();

  // Start session tracker
  sessionTracker = new SessionTracker(projectPath);
  sessionTracker.onFileChange();

  // Start aggregator timer
  setInterval(() => {
    // Periodic aggregation happens automatically on events
  }, AGGREGATOR_CHECK_INTERVAL_MS);

  // Start log parser
  const logParser = new LogParser();
  setInterval(async () => {
    const usages = await logParser.scanForTokenUsage(projectPath);
    // Correlate with recent events
    const events = db.getRecentEvents(projectId, 100);
    const correlations = logParser.correlateWithEvents(usages, events.map(e => ({
      filePath: e.filePath,
      timestamp: e.timestamp,
      id: e.id,
    })));
    for (const [eventId, tokens] of correlations) {
      // Update event tokens
      db.prepare('UPDATE events SET tokens = ? WHERE id = ?').run(tokens, eventId);
    }
  }, LOG_SCAN_INTERVAL_MS);
}

async function handleFileChange(event: FileChangeEvent, projectId: number): Promise<void> {
  const state = projectStates.get(projectId);
  if (!state) return;

  sessionTracker?.onFileChange();

  const isCreate = event.type === 'add';
  const isDelete = event.type === 'unlink';
  let linesAdded = 0;
  let linesDeleted = 0;

  if (!isCreate && !isDelete && event.type === 'change') {
    const diff = await state.gitEngine.getDiffForFile(event.filePath);
    linesAdded = diff.added;
    linesDeleted = diff.removed;
  }

  const scoreDelta = state.score.apply(linesAdded, linesDeleted, isCreate, isDelete);

  // Insert event
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

  // Update all K-line granularities
  const granularities = ['event', '3min', '5min', '15min', '1h', '1d'] as const;
  for (const granularity of granularities) {
    const periodStart = granularity === 'event'
      ? event.timestamp
      : state.aggregator.getPeriodStart(granularity);

    db.upsertKline({
      projectId,
      timestamp: periodStart,
      granularity,
      openScore: state.score.currentScore - scoreDelta,
      closeScore: state.score.currentScore,
      highScore: state.score.highScore,
      lowScore: state.score.lowScore,
      openLoc: state.score.currentLoc - (linesAdded - linesDeleted),
      closeLoc: state.score.currentLoc,
      volume: 1,
      tokens: 0,
      filesCreated: isCreate ? 1 : 0,
      filesDeleted: isDelete ? 1 : 0,
    });
  }

  // Send updates to renderer
  if (mainWindow) {
    ipcHandlers.sendToRenderer('kline:update', db.getKlines(projectId, ipcHandlers.getCurrentGranularity()));
    ipcHandlers.sendToRenderer('ticker:update', db.getTickerData(projectId));
    ipcHandlers.sendToRenderer('event:new', db.getRecentEvents(projectId, 1)[0]);
  }
}

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'tracker.db');
  db = new Database(dbPath);

  // Disk space check
  const diskMonitor = new DiskMonitor(dbPath);
  const { safe } = await diskMonitor.checkDiskSpace();
  if (!safe) {
    console.error('Low disk space, stopping writes');
  }

  createWindow();
  ipcHandlers = new IpcHandlers(db, mainWindow!);

  // Auto-start monitoring for the last active project
  const projects = db.getProjects();
  if (projects.length > 0) {
    await startMonitoring(projects[0].path, projects[0].id);
  }
});

app.on('window-all-closed', () => {
  fileWatcher?.stop();
  sessionTracker?.stop();
  db.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

import BetterSqlite3 from 'better-sqlite3';
import { KlineData, EventRecord, FileStock, Granularity } from '../shared/types';

interface KlineRow {
  id: number;
  project_id: number;
  file_path: string;
  timestamp: string;
  granularity: string;
  open_score: number;
  close_score: number;
  high_score: number;
  low_score: number;
  open_loc: number;
  close_loc: number;
  volume: number;
  tokens: number;
  lines_added: number;
  lines_deleted: number;
}

interface EventRow {
  id: number;
  project_id: number;
  file_path: string;
  timestamp: string;
  lines_added: number;
  lines_deleted: number;
  file_created: number;
  file_deleted: number;
  score_delta: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  session_id: number | null;
}

export default class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        is_git_repo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 每个文件独立的 K 线数据
      CREATE TABLE IF NOT EXISTS kline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        file_path TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        granularity TEXT NOT NULL,
        open_score REAL NOT NULL,
        close_score REAL NOT NULL,
        high_score REAL NOT NULL,
        low_score REAL NOT NULL,
        open_loc INTEGER NOT NULL,
        close_loc INTEGER NOT NULL,
        volume INTEGER DEFAULT 0,
        tokens INTEGER DEFAULT 0,
        lines_added INTEGER DEFAULT 0,
        lines_deleted INTEGER DEFAULT 0,
        UNIQUE(project_id, file_path, timestamp, granularity)
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        file_path TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        lines_added INTEGER DEFAULT 0,
        lines_deleted INTEGER DEFAULT 0,
        file_created INTEGER DEFAULT 0,
        file_deleted INTEGER DEFAULT 0,
        score_delta REAL NOT NULL,
        tokens INTEGER DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_creation_tokens INTEGER DEFAULT 0,
        session_id INTEGER REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS file_token_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        file_path TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_creation_tokens INTEGER DEFAULT 0,
        cumulative_tokens INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        started_at DATETIME NOT NULL,
        ended_at DATETIME,
        total_tokens INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS daily_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        date DATE NOT NULL,
        total_loc INTEGER,
        active_minutes INTEGER,
        total_tokens INTEGER,
        UNIQUE(project_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_events_project_file_ts ON events(project_id, file_path, timestamp);
      CREATE INDEX IF NOT EXISTS idx_kline_project_file_gran_ts ON kline(project_id, file_path, granularity, timestamp);
    `);
  }

  prepare(sql: string): BetterSqlite3.Statement {
    return this.db.prepare(sql);
  }

  pragma(pragma: string, options?: { simple?: boolean }): any {
    return this.db.pragma(pragma, options);
  }

  close(): void {
    this.db.close();
  }

  // --- Project operations ---

  addProject(name: string, projectPath: string): number {
    const stmt = this.db.prepare(
      'INSERT INTO projects (name, path) VALUES (?, ?)'
    );
    const result = stmt.run(name, projectPath);
    return Number(result.lastInsertRowid);
  }

  getProject(id: number): { id: number; name: string; path: string; isGitRepo: number; createdAt: string } | undefined {
    return this.db.prepare(
      'SELECT id, name, path, is_git_repo as isGitRepo, created_at as createdAt FROM projects WHERE id = ?'
    ).get(id) as any;
  }

  getProjects(): { id: number; name: string; path: string; isGitRepo: number; createdAt: string }[] {
    return this.db.prepare(
      'SELECT id, name, path, is_git_repo as isGitRepo, created_at as createdAt FROM projects ORDER BY created_at DESC'
    ).all() as any[];
  }

  removeProject(id: number): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // --- Kline operations (per-file) ---

  upsertKline(data: {
    projectId: number;
    filePath: string;
    timestamp: string;
    granularity: Granularity;
    openScore: number;
    closeScore: number;
    highScore: number;
    lowScore: number;
    openLoc: number;
    closeLoc: number;
    volume: number;
    tokens: number;
    linesAdded: number;
    linesDeleted: number;
  }): void {
    this.db.prepare(`
      INSERT INTO kline (project_id, file_path, timestamp, granularity, open_score, close_score, high_score, low_score, open_loc, close_loc, volume, tokens, lines_added, lines_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, file_path, timestamp, granularity) DO UPDATE SET
        close_score = excluded.close_score,
        high_score = MAX(kline.high_score, excluded.high_score),
        low_score = MIN(kline.low_score, excluded.low_score),
        close_loc = excluded.close_loc,
        volume = kline.volume + excluded.volume,
        tokens = kline.tokens + excluded.tokens,
        lines_added = kline.lines_added + excluded.lines_added,
        lines_deleted = kline.lines_deleted + excluded.lines_deleted
    `).run(
      data.projectId, data.filePath, data.timestamp, data.granularity,
      data.openScore, data.closeScore, data.highScore, data.lowScore,
      data.openLoc, data.closeLoc, data.volume, data.tokens,
      data.linesAdded, data.linesDeleted
    );
  }

  // 获取某个文件的 K 线数据
  getFileKlines(projectId: number, filePath: string, granularity: Granularity, limit = 500): KlineData[] {
    const rows = this.db.prepare(
      'SELECT * FROM kline WHERE project_id = ? AND file_path = ? AND granularity = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(projectId, filePath, granularity, limit) as KlineRow[];
    return rows.map(this.rowToKline);
  }

  // 获取所有文件的股票列表
  getFileStocks(projectId: number): FileStock[] {
    // 获取每个文件的最新 K 线数据和统计信息
    const rows = this.db.prepare(`
      WITH file_stats AS (
        SELECT
          file_path,
          COUNT(*) as edit_count,
          SUM(lines_added) as total_added,
          SUM(lines_deleted) as total_deleted,
          SUM(tokens) as total_tokens,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(cache_read_tokens) as total_cache_read_tokens,
          SUM(cache_creation_tokens) as total_cache_creation_tokens,
          MAX(timestamp) as last_edit_time
        FROM events
        WHERE project_id = ?
        GROUP BY file_path
      ),
      latest_kline AS (
        SELECT DISTINCT
          file_path,
          FIRST_VALUE(close_loc) OVER (PARTITION BY file_path ORDER BY timestamp DESC) as current_lines,
          FIRST_VALUE(open_loc) OVER (PARTITION BY file_path ORDER BY timestamp ASC) as open_lines
        FROM kline
        WHERE project_id = ? AND granularity = 'event'
      )
      SELECT
        e.file_path as filePath,
        e.edit_count as editCount,
        e.total_added as totalAdded,
        e.total_deleted as totalDeleted,
        e.last_edit_time as lastEditTime,
        e.total_tokens as totalTokens,
        e.total_input_tokens as totalInputTokens,
        e.total_output_tokens as totalOutputTokens,
        e.total_cache_read_tokens as totalCacheReadTokens,
        e.total_cache_creation_tokens as totalCacheCreationTokens,
        COALESCE(k.current_lines, 0) as currentLines,
        COALESCE(k.open_lines, 0) as openLines
      FROM file_stats e
      LEFT JOIN latest_kline k ON e.file_path = k.file_path
      ORDER BY e.last_edit_time DESC
    `).all(projectId, projectId) as any[];

    return rows.map(row => {
      const currentLines = row.currentLines || 0;
      const openLines = row.openLines || 0;
      const changeAbsolute = currentLines - openLines;
      const changePercent = openLines > 0 ? (changeAbsolute / openLines) * 100 : 0;

      // 判断状态
      let status: 'active' | 'ipo' | 'delisted' | 'hot' = 'active';
      const recentEvents = this.db.prepare(
        "SELECT COUNT(*) as cnt FROM events WHERE project_id = ? AND file_path = ? AND timestamp > datetime('now', '-5 minutes')"
      ).get(projectId, row.filePath) as { cnt: number };

      if (row.editCount <= 1) status = 'ipo';
      if (recentEvents.cnt >= 5) status = 'hot';

      // 检查文件是否还存在（需要在主进程中检查）
      const lastEvent = this.db.prepare(
        "SELECT file_deleted FROM events WHERE project_id = ? AND file_path = ? ORDER BY timestamp DESC LIMIT 1"
      ).get(projectId, row.filePath) as { file_deleted: number } | undefined;

      if (lastEvent?.file_deleted) status = 'delisted';

      return {
        filePath: row.filePath,
        fileName: row.filePath.split('/').pop() || row.filePath,
        currentLines,
        openLines,
        changePercent,
        changeAbsolute,
        editCount: row.editCount,
        status,
        lastEditTime: row.lastEditTime,
        tokens: row.totalTokens || 0,
        inputTokens: row.totalInputTokens || 0,
        outputTokens: row.totalOutputTokens || 0,
        cacheReadTokens: row.totalCacheReadTokens || 0,
        cacheCreationTokens: row.totalCacheCreationTokens || 0,
      };
    });
  }

  // 获取单个文件的股票信息
  getFileStock(projectId: number, filePath: string): FileStock | null {
    const stocks = this.getFileStocks(projectId);
    return stocks.find(s => s.filePath === filePath) || null;
  }

  private rowToKline(row: KlineRow): KlineData {
    return {
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      timestamp: row.timestamp,
      granularity: row.granularity as Granularity,
      openScore: row.open_score,
      closeScore: row.close_score,
      highScore: row.high_score,
      lowScore: row.low_score,
      openLoc: row.open_loc,
      closeLoc: row.close_loc,
      volume: row.volume,
      tokens: row.tokens,
      linesAdded: row.lines_added,
      linesDeleted: row.lines_deleted,
    };
  }

  // --- Event operations ---

  insertEvent(data: {
    projectId: number;
    filePath: string;
    timestamp: string;
    linesAdded: number;
    linesDeleted: number;
    fileCreated: boolean;
    fileDeleted: boolean;
    scoreDelta: number;
    tokens: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    sessionId: number | null;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO events (project_id, file_path, timestamp, lines_added, lines_deleted, file_created, file_deleted, score_delta, tokens, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.projectId, data.filePath, data.timestamp,
      data.linesAdded, data.linesDeleted,
      data.fileCreated ? 1 : 0, data.fileDeleted ? 1 : 0,
      data.scoreDelta, data.tokens,
      data.inputTokens || 0, data.outputTokens || 0,
      data.cacheReadTokens || 0, data.cacheCreationTokens || 0,
      data.sessionId
    );
    return Number(result.lastInsertRowid);
  }

  getRecentEvents(projectId: number, limit: number): EventRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM events WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(projectId, limit) as EventRow[];
    return rows.map(this.rowToEvent);
  }

  getEventsInTimeRange(projectId: number, start: string, end: string): EventRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM events WHERE project_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp'
    ).all(projectId, start, end) as EventRow[];
    return rows.map(this.rowToEvent);
  }

  private rowToEvent(row: EventRow): EventRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      timestamp: row.timestamp,
      linesAdded: row.lines_added,
      linesDeleted: row.lines_deleted,
      fileCreated: row.file_created === 1,
      fileDeleted: row.file_deleted === 1,
      scoreDelta: row.score_delta,
      tokens: row.tokens,
      inputTokens: row.input_tokens || 0,
      outputTokens: row.output_tokens || 0,
      cacheReadTokens: row.cache_read_tokens || 0,
      cacheCreationTokens: row.cache_creation_tokens || 0,
      sessionId: row.session_id,
    };
  }

  // --- Token operations ---

  insertFileToken(data: {
    projectId: number;
    filePath: string;
    tokens: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    cumulativeTokens: number;
  }): void {
    this.db.prepare(`
      INSERT INTO file_token_history (project_id, file_path, tokens, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cumulative_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.projectId, data.filePath, data.tokens,
      data.inputTokens || 0, data.outputTokens || 0,
      data.cacheReadTokens || 0, data.cacheCreationTokens || 0,
      data.cumulativeTokens
    );
  }

  getTokenRanking(projectId: number, limit = 5): { filePath: string; tokens: number }[] {
    return this.db.prepare(`
      SELECT file_path as filePath, MAX(cumulative_tokens) as tokens
      FROM file_token_history
      WHERE project_id = ?
      GROUP BY file_path
      ORDER BY tokens DESC
      LIMIT ?
    `).all(projectId, limit) as any[];
  }

  // --- Daily summary ---

  getDailyStats(projectId: number): {
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    operations: number;
    tokensUsed: number;
  } {
    const today = new Date().toISOString().split('T')[0];
    const result = this.db.prepare(`
      SELECT
        COUNT(DISTINCT file_path) as filesChanged,
        COALESCE(SUM(lines_added), 0) as linesAdded,
        COALESCE(SUM(lines_deleted), 0) as linesDeleted,
        COUNT(*) as operations,
        COALESCE(SUM(tokens), 0) as tokensUsed
      FROM events
      WHERE project_id = ? AND DATE(timestamp) = ?
    `).get(projectId, today) as any;
    return result;
  }

  // --- Cleanup ---

  cleanupOldData(retentionDays: number): void {
    const cutoff = this.db.prepare(`SELECT datetime('now', '-' || ? || ' days') as cutoff`).get(retentionDays) as { cutoff: string };
    this.db.prepare(`
      INSERT OR IGNORE INTO daily_summary (project_id, date, total_loc, active_minutes, total_tokens)
      SELECT project_id, DATE(timestamp), SUM(lines_added - lines_deleted), 0, SUM(tokens)
      FROM events
      WHERE timestamp < ?
      GROUP BY project_id, DATE(timestamp)
    `).run(cutoff.cutoff);
    this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(cutoff.cutoff);
  }

  checkpoint(): void {
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }
}

import BetterSqlite3 from 'better-sqlite3';
import { KlineData, EventRecord, TickerData, Granularity } from '../shared/types';

interface KlineRow {
  id: number;
  project_id: number;
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
  files_created: number;
  files_deleted: number;
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

      CREATE TABLE IF NOT EXISTS kline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
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
        files_created INTEGER DEFAULT 0,
        files_deleted INTEGER DEFAULT 0,
        UNIQUE(project_id, timestamp, granularity)
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
        session_id INTEGER REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS file_token_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        file_path TEXT NOT NULL,
        tokens INTEGER NOT NULL,
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
    const row = this.db.prepare(
      'SELECT id, name, path, is_git_repo as isGitRepo, created_at as createdAt FROM projects WHERE id = ?'
    ).get(id) as any;
    return row;
  }

  getProjects(): { id: number; name: string; path: string; isGitRepo: number; createdAt: string }[] {
    return this.db.prepare(
      'SELECT id, name, path, is_git_repo as isGitRepo, created_at as createdAt FROM projects ORDER BY created_at DESC'
    ).all() as any[];
  }

  removeProject(id: number): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // --- Kline operations ---

  upsertKline(data: {
    projectId: number;
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
    filesCreated: number;
    filesDeleted: number;
  }): void {
    this.db.prepare(`
      INSERT INTO kline (project_id, timestamp, granularity, open_score, close_score, high_score, low_score, open_loc, close_loc, volume, tokens, files_created, files_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, timestamp, granularity) DO UPDATE SET
        close_score = excluded.close_score,
        high_score = MAX(kline.high_score, excluded.high_score),
        low_score = MIN(kline.low_score, excluded.low_score),
        close_loc = excluded.close_loc,
        volume = kline.volume + excluded.volume,
        tokens = kline.tokens + excluded.tokens,
        files_created = kline.files_created + excluded.files_created,
        files_deleted = kline.files_deleted + excluded.files_deleted
    `).run(
      data.projectId, data.timestamp, data.granularity,
      data.openScore, data.closeScore, data.highScore, data.lowScore,
      data.openLoc, data.closeLoc, data.volume, data.tokens,
      data.filesCreated, data.filesDeleted
    );
  }

  getKlines(projectId: number, granularity: Granularity, limit = 500): KlineData[] {
    const rows = this.db.prepare(
      'SELECT * FROM kline WHERE project_id = ? AND granularity = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(projectId, granularity, limit) as KlineRow[];
    return rows.map(this.rowToKline);
  }

  private rowToKline(row: KlineRow): KlineData {
    return {
      id: row.id,
      projectId: row.project_id,
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
      filesCreated: row.files_created,
      filesDeleted: row.files_deleted,
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
    sessionId: number | null;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO events (project_id, file_path, timestamp, lines_added, lines_deleted, file_created, file_deleted, score_delta, tokens, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.projectId, data.filePath, data.timestamp,
      data.linesAdded, data.linesDeleted,
      data.fileCreated ? 1 : 0, data.fileDeleted ? 1 : 0,
      data.scoreDelta, data.tokens, data.sessionId
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
      sessionId: row.session_id,
    };
  }

  // --- Token operations ---

  insertFileToken(data: {
    projectId: number;
    filePath: string;
    tokens: number;
    cumulativeTokens: number;
  }): void {
    this.db.prepare(`
      INSERT INTO file_token_history (project_id, file_path, tokens, cumulative_tokens)
      VALUES (?, ?, ?, ?)
    `).run(data.projectId, data.filePath, data.tokens, data.cumulativeTokens);
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

  // --- Ticker operations ---

  getTickerData(projectId: number): TickerData {
    const current = this.db.prepare(
      'SELECT close_score FROM kline WHERE project_id = ? AND granularity = ? ORDER BY timestamp DESC LIMIT 1'
    ).get(projectId, 'event') as { close_score: number } | undefined;

    const ath = this.db.prepare(
      'SELECT MAX(close_score) as val FROM kline WHERE project_id = ?'
    ).get(projectId) as { val: number | null };

    const atl = this.db.prepare(
      'SELECT MIN(close_score) as val FROM kline WHERE project_id = ?'
    ).get(projectId) as { val: number | null };

    const vol = this.db.prepare(
      "SELECT COALESCE(SUM(volume), 0) as val FROM kline WHERE project_id = ? AND timestamp > datetime('now', '-24 hours')"
    ).get(projectId) as { val: number };

    const activeFiles = this.db.prepare(
      'SELECT COUNT(DISTINCT file_path) as val FROM events WHERE project_id = ?'
    ).get(projectId) as { val: number };

    return {
      currentScore: current?.close_score ?? 10000,
      changePercent: 0,
      changeAbsolute: 0,
      ath: ath.val ?? 10000,
      atl: atl.val ?? 10000,
      volume24h: vol.val,
      activeFiles: activeFiles.val,
      connectionStatus: 'connected',
    };
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
    this.db.exec(`
      INSERT OR IGNORE INTO daily_summary (project_id, date, total_loc, active_minutes, total_tokens)
      SELECT project_id, DATE(timestamp), SUM(lines_added - lines_deleted), 0, SUM(tokens)
      FROM events
      WHERE timestamp < datetime('now', '-${retentionDays} days')
      GROUP BY project_id, DATE(timestamp);

      DELETE FROM events WHERE timestamp < datetime('now', '-${retentionDays} days');
    `);
  }

  checkpoint(): void {
    this.db.pragma('wal_checkpoint(PASSIVE)');
  }
}

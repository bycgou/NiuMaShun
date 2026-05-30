import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from '../../src/main/database';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'test.db');

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = new Database(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const walPath = TEST_DB_PATH + '-wal';
    const shmPath = TEST_DB_PATH + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('should create all tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('kline');
    expect(tableNames).toContain('events');
    expect(tableNames).toContain('file_token_history');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('daily_summary');
  });

  it('should enable WAL mode', () => {
    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');
  });

  it('should add and retrieve a project', () => {
    const id = db.addProject('test-project', '/path/to/project');
    const project = db.getProject(id);
    expect(project).toBeDefined();
    expect(project!.name).toBe('test-project');
    expect(project!.path).toBe('/path/to/project');
    expect(project!.isGitRepo).toBe(1);
  });

  it('should list all projects', () => {
    db.addProject('project-a', '/a');
    db.addProject('project-b', '/b');
    const projects = db.getProjects();
    expect(projects).toHaveLength(2);
  });

  it('should insert and query kline data', () => {
    const projectId = db.addProject('test', '/test');
    db.upsertKline({
      projectId,
      timestamp: '2026-05-30T10:00:00Z',
      granularity: '5min',
      openScore: 10000,
      closeScore: 10010,
      highScore: 10015,
      lowScore: 9998,
      openLoc: 1000,
      closeLoc: 1005,
      volume: 3,
      tokens: 150,
      filesCreated: 0,
      filesDeleted: 0,
    });
    const klines = db.getKlines(projectId, '5min');
    expect(klines).toHaveLength(1);
    expect(klines[0].openScore).toBe(10000);
    expect(klines[0].closeScore).toBe(10010);
  });

  it('should insert and query events', () => {
    const projectId = db.addProject('test', '/test');
    db.insertEvent({
      projectId,
      filePath: 'src/main.ts',
      timestamp: '2026-05-30T10:00:00Z',
      linesAdded: 5,
      linesDeleted: 0,
      fileCreated: false,
      fileDeleted: false,
      scoreDelta: 10,
      tokens: 0,
      sessionId: null,
    });
    const events = db.getRecentEvents(projectId, 10);
    expect(events).toHaveLength(1);
    expect(events[0].filePath).toBe('src/main.ts');
    expect(events[0].linesAdded).toBe(5);
  });

  it('should get ticker data', () => {
    const projectId = db.addProject('test', '/test');
    db.upsertKline({
      projectId,
      timestamp: '2026-05-30T10:00:00Z',
      granularity: 'event',
      openScore: 10000,
      closeScore: 10050,
      highScore: 10050,
      lowScore: 10000,
      openLoc: 1000,
      closeLoc: 1025,
      volume: 5,
      tokens: 200,
      filesCreated: 1,
      filesDeleted: 0,
    });
    const ticker = db.getTickerData(projectId);
    expect(ticker.currentScore).toBe(10050);
    expect(ticker.ath).toBe(10050);
    expect(ticker.atl).toBe(10050);
  });
});

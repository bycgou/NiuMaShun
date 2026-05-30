// src/main/state-recovery.ts
// Per-file state recovery is now handled in index.ts via getFileState()
// This file is kept for backward compatibility but is no longer used

import Database from './database';

export default class StateRecovery {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // No-op - state recovery is handled in index.ts
  recoverAllProjects(): void {
    // Recovery is now per-file, handled in index.ts
  }
}

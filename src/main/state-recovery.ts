// src/main/state-recovery.ts
import Database from './database';
import KlineAggregator from './kline-aggregator';
import ScoreCalculator from './score-calculator';

export interface ProjectState {
  projectId: number;
  projectPath: string;
  score: ScoreCalculator;
  aggregator: KlineAggregator;
}

export default class StateRecovery {
  private db: Database;
  private aggregator: KlineAggregator;

  constructor(db: Database) {
    this.db = db;
    this.aggregator = new KlineAggregator();
  }

  recoverAllProjects(): ProjectState[] {
    const projects = this.db.getProjects();
    return projects.map(project => this.recoverProject(project.id, project.path));
  }

  private recoverProject(projectId: number, projectPath: string): ProjectState {
    const klines = this.db.getKlines(projectId, 'event', 1);
    const latestKline = klines[0];

    const score = latestKline
      ? new ScoreCalculator(latestKline.closeScore, latestKline.closeLoc)
      : new ScoreCalculator();

    this.fixUnclosedPeriods(projectId);

    return {
      projectId,
      projectPath,
      score,
      aggregator: this.aggregator,
    };
  }

  private fixUnclosedPeriods(projectId: number): void {
    const granularities = ['3min', '5min', '15min', '1h', '1d'] as const;

    for (const granularity of granularities) {
      const klines = this.db.getKlines(projectId, granularity, 1);
      if (klines.length === 0) continue;

      const latest = klines[0];
      const currentPeriodStart = this.aggregator.getPeriodStart(granularity);

      if (latest.timestamp < currentPeriodStart) {
        // Period is already closed, nothing to fix
        continue;
      }

      // Period might be incomplete, it will be updated on next event
    }
  }
}

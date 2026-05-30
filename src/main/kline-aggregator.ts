const GRANULARITY_MS: Record<string, number> = {
  '3min': 3 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export interface AggregatedKline {
  timestamp: string;
  granularity: string;
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
}

export default class KlineAggregator {
  getPeriodStart(granularity: string, time?: Date): string {
    const now = time || new Date();
    const ms = GRANULARITY_MS[granularity];
    if (!ms) return now.toISOString();

    const timestamp = Math.floor(now.getTime() / ms) * ms;
    return new Date(timestamp).toISOString();
  }

  getPreviousPeriodStart(granularity: string, time?: Date): string {
    const now = time || new Date();
    const ms = GRANULARITY_MS[granularity];
    if (!ms) return now.toISOString();

    const currentStart = Math.floor(now.getTime() / ms) * ms;
    return new Date(currentStart - ms).toISOString();
  }

  aggregateEvents(
    events: {
      scoreDelta: number;
      linesAdded: number;
      linesDeleted: number;
      fileCreated: boolean;
      fileDeleted: boolean;
      tokens: number;
      timestamp: string;
    }[],
    granularity: string,
    baseScore: number,
    baseLoc: number
  ): AggregatedKline[] {
    const periods = new Map<string, typeof events>();

    for (const event of events) {
      const periodStart = this.getPeriodStart(granularity, new Date(event.timestamp));
      if (!periods.has(periodStart)) periods.set(periodStart, []);
      periods.get(periodStart)!.push(event);
    }

    const result: AggregatedKline[] = [];
    let runningScore = baseScore;
    let runningLoc = baseLoc;

    const sortedPeriods = [...periods.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [timestamp, periodEvents] of sortedPeriods) {
      const openScore = runningScore;
      const openLoc = runningLoc;
      let highScore = runningScore;
      let lowScore = runningScore;
      let volume = 0;
      let tokens = 0;
      let filesCreated = 0;
      let filesDeleted = 0;

      for (const event of periodEvents) {
        runningScore += event.scoreDelta;
        runningLoc += event.linesAdded - event.linesDeleted;
        highScore = Math.max(highScore, runningScore);
        lowScore = Math.min(lowScore, runningScore);
        volume++;
        tokens += event.tokens;
        if (event.fileCreated) filesCreated++;
        if (event.fileDeleted) filesDeleted++;
      }

      result.push({
        timestamp,
        granularity,
        openScore,
        closeScore: runningScore,
        highScore,
        lowScore,
        openLoc,
        closeLoc: runningLoc,
        volume,
        tokens,
        filesCreated,
        filesDeleted,
      });
    }

    return result;
  }
}

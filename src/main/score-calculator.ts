import { SCORE_BASE, SCORE_PER_LINE, SCORE_PER_FILE_CREATE, SCORE_PER_FILE_DELETE } from '../shared/constants';

export default class ScoreCalculator {
  private _currentScore: number;
  private _currentLoc: number;
  private _highScore: number;
  private _lowScore: number;

  constructor(savedScore?: number, savedLoc?: number) {
    this._currentScore = savedScore ?? SCORE_BASE;
    this._currentLoc = savedLoc ?? 0;
    this._highScore = this._currentScore;
    this._lowScore = this._currentScore;
  }

  get currentScore(): number {
    return this._currentScore;
  }

  get currentLoc(): number {
    return this._currentLoc;
  }

  get highScore(): number {
    return this._highScore;
  }

  get lowScore(): number {
    return this._lowScore;
  }

  calculateDelta(
    linesAdded: number,
    linesDeleted: number,
    fileCreated: boolean,
    fileDeleted: boolean
  ): number {
    let delta = 0;
    delta += linesAdded * SCORE_PER_LINE;
    delta += linesDeleted * (SCORE_PER_LINE * -1);
    if (fileCreated) delta += SCORE_PER_FILE_CREATE;
    if (fileDeleted) delta += SCORE_PER_FILE_DELETE;
    return delta;
  }

  apply(
    linesAdded: number,
    linesDeleted: number,
    fileCreated: boolean,
    fileDeleted: boolean
  ): number {
    const delta = this.calculateDelta(linesAdded, linesDeleted, fileCreated, fileDeleted);
    this._currentScore += delta;
    this._currentLoc += linesAdded - linesDeleted;
    if (this._currentScore > this._highScore) this._highScore = this._currentScore;
    if (this._currentScore < this._lowScore) this._lowScore = this._currentScore;
    return delta;
  }
}

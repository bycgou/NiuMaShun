import { SESSION_TIMEOUT_MS } from '../shared/constants';

export default class SessionTracker {
  private projectPath: string;
  private _isActive: boolean = false;
  private _currentSessionId: number | null = null;
  private timeout: NodeJS.Timeout | null = null;
  private onSessionStart: (() => void) | null = null;
  private onSessionEnd: (() => void) | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get currentSessionId(): number | null {
    return this._currentSessionId;
  }

  setCallbacks(onStart: () => void, onEnd: () => void): void {
    this.onSessionStart = onStart;
    this.onSessionEnd = onEnd;
  }

  setSessionId(id: number): void {
    this._currentSessionId = id;
  }

  onFileChange(): void {
    if (!this._isActive) {
      this._isActive = true;
      this.onSessionStart?.();
    }

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this._isActive = false;
      this._currentSessionId = null;
      this.onSessionEnd?.();
    }, SESSION_TIMEOUT_MS);
  }

  stop(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this._isActive) {
      this._isActive = false;
      this._currentSessionId = null;
      this.onSessionEnd?.();
    }
  }
}

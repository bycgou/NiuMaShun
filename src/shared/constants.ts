export const SCORE_BASE = 10_000;
export const SCORE_PER_LINE = 2;
export const SCORE_PER_FILE_CREATE = 100;
export const SCORE_PER_FILE_DELETE = -100;

export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '__pycache__',
  '.claude',
];

export const BINARY_EXTENSIONS = new Set([
  '.db', '.sqlite', '.sqlite3',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.otf',
]);

export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
export const EVENT_CORRELATION_WINDOW_MS = 30_000; // 30 seconds
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const DATA_RETENTION_DAYS = 90;
export const DISK_SPACE_THRESHOLD_MB = 100;
export const AGGREGATOR_CHECK_INTERVAL_MS = 60_000; // 1 minute
export const LOG_SCAN_INTERVAL_MS = 30_000; // 30 seconds

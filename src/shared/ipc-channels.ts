export const IPC_CHANNELS = {
  // Project management
  PROJECT_ADD: 'project:add',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_LIST: 'project:list',
  PROJECT_SWITCH: 'project:switch',

  // K-line data
  KLINE_GET: 'kline:get',
  KLINE_UPDATE: 'kline:update',

  // Events
  EVENTS_GET: 'events:get',
  EVENT_NEW: 'event:new',

  // Ticker
  TICKER_GET: 'ticker:get',
  TICKER_UPDATE: 'ticker:update',

  // File tree
  FILE_TREE_GET: 'file-tree:get',
  FILE_TREE_UPDATE: 'file-tree:update',

  // Token data
  TOKEN_RANKING_GET: 'token-ranking:get',
  DAILY_STATS_GET: 'daily-stats:get',

  // Sessions
  SESSION_TOGGLE: 'session:toggle',
  SESSION_GET: 'session:get',

  // Settings
  GRANULARITY_SET: 'granularity:set',
  GRANULARITY_GET: 'granularity:get',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Status
  STATUS_GET: 'status:get',
} as const;

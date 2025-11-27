export const APP_CONFIG = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_VERSION: 'v1',
} as const;

export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  EXPIRES_IN: '7d',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const EMAIL_PROVIDERS = {
  GMAIL: 'gmail',
  IMAP: 'imap',
} as const;

export const LABEL_ASSIGNMENT = {
  AI: 'ai',
  USER: 'user',
  ADMIN: 'admin',
  SYSTEM: 'system',
} as const;

export const AGENT_CONFIG = {
  RUN_AGENTS: process.env.RUN_AGENTS === 'true',
  INTERVAL_MINUTES: parseInt(process.env.AGENT_INTERVAL_MINUTES || '5', 10),
} as const;

export const IMAP_CONFIG = {
  RUN_SYNC: process.env.RUN_IMAP_SYNC === 'true',
  SYNC_INTERVAL_MINUTES: 60,
} as const;

export const EMBEDDING_CONFIG = {
  DIMENSIONS: 1536,
  SIMILARITY_THRESHOLD: 0.85,
} as const;

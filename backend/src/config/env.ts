import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  PORT: parseInt(requireEnv('PORT', '4400'), 10),
  NODE_ENV: requireEnv('NODE_ENV', 'development'),
  FRONTEND_URL: requireEnv('FRONTEND_URL', 'http://localhost:4300'),

  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRY: requireEnv('JWT_ACCESS_EXPIRY', '15m'),
  JWT_REFRESH_EXPIRY: requireEnv('JWT_REFRESH_EXPIRY', '7d'),

  DATABASE_PATH: requireEnv('DATABASE_PATH', './data/nova_central.db'),

  DEFAULT_SOURCE_PATH: requireEnv('DEFAULT_SOURCE_PATH', '/home/user/backup-source'),
  BACKUP_SCHEDULE: requireEnv('BACKUP_SCHEDULE', '0 */6 * * *'),

  ADMIN_USERNAME: requireEnv('ADMIN_USERNAME', 'admin'),
  // No fallback — must be explicitly set in .env
  ADMIN_PASSWORD: requireEnv('ADMIN_PASSWORD'),
} as const;

// ─── Startup Security Validations ───
const PLACEHOLDER_SECRETS = ['change-me', 'your-secret', 'replace-me', 'changeme'];

function isPlaceholderSecret(value: string): boolean {
  return PLACEHOLDER_SECRETS.some((p) => value.toLowerCase().includes(p));
}

if (isPlaceholderSecret(env.JWT_ACCESS_SECRET) || isPlaceholderSecret(env.JWT_REFRESH_SECRET)) {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      '🚨 SECURITY: JWT secrets appear to be default/placeholder values. ' +
      'Generate strong random secrets: openssl rand -base64 64'
    );
  } else {
    console.warn(
      '⚠️  WARNING: JWT secrets appear to be placeholder values. ' +
      'Change them before deploying to production!'
    );
  }
}

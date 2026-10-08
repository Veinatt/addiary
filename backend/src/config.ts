import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envPath = path.resolve(__dirname, '../.env')
// Do not override Railway/process env with a local .env file.
const result = dotenv.config({ path: envPath, override: false })

if (result.error) {
  console.warn(`[config] could not load ${envPath}: ${result.error.message}`)
} else {
  console.log(`[config] loaded ${Object.keys(result.parsed ?? {}).length} var(s) from ${envPath}`)
}

function envFlag(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function resolveDatabasePath(): string {
  const fromEnv = (process.env.DATABASE_PATH ?? '').trim()
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv)
  }

  const volume = (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? '').trim()
  if (volume) return path.join(volume, 'dnevnik.sqlite')

  // Railway without an explicit path: prefer persistent /data when the volume is mounted.
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID)
  if (onRailway) {
    try {
      if (fs.existsSync('/data') && fs.statSync('/data').isDirectory()) {
        return '/data/dnevnik.sqlite'
      }
    } catch {
      /* fall through */
    }
    console.warn(
      '[config] Railway detected but /data is missing — SQLite will be wiped on every redeploy. Add a Volume mounted at /data and set DATABASE_PATH=/data/dnevnik.sqlite',
    )
  }

  return path.resolve(process.cwd(), './data/dnevnik.sqlite')
}

export const config = {
  port: Number(process.env.PORT ?? 5001),
  databasePath: resolveDatabasePath(),
  authDevBypass: envFlag('AUTH_DEV_BYPASS'),
  initDataMaxAgeSec: Number(process.env.INIT_DATA_MAX_AGE_SEC ?? 86400),
  botToken: (process.env.BOT_TOKEN ?? '').trim(),
  publicApiUrl: (process.env.PUBLIC_API_URL ?? '').trim().replace(/\/$/, ''),
  fontPath: path.resolve(__dirname, '../assets/fonts/DejaVuSans.ttf'),
}

export function assertRuntimeConfig(): void {
  if (config.authDevBypass) {
    console.warn('[config] AUTH_DEV_BYPASS=on — API accepts X-User-Id without Telegram initData')
  } else {
    console.log('[config] Telegram initData auth enabled for /api/*')
  }
  console.log(`[config] DATABASE_PATH=${config.databasePath}`)
}

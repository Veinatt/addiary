import path from 'node:path'
import dotenv from 'dotenv'

const envPath = path.resolve(__dirname, '../.env')
const result = dotenv.config({ path: envPath, override: true })

if (result.error) {
  console.warn(`[config] could not load ${envPath}: ${result.error.message}`)
} else {
  console.log(`[config] loaded ${Object.keys(result.parsed ?? {}).length} var(s) from ${envPath}`)
}

function envFlag(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export const config = {
  port: Number(process.env.PORT ?? 5001),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/dnevnik.sqlite'),
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

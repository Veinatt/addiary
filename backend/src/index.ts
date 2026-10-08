import cors from 'cors'
import express from 'express'
import { assertRuntimeConfig, config } from './config'
import { closeDb, initDb } from './db'
import { downloadRouter } from './routes/download'
import { readingsRouter } from './routes/readings'
import { settingsRouter } from './routes/settings'

async function main(): Promise<void> {
  console.log('[boot] Дневник backend')
  assertRuntimeConfig()
  initDb()

  const app = express()
  app.use(
    cors({
      origin: true,
      exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  if (!config.publicApiUrl) {
    console.warn(
      '[boot] PUBLIC_API_URL is empty — download links use the request Host. Set PUBLIC_API_URL to the Railway HTTPS URL for Telegram downloadFile.',
    )
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, port: config.port })
  })

  app.use('/api/readings', readingsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/download', downloadRouter)

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[http]', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    },
  )

  const server = app.listen(config.port, () => {
    console.log(`[boot] HTTP READY http://localhost:${config.port}`)
  })

  const shutdown = (signal: string) => {
    console.log(`[shutdown] ${signal}`)
    server.close(() => {
      closeDb()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 5000).unref()
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error('[fatal]', error)
  process.exit(1)
})

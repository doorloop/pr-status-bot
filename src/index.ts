import { Hono } from 'hono'
import { createHandler } from '@vercel/slack-bolt'
import { app as boltApp, receiver } from './bolt/app.js'

const app = new Hono()

const welcomeStrings = [
  'Hello Hono!',
  'To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/hono'
]

app.get('/', (c) => {
  return c.text(welcomeStrings.join('\n\n'))
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const handler = createHandler(boltApp, receiver)

app.post('/api/slack/events', c => handler(c.req.raw))

export default app

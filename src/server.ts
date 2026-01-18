import app from './index.js'

const port = process.env.PORT || 3000

export default {
  port,
  fetch: app.fetch,
}

console.log(`Server running on http://localhost:${port}`)

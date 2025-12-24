import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import { handleSlashCommand } from './handlers/slash-command';
import type { SlackSlashCommandPayload } from './types';
import { createHmac, timingSafeEqual } from 'crypto';

const app = Fastify({
  logger: true,
});

// Register form body parser for Slack's URL-encoded payloads
app.register(formbody);

// Slack signature verification
function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  // Check timestamp is within 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  try {
    const sigBuffer = new Uint8Array(Buffer.from(mySignature));
    const expectedBuffer = new Uint8Array(Buffer.from(signature));
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Add raw body to request for signature verification
app.addContentTypeParser(
  'application/x-www-form-urlencoded',
  { parseAs: 'string' },
  (req, body, done) => {
    (req as unknown as { rawBody: string }).rawBody = body as string;
    done(null, body);
  }
);

// Health check endpoint
app.get('/health', async () => {
  return { status: 'ok' };
});

// Slash command endpoint
app.post<{ Body: SlackSlashCommandPayload }>(
  '/slack/command',
  {
    preHandler: async (request, reply) => {
      const signingSecret = process.env.SLACK_SIGNING_SECRET;

      if (!signingSecret) {
        app.log.error('SLACK_SIGNING_SECRET not configured');
        reply.code(500).send({ error: 'Server configuration error' });
        return;
      }

      const timestamp = request.headers['x-slack-request-timestamp'] as string;
      const signature = request.headers['x-slack-signature'] as string;
      const rawBody = (request as unknown as { rawBody: string }).rawBody;

      if (!timestamp || !signature || !rawBody) {
        reply.code(401).send({ error: 'Missing signature headers' });
        return;
      }

      if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
        reply.code(401).send({ error: 'Invalid signature' });
        return;
      }
    },
  },
  handleSlashCommand
);

export default app;

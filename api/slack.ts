import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await app.ready();

  const response = await app.inject({
    method: req.method as 'POST' | 'GET',
    url: '/slack/command',
    headers: req.headers as Record<string, string>,
    payload: req.body,
  });

  res.status(response.statusCode).send(response.json());
}

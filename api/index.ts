import { handle } from 'hono/vercel';
import app from '../src/index.js';

export const GET = handle(app);
export const POST = handle(app);

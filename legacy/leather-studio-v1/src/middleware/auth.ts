import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const DEMO_SECRET =
  process.env.DEMO_AUTH_SECRET || process.env.APP_URL || 'ruda-studio-local-demo-secret';

export function createDemoSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: 'demo_ruda_studio',
      email: 'studio-demo@ruda.local',
      name: 'RUDA 演示打版师',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', DEMO_SECRET).update(payload).digest('base64url');
  return `ruda_demo.${payload}.${sig}`;
}

function verifyDemoSessionToken(token: string): DecodedIdToken | null {
  if (!token.startsWith('ruda_demo.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', DEMO_SECRET).update(payload).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid: string;
      email: string;
      name: string;
      exp: number;
    };
    if (!data.uid || data.exp < Date.now()) return null;
    return {
      uid: data.uid,
      email: data.email,
      name: data.name,
    } as unknown as DecodedIdToken;
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录或缺少身份令牌，请先使用 Google 账号登录。' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: '身份令牌为空，请重新登录。' });
  }

  const demoUser = verifyDemoSessionToken(token);
  if (demoUser) {
    req.user = demoUser;
    await getOrCreateUser(
      demoUser.uid,
      demoUser.email || '',
      typeof demoUser.name === 'string' ? demoUser.name : ''
    );
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      typeof decodedToken.name === 'string' ? decodedToken.name : ''
    );
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: '登录会话已过期或无效，请重新登录。' });
  }
};

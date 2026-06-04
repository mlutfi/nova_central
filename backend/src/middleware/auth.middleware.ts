import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check access token from cookie first, then Authorization header
    const token =
      req.cookies?.access_token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    const user = UserModel.findById(payload.sub as unknown as number);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

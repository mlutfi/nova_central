import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { getDatabase } from '../config/database.js';
import { hashString } from '../utils/hash.js';
import { generateTokens, setTokenCookies } from '../controllers/auth.controller.js';
import { logger } from '../utils/logger.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

/**
 * Attempt to silently refresh the session using the refresh_token cookie.
 * On success, rotates tokens, sets new cookies, and returns the user.
 * On failure, returns null.
 */
async function trySilentRefresh(
  req: Request,
  res: Response
): Promise<{ id: number; username: string; role: string } | null> {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) return null;

  try {
    // Verify the refresh token JWT
    const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
    const { payload } = await jose.jwtVerify(refreshToken, secret);

    // Check if token exists in DB (rotation check)
    const db = getDatabase();
    const tokenHash = hashString(refreshToken);
    const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);

    if (!stored) {
      // Token reuse detected — invalidate all tokens for this user
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(Number(payload.sub));
      logger.warn(`Silent refresh: token reuse detected for user ${payload.sub}`);
      return null;
    }

    const userId = Number(payload.sub);
    const user = UserModel.findById(userId);
    if (!user) return null;

    // Rotate: delete old token, issue new pair
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(userId);
    setTokenCookies(res, newAccessToken, newRefreshToken);

    logger.debug(`Silent refresh successful for user ${user.username}`);
    return { id: user.id, username: user.username, role: user.role };
  } catch (error) {
    logger.debug('Silent refresh failed:', error);
    return null;
  }
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
      // No access token at all — try silent refresh as last resort
      const refreshedUser = await trySilentRefresh(req, res);
      if (refreshedUser) {
        req.user = refreshedUser;
        next();
        return;
      }
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    const userId = Number(payload.sub);
    const user = UserModel.findById(userId);
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
      // Access token expired — try server-side silent refresh
      const refreshedUser = await trySilentRefresh(req, res);
      if (refreshedUser) {
        req.user = refreshedUser;
        next();
        return;
      }
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

import { Request, Response } from 'express';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { UserModel } from '../models/user.model.js';
import { getDatabase } from '../config/database.js';
import { hashString } from '../utils/hash.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { writeAuditLog } from './audit.controller.js';

// Validation rules
export const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .escape()
    .withMessage('Username must be 3-50 characters'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters'),
];

export const changePasswordValidation = [
  body('currentPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must be at least 8 characters with uppercase, lowercase, and number'),
];

async function generateTokens(userId: number) {
  const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

  const accessToken = await new jose.SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .sign(accessSecret);

  const refreshTokenId = uuidv4();
  const refreshToken = await new jose.SignJWT({ sub: String(userId), jti: refreshTokenId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRY)
    .sign(refreshSecret);

  // Store hashed refresh token in DB
  const db = getDatabase();
  const tokenHash = hashString(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Clean up old tokens for this user
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP')
    .run(userId);

  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, tokenHash, expiresAt);

  return { accessToken, refreshToken };
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
  const isProduction = env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (JWT itself expires in 15m)
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return;
  }

  const { username, password } = req.body;

  try {
    const user = UserModel.findByUsername(username);
    if (!user) {
      // Use same error message to prevent user enumeration
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const validPassword = await UserModel.verifyPassword(user, password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const { accessToken, refreshToken } = await generateTokens(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    writeAuditLog({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      ipAddress: req.ip || req.socket?.remoteAddress,
    });

    logger.info(`User logged in: ${user.username}`);
    res.json({
      user: UserModel.toPublic(user),
      mustChangePassword: user.must_change_password === 1,
      // accessToken intentionally NOT included in body — use HttpOnly cookie
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const db = getDatabase();
      const tokenHash = hashString(refreshToken);
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
    }

    // Write audit log before clearing cookies
    if ((req as AuthRequest).user) {
      const u = (req as AuthRequest).user!;
      writeAuditLog({
        userId: u.id,
        username: u.username,
        action: 'LOGOUT',
        ipAddress: req.ip || req.socket?.remoteAddress,
      });
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    // Verify the refresh token JWT
    const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(refreshToken, secret);
      payload = result.payload;
    } catch {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Check if token exists in DB (rotation check)
    const db = getDatabase();
    const tokenHash = hashString(refreshToken);
    const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);

    if (!stored) {
      // Token reuse detected — invalidate all tokens for this user (security measure)
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(Number(payload.sub));
      logger.warn(`Refresh token reuse detected for user ${payload.sub}`);
      res.status(401).json({ error: 'Token reuse detected, all sessions invalidated' });
      return;
    }

    // Rotate: delete old token, issue new pair
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);

    const userId = Number(payload.sub);
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateTokens(userId);
    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = UserModel.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: UserModel.toPublic(user),
      mustChangePassword: user.must_change_password === 1,
    });
  } catch (error) {
    logger.error('Me endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const user = UserModel.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await UserModel.verifyPassword(user, currentPassword);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    await UserModel.updatePassword(user.id, newPassword);

    writeAuditLog({
      userId: user.id,
      username: user.username,
      action: 'PASSWORD_CHANGE',
      ipAddress: req.ip || req.socket?.remoteAddress,
    });

    logger.info(`Password changed for user: ${user.username}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

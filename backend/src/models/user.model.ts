import { getDatabase } from '../config/database.js';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  must_change_password: number; // 0 = false, 1 = true
  created_at: string;
  updated_at: string;
}

export type UserPublic = Omit<User, 'password_hash'>;

const SALT_ROUNDS = 12;

export const UserModel = {
  findById(id: number): User | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  findByUsername(username: string): User | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },

  async create(username: string, password: string, role: string = 'admin', mustChangePassword = false): Promise<User> {
    const db = getDatabase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const stmt = db.prepare(
      'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(username, passwordHash, role, mustChangePassword ? 1 : 0);
    return this.findById(result.lastInsertRowid as number)!;
  },

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  },

  async updatePassword(id: number, newPassword: string): Promise<void> {
    const db = getDatabase();
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(passwordHash, id);
  },

  setMustChangePassword(id: number, value: boolean): void {
    const db = getDatabase();
    db.prepare(
      'UPDATE users SET must_change_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(value ? 1 : 0, id);
  },

  toPublic(user: User): UserPublic {
    const { password_hash, ...publicUser } = user;
    return publicUser;
  },

  count(): number {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
  },
};


import crypto from 'crypto';
import fs from 'fs';

/**
 * Compute SHA-256 hash of a file using streaming (memory efficient).
 * SHA-256 is used instead of MD5 for better collision resistance.
 */
export function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Compute SHA256 hash of a string (for token hashing).
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

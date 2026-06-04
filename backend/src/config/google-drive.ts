import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export function createDriveClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_REFRESH_TOKEN } = env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    logger.warn('Google Drive OAuth 2.0 credentials are incomplete in .env');
    logger.warn('Google Drive sync will not be available until configured.');
    return null;
  }

  try {
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({
      refresh_token: GOOGLE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: 'v3', auth });
    logger.info('Google Drive client initialized successfully with OAuth 2.0');
    return drive;
  } catch (error) {
    logger.error('Failed to initialize Google Drive client:', error);
    return null;
  }
}

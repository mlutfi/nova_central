import { google } from 'googleapis';
import { SettingsModel } from '../models/settings.model.js';
import { logger } from '../utils/logger.js';

export function createDriveClient(config?: {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  refreshToken?: string;
}) {
  const clientId = config?.clientId || SettingsModel.get('google_client_id');
  const clientSecret = config?.clientSecret || SettingsModel.get('google_client_secret');
  const redirectUri = config?.redirectUri || SettingsModel.get('google_redirect_uri');
  const refreshToken = config?.refreshToken || SettingsModel.get('google_refresh_token');

  if (!clientId || !clientSecret || !refreshToken) {
    logger.warn('Google Drive OAuth 2.0 credentials are incomplete in database settings.');
    logger.warn('Google Drive sync will not be available until configured.');
    return null;
  }

  try {
    const auth = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    auth.setCredentials({
      refresh_token: refreshToken,
    });

    const drive = google.drive({ version: 'v3', auth });
    logger.info('Google Drive client initialized successfully with OAuth 2.0');
    return drive;
  } catch (error) {
    logger.error('Failed to initialize Google Drive client:', error);
    return null;
  }
}

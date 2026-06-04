import { env } from '../config/env.js';
import { initDatabase, closeDatabase } from '../config/database.js';
import { UserModel } from '../models/user.model.js';
import { SettingsModel } from '../models/settings.model.js';
import { logger } from '../utils/logger.js';

async function seed(): Promise<void> {
  logger.info('Seeding database...');

  await initDatabase();

  // Create admin user
  const existingUser = UserModel.findByUsername(env.ADMIN_USERNAME);
  if (existingUser) {
    logger.info(`Admin user already exists: ${env.ADMIN_USERNAME}`);
  } else {
    await UserModel.create(env.ADMIN_USERNAME, env.ADMIN_PASSWORD, 'admin');
    logger.info(`Admin user created: ${env.ADMIN_USERNAME}`);
  }

  // Init default settings
  SettingsModel.initDefaults();
  logger.info('Default settings initialized');

  closeDatabase();
  logger.info('Seed complete!');
}

seed().catch((error) => {
  logger.error('Seed failed:', error);
  process.exit(1);
});

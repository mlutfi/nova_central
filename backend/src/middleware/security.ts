import helmet from 'helmet';
import cors from 'cors';
import type { Express } from 'express';
import { env } from '../config/env.js';

export function setupSecurity(app: Express): void {
  // Helmet — secure HTTP headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS — restrict to frontend origin
  const allowedOrigins = env.FRONTEND_URL.split(',').map(url => url.trim());
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Disable X-Powered-By
  app.disable('x-powered-by');
}

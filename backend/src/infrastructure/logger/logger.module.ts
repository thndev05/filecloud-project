import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Pino logger for the whole app.
 * - One log line per HTTP request (method, url, status, duration, userId).
 * - JSON in production (docker logs), pretty output in development.
 * - Headers are never logged, so tokens/cookies stay out of logs.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
        transport: isProduction
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true } },

        // Reuse the id from Nginx/clients if present, so logs can be correlated
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },

        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        customSuccessMessage: (req, res) =>
          `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res) =>
          `${req.method} ${req.url} ${res.statusCode}`,

        // req.user is set by JwtStrategy once the guard has run
        customProps: (req: IncomingMessage & { user?: { id: string } }) => ({
          userId: req.user?.id,
        }),

        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            ip: req.headers['x-real-ip'] || req.remoteAddress,
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  ],
})
export class LoggerModule {}

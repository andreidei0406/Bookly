/**
 * @module logger
 * @description Pino-based logger for the Bookly API.
 * Uses pino-pretty in development for human-readable output,
 * and plain JSON in production for structured logging.
 */

import pino from 'pino';
import config from './index.js';

const isDevelopment = config.env === 'development';

/**
 * Build transport options for pino-pretty in development.
 * @returns {import('pino').TransportSingleOptions | undefined}
 */
const buildTransport = () => {
  if (isDevelopment) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }
  return undefined;
};

const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  ...(buildTransport() ? { transport: buildTransport() } : {}),
});

export default logger;

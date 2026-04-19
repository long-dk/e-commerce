import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { Logger } from 'winston';
import * as winston from 'winston';

@Injectable()
export class LoggerService {
  private logger: Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      defaultMeta: { service: process.env.SERVICE_NAME || 'ecommerce' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, service }) => {
              return `[${timestamp}] [${service}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({ 
          filename: `${process.env.LOGS_DIR || './logs'}/${process.env.SERVICE_NAME || 'ecommerce'}-log.log`
        }),
        // Uncomment to send logs to Logstash
        // new winston.transports.Syslog({
        //   host: process.env.LOGSTASH_HOST || 'localhost',
        //   port: process.env.LOGSTASH_PORT || 514,
        //   facility: 'local0',
        //   format: winston.format.json(),
        // }),
      ],
    });
  }

  log(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, error?: any, meta?: any) {
    this.logger.error(message, { error, ...meta });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }
}

@Injectable()
export class LoggerBase {
  @Inject(LoggerService)
  readonly logger: LoggerService;
}
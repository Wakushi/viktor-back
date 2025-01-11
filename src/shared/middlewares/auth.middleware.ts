import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from 'config/env.validation';
import { NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  async use(req, res: Response, next: NextFunction) {
    const authorization = req.get('Authorization');

    if (!authorization) {
      throw new UnauthorizedException();
    }

    const [_, token] = authorization.split(' ');

    if (!token || token !== this.config.get('SECRET')) {
      throw new UnauthorizedException();
    }

    next();
  }
}

import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';

@Module({
  imports: [],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}

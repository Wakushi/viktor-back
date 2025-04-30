import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';
import { CsvService } from './services/csv.service';
import { PuppeteerService } from './services/puppeteer.service';
import { LogGateway } from './services/log-gateway';

@Module({
  providers: [LockService, CsvService, PuppeteerService, LogGateway],
  exports: [LockService, CsvService, PuppeteerService, LogGateway],
})
export class SharedModule {}

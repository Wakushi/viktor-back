import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';
import { CsvService } from './services/csv.service';
import { PuppeteerService } from './services/puppeteer.service';

@Module({
  providers: [LockService, CsvService, PuppeteerService],
  exports: [LockService, CsvService, PuppeteerService],
})
export class SharedModule {}

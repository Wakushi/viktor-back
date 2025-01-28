import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';
import { CsvService } from './services/csv.service';

@Module({
  providers: [LockService, CsvService],
  exports: [LockService, CsvService],
})
export class SharedModule {}

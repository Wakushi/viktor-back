import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';
import { TokenDataService } from './services/token-data.service';

@Module({
  providers: [LockService, TokenDataService],
  exports: [LockService, TokenDataService],
})
export class SharedModule {}

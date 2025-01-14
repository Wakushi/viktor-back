import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';

@Module({
  providers: [LockService],
  exports: [LockService],
})
export class SharedModule {}

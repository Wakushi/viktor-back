import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';
import { ContractService } from './services/contract.service';

@Module({
  providers: [LockService, ContractService],
  exports: [LockService, ContractService],
})
export class SharedModule {}

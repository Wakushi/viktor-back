import { Module } from '@nestjs/common';
import { LockService } from './services/lock.service';
import { ContractService } from './services/contract.service';
import { TokenDataService } from './services/token-data.service';

@Module({
  providers: [LockService, ContractService, TokenDataService],
  exports: [LockService, ContractService, TokenDataService],
})
export class SharedModule {}

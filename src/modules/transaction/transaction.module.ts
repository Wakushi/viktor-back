import { SharedModule } from 'src/shared/shared.module';

import { DynamicModule, Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { RpcUrlConfig } from '../uniswap-v3/entities/rpc-url-config.type';

@Module({})
export class TransactionModule {
  static forRoot(config: {
    privateKey: string;
    rpcUrls: RpcUrlConfig;
  }): DynamicModule {
    return {
      module: TransactionModule,
      imports: [SharedModule],
      providers: [
        {
          provide: 'TRANSACTION_CONFIG',
          useValue: config,
        },
        TransactionService,
      ],
      exports: [TransactionService],
      global: true,
    };
  }
}

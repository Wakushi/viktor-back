import { SharedModule } from 'src/shared/shared.module';

import { DynamicModule, Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { RpcUrlConfig } from '../../shared/entities/rpc-url-config.type';
import { TransactionController } from './transaction.controller';

@Module({})
export class TransactionModule {
  static forRoot(config: {
    privateKey: string;
    rpcUrls: RpcUrlConfig;
  }): DynamicModule {
    return {
      module: TransactionModule,
      imports: [SharedModule],
      controllers: [TransactionController],
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

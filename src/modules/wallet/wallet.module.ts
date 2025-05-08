import { SharedModule } from 'src/shared/shared.module';

import { DynamicModule, Module } from '@nestjs/common';
import { RpcUrlConfig } from '../uniswap-v3/entities/rpc-url-config.type';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({})
export class WalletModule {
  static forRoot(config: { rpcUrls: RpcUrlConfig }): DynamicModule {
    return {
      module: WalletModule,
      imports: [SharedModule],
      controllers: [WalletController],
      providers: [
        {
          provide: 'WALLET_CONFIG',
          useValue: config,
        },
        WalletService,
      ],
      exports: [WalletService],
      global: true,
    };
  }
}

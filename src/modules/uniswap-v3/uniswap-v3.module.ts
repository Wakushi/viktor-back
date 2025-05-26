import { DynamicModule, Module } from '@nestjs/common';
import { UniswapV3Service } from './uniswap-v3.service';
import { RpcUrlConfig } from '../../shared/entities/rpc-url-config.type';

@Module({})
export class UniswapV3Module {
  static forRoot(config: { rpcUrls: RpcUrlConfig }): DynamicModule {
    return {
      module: UniswapV3Module,
      providers: [
        {
          provide: 'UNISWAP_V3_CONFIG',
          useValue: config,
        },
        UniswapV3Service,
      ],
      exports: [UniswapV3Service],
      global: true,
    };
  }
}

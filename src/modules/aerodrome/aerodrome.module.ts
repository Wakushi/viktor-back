import { DynamicModule, Module } from '@nestjs/common';
import { RpcUrlConfig } from 'src/shared/entities/rpc-url-config.type';
import { AerodromeService } from './aerodrome.service';

@Module({})
export class AerodromeModule {
  static forRoot(config: { rpcUrls: RpcUrlConfig }): DynamicModule {
    return {
      module: AerodromeModule,
      providers: [
        {
          provide: 'AERODROME_CONFIG',
          useValue: config,
        },
        AerodromeService,
      ],
      exports: [AerodromeService],
      global: true,
    };
  }
}

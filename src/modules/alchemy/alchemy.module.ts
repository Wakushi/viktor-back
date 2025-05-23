import { DynamicModule, Module } from '@nestjs/common';
import { AlchemyService } from './alchemy.service';
import { Network } from 'alchemy-sdk';

@Module({})
export class AlchemyModule {
  static forRoot(config: { apiKey: string; network: Network }): DynamicModule {
    return {
      module: AlchemyModule,
      providers: [
        {
          provide: 'ALCHEMY_CONFIG',
          useValue: config,
        },
        AlchemyService,
      ],
      exports: [AlchemyService],
      global: true,
    };
  }
}

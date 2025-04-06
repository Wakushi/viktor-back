import { DynamicModule, Module } from '@nestjs/common';

import { MobulaService } from './mobula.service';

@Module({})
export class MobulaModule {
  static forRoot(config: { apiKey: string }): DynamicModule {
    return {
      module: MobulaModule,
      providers: [
        MobulaService,
        {
          provide: 'MOBULA_CONFIG',
          useValue: config,
        },
      ],
      exports: [MobulaService],
      global: true,
    };
  }
}

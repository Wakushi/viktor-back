import { DynamicModule, Module } from '@nestjs/common';

import { MobulaService } from './mobula.service';
import { MobulaController } from './mobula.controller';

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
      controllers: [MobulaController],
      exports: [MobulaService],
      global: true,
    };
  }
}

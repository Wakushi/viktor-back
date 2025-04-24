import { DynamicModule, Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
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
      imports: [SharedModule],
      exports: [MobulaService],
      global: true,
    };
  }
}

import { DynamicModule, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

@Module({})
export class EmbeddingModule {
  static forRoot(config: { baseUrl: string; apiKey: string }): DynamicModule {
    return {
      module: EmbeddingModule,
      providers: [
        {
          provide: 'VOYAGE_CONFIG',
          useValue: config,
        },
        EmbeddingService,
      ],
      exports: [EmbeddingService],
      global: true,
    };
  }
}

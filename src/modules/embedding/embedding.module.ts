import { DynamicModule, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

@Module({})
export class EmbeddingModule {
  static forRoot(): DynamicModule {
    return {
      module: EmbeddingModule,
      providers: [
        {
          provide: 'VOYAGE_CONFIG',
          useValue: {
            baseUrl: 'https://api.voyageai.com/v1',
            apiKey: process.env.VOYAGE_API_KEY,
          },
        },
        EmbeddingService,
      ],
      exports: [EmbeddingService],
      global: true,
    };
  }
}

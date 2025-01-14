import { DynamicModule, Module } from '@nestjs/common';
import { TokensService } from './tokens.service';

@Module({})
export class TokensModule {
  static forRoot(): DynamicModule {
    return {
      module: TokensModule,
      providers: [TokensService],
      exports: [TokensService],
      global: true,
    };
  }
}

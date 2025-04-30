import { DynamicModule, Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { SettingsService } from '../settings/settings.service';
import { SharedModule } from 'src/shared/shared.module';

@Module({})
export class TokensModule {
  static forRoot(): DynamicModule {
    return {
      module: TokensModule,
      imports: [SharedModule],
      providers: [TokensService, SettingsService],
      exports: [TokensService],
      global: true,
    };
  }
}

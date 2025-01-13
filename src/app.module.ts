import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AgentModule } from './modules/agent/agent.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from 'config/env.validation';
import { AuthMiddleware } from './shared/middlewares/auth.middleware';
import { ContractModule } from './modules/contract/contract.module';
import { AlchemyModule } from './modules/alchemy/alchemy.module';
import { Network } from 'alchemy-sdk';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { MarketTestModule } from './modules/market-test/market-test.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    ContractModule.forRoot({
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
      privateKey: process.env.PRIVATE_KEY,
    }),
    AlchemyModule.forRoot({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.BASE_SEPOLIA,
    }),
    SupabaseModule.forRoot({
      privateKey: process.env.SUPABASE_API_KEY,
      url: process.env.SUPABASE_URL,
    }),
    EmbeddingModule.forRoot({
      apiKey: process.env.VOYAGE_API_KEY,
      baseUrl: process.env.VOYAGE_API_URL,
      model: process.env.VOYAGE_MODEL,
    }),
    AgentModule,
    MarketTestModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('/**');
  }
}

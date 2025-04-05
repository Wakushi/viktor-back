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
import { UniswapV3Module } from './modules/uniswap-v3/uniswap-v3.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { TrainingModule } from './modules/training/training.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './modules/cron/cron.module';
import { MobulaModule } from './modules/mobula/mobula.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    ContractModule.forRoot({
      rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
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
    UniswapV3Module.forRoot({
      rpcUrls: {
        mainnet: {
          ethereum: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          'arbitrum-one': `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          'polygon-pos': `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          base: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          avalanche: `https://avax-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        },
        testnet: {
          ethereum: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          'arbitrum-one': `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          'polygon-pos': `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          base: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          avalanche: `https://avax-fuji.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        },
      },
    }),
    AgentModule.forRoot(),
    TokensModule.forRoot(),
    TrainingModule,
    ScheduleModule.forRoot(),
    CronModule,
    MobulaModule.forRoot({
      apiKey: process.env.MOBULA_API_KEY,
    }),
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('/**');
  }
}

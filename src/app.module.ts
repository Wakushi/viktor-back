import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from 'config/env.validation';
import { AuthMiddleware } from './shared/middlewares/auth.middleware';
import { AlchemyModule } from './modules/alchemy/alchemy.module';
import { Network } from 'alchemy-sdk';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { UniswapV3Module } from './modules/uniswap-v3/uniswap-v3.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './modules/cron/cron.module';
import { MobulaModule } from './modules/mobula/mobula.module';
import { MobulaChain } from './modules/mobula/entities/mobula.entities';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { WalletModule } from './modules/wallet/wallet.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
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
        [MobulaChain.ETHEREUM]: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.BASE]: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.ARBITRUM]: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.BNB]: `https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    }),
    TokensModule.forRoot(),
    ScheduleModule.forRoot(),
    CronModule,
    MobulaModule.forRoot({
      apiKey: process.env.MOBULA_API_KEY,
    }),
    AnalysisModule.forRoot(),
    TransactionModule.forRoot({
      privateKey: process.env.PRIVATE_KEY,
      rpcUrls: {
        [MobulaChain.ETHEREUM]: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.BASE]: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.ARBITRUM]: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.BNB]: `https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    }),
    WalletModule.forRoot({
      rpcUrls: {
        [MobulaChain.ETHEREUM]: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.BASE]: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.ARBITRUM]: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        [MobulaChain.BNB]: `https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    }),
    SettingsModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('/**');
  }
}

import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../embedding/embedding.module';
import { MarketTestController } from './market-test.controller';
import { MarketTestService } from './market-test.service';

@Module({
  imports: [EmbeddingModule],
  controllers: [MarketTestController],
  providers: [MarketTestService],
})
export class MarketTestModule {}

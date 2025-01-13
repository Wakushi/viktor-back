import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../embedding/embedding.module';
import { MarketTestController } from './market-test.controller';
import { MarketTestService } from './market-test.service';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [EmbeddingModule, SharedModule],
  controllers: [MarketTestController],
  providers: [MarketTestService],
})
export class MarketTestModule {}

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TrainingService } from './training.service';
import { SharedModule } from 'src/shared/shared.module';
import { TrainingController } from './training.controller';

@Module({
  imports: [SupabaseModule, SharedModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}

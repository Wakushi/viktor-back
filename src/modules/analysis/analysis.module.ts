import { DynamicModule, Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { SharedModule } from 'src/shared/shared.module';

@Module({})
export class AnalysisModule {
  static forRoot(): DynamicModule {
    return {
      imports: [SharedModule],
      module: AnalysisModule,
      controllers: [AnalysisController],
      providers: [AnalysisService],
      exports: [AnalysisService],
      global: true,
    };
  }
}

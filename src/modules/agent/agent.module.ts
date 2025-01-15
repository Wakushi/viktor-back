import { DynamicModule, Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { SharedModule } from 'src/shared/shared.module';

@Module({})
export class AgentModule {
  static forRoot(): DynamicModule {
    return {
      imports: [SharedModule],
      module: AgentModule,
      providers: [AgentService],
      controllers: [AgentController],
      exports: [AgentService],
      global: true,
    };
  }
}

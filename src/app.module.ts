import { Module } from '@nestjs/common';
import { AgentModule } from './modules/agent/agent.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from 'config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    AgentModule,
  ],
})
export class AppModule {}

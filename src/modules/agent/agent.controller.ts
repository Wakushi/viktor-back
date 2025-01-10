import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { MakeDecisionDto } from './dto/decision.dto';
import { LockService } from 'src/shared/services/lock.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly lockService: LockService,
  ) {}

  @Post()
  @HttpCode(200)
  makeDecision(@Body() makeDecisionDto: MakeDecisionDto) {
    const { uuid, wallet, owner } = makeDecisionDto;

    if (!uuid || !wallet || !owner) {
      throw new BadRequestException(
        'Missing one or more arguments (required: uuid, wallet, owner)',
      );
    }

    if (this.lockService.acquireLock(uuid)) {
      this.agentService.makeDecision(uuid, owner, wallet);
    }

    return { message: 'Ok' };
  }
}

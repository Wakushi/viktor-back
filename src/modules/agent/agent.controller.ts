import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
  Get,
  Param,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { MakeDecisionDto } from './dto/decision.dto';
import { LockService } from 'src/shared/services/lock.service';
import { TokenDataService } from 'src/shared/services/token-data.service';
import { isAddress } from 'viem';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly tokenDataService: TokenDataService,
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

  @Get('balance/:address')
  @HttpCode(200)
  async checkBalance(@Param('address') address: string) {
    if (!isAddress(address)) {
      throw new BadRequestException('Address invalid');
    }

    const tokens = await this.tokenDataService.getWalletTokens(address);
    console.log('Tokens: ', tokens);
  }
}

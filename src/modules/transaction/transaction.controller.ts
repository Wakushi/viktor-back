import { Controller, Get } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { MobulaService } from '../mobula/mobula.service';
import { VIKTOR_ASW_CONTRACT_ADDRESSES } from './contracts/constants';
import { MobulaChain } from '../mobula/entities/mobula.entities';

@Controller('transaction')
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly mobulaService: MobulaService,
  ) {}

  @Get()
  async getSwaps() {
    return this.transactionService.getSwaps();
  }
  
  @Get('wallet')
  async getWalletHistory() {
    return this.mobulaService.getWalletHistory(
      VIKTOR_ASW_CONTRACT_ADDRESSES[MobulaChain.BASE],
    );
  }
}

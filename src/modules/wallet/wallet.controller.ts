import { Controller, Get, HttpCode } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { MobulaChain } from '../mobula/entities/mobula.entities';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @HttpCode(200)
  async getWalletPortfolio() {
    const portfolio = await this.walletService.getWalletPortfolio(
      MobulaChain.BASE,
    );

    return portfolio;
  }

  @Get('snapshots')
  @HttpCode(200)
  async getWalletSnapshots() {
    const snapshots = await this.walletService.getWalletSnapshots();

    return snapshots;
  }
}

import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { MobulaService } from './mobula.service';
import { Address, isAddress } from 'viem';

@Controller('mobula')
export class MobulaController {
  constructor(private readonly mobulaService: MobulaService) {}

  @Get('/market/all')
  async getAllTokens() {
    return await this.mobulaService.getAllTokens();
  }

  @Get('/market/:asset')
  async getMarketData(@Param() { asset }: { asset: string }) {
    if (!asset) {
      throw new BadRequestException('Missing asset');
    }

    return await this.mobulaService.getTokenMarketData(asset);
  }

  @Get('/wallet/:wallet')
  async getWalletTransactions(@Param() { wallet }: { wallet: Address }) {
    if (!wallet || !isAddress(wallet)) {
      throw new BadRequestException('Missing or wrong format wallet');
    }

    return await this.mobulaService.getWalletTransactions(wallet);
  }

  @Get('/wallet/nft/:wallet')
  async getWalletNfts(@Param() { wallet }: { wallet: Address }) {
    if (!wallet || !isAddress(wallet)) {
      throw new BadRequestException('Missing or wrong format wallet');
    }

    return await this.mobulaService.getWalletNfts(wallet);
  }

  @Get('/wallet/portfolio/:wallet')
  async getWalletPortfolio(@Param() { wallet }: { wallet: Address }) {
    if (!wallet || !isAddress(wallet)) {
      throw new BadRequestException('Missing or wrong format wallet');
    }

    return await this.mobulaService.getWalletPortfolio(wallet);
  }

  @Get('/market/fresh/:chain')
  async getNewlyListedToken(@Param() { chain }: { chain: string }) {
    if (!chain) {
      throw new BadRequestException('Missing chain');
    }

    return await this.mobulaService.getNewlyListedToken(chain);
  }

  @Get('/pairs/:chain')
  async getTradingPairs(@Param() { chain }: { chain: string }) {
    if (!chain) {
      throw new BadRequestException('Missing chain');
    }

    return await this.mobulaService.getTradingPairs(chain);
  }
}

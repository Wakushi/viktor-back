import { Controller, Get, HttpCode } from '@nestjs/common';
import { HyperliquidService } from './hyperliquid.service';

@Controller('hyperliquid')
export class HyperliquidController {
  constructor(private readonly hyperliquidService: HyperliquidService) {}

  @Get()
  @HttpCode(200)
  async test() {
    await this.hyperliquidService.test();
  }
}

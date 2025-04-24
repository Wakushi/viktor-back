import {
  Controller,
  Get,
  HttpCode,
  Post,
  Body,
  InternalServerErrorException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { MobulaChain } from '../mobula/entities/mobula.entities';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('whitelisted-chains')
  @HttpCode(200)
  async getWhitelistedChains() {
    const chains = await this.settingsService.getWhitelistedChains();
    return { data: chains };
  }

  @Post('whitelisted-chains')
  @HttpCode(200)
  async updateWhitelistedChains(@Body() body: { chains: MobulaChain[] }) {
    try {
      await this.settingsService.updateWhitelistedChains(body.chains);
      return { message: 'Whitelisted chains updated successfully' };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}

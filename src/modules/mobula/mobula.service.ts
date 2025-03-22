import { Inject, Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MobulaToken,
  MobulaTokenPriceHistory,
} from './entities/mobula.entities';

@Injectable()
export class MobulaService {
  constructor(
    @Inject('MOBULA_CONFIG')
    private readonly config: {
      apiKey: string;
    },
    private supabaseService: SupabaseService,
  ) {}

  public async getAllTokens(): Promise<any> {
    const data = await this.makeRequest(`/all`);
    return data;
  }

  public async getTokenMarketData(asset: string): Promise<any> {
    const data = await this.makeRequest(`/market/data?asset=${asset}`);
    return data;
  }

  public async getTokenPriceHistory(
    asset: string,
  ): Promise<MobulaTokenPriceHistory | null> {
    const data = await this.makeRequest(`/market/history?asset=${asset}`);
    return data; // market/history?asset=base&blockchain=base'
  }

  public async getNewlyListedToken(chain: string): Promise<any> {
    const data = await this.makeRequest(
      `/market/query/token?sortBy=listed_at&sortOrder=desc&blockchain=${chain}`,
    );
    return data;
  }

  public async getWalletTransactions(wallet: Address): Promise<any> {
    const data = await this.makeRequest(
      `/wallet/transactions?wallet=${wallet}`,
    );
    return data;
  }

  public async getTradingPairs(chain: string): Promise<any> {
    const data = await this.makeRequest(
      `/market/blockchain/pairs?blockchain=${chain}&sortBy=createdAt`,
    );
    return data;
  }

  public async getWalletNfts(wallet: Address): Promise<any> {
    const data = await this.makeRequest(`/wallet/nfts?wallet=${wallet}`);
    return data;
  }

  public async getWalletPortfolio(wallet: Address): Promise<any> {
    const data = await this.makeRequest(
      `/wallet/portfolio?wallet=${wallet}&pnl=true`,
    );
    return data;
  }

  public async searchTokenByName(token: string): Promise<MobulaToken[] | null> {
    return await this.makeRequest(`/search?input=${token}`);
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const BASE_URL = 'https://production-api.mobula.io/api/1';

    try {
      const response = await fetch(BASE_URL + endpoint);
      const { data, statusCode, message } = await response.json();

      if (statusCode && statusCode >= 400) {
        throw new Error(`Error ${statusCode}, ${message}`);
      }

      return data;
    } catch (error) {
      console.error('Error while making request: ', error.message);
      return null;
    }
  }
}

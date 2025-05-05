import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MobulaChain,
  MobulaExtendedToken,
  MobulaMultiDataToken,
  MobulaMultipleTokens,
  MobulaOHLCV,
  MobulaSingleToken,
  MobulaTokenPriceHistory,
  MobulaTokenQueryParams,
  SwapTransaction,
  TokenBalance,
  WalletHistory,
  WalletStats,
} from './entities/mobula.entities';
import { Address } from 'viem';
import { LogGateway } from 'src/shared/services/log-gateway';

// Chains
// https://docs.mobula.io/blockchains/intro-blockchains

@Injectable()
export class MobulaService {
  private readonly logger = new Logger(MobulaService.name);

  constructor(
    @Inject('MOBULA_CONFIG')
    private readonly config: {
      apiKey: string;
    },
    private readonly logGateway: LogGateway,
  ) {}

  public async getAllTokens(
    fields?: string[],
  ): Promise<MobulaMultipleTokens[]> {
    let baseUrl = 'https://production-api.mobula.io/api/1/all?fields=';

    if (fields?.length) {
      baseUrl += fields.join(',');
    }

    const response = await fetch(baseUrl);
    const { data, statusCode, message } = await response.json();

    if (statusCode && statusCode >= 400) {
      throw new Error(`Error ${statusCode}, ${message}`);
    }

    return data;
  }

  public async getTokenMarketDataById(
    token_id: number,
  ): Promise<MobulaMultiDataToken | null> {
    const { data, error } = await this.makeRequest(
      `/market/data?id=${token_id}`,
    );

    if (error) {
      this.log(`Error fetching token by id ${token_id}: ` + error);
      return null;
    }

    return data;
  }

  public async getTokenMultiData(
    tokenIds: any[],
  ): Promise<MobulaMultiDataToken[]> {
    const BATCH_SIZE = 300;
    const results: MobulaMultiDataToken[] = [];
    let batchCounter = 1;

    while (tokenIds.length) {
      const batch = tokenIds.splice(0, BATCH_SIZE);
      const endpoint = `/market/multi-data?ids=${batch.join(',')}`;

      const { data, error } = await this.makeRequest(endpoint);

      if (error) {
        this.log('Error fetching token multi-data : ' + error);
        tokenIds.push(...batch);
      } else {
        results.push(
          ...Array.from(
            Object.values(data).map((token) => token as MobulaMultiDataToken),
          ),
        );

        batchCounter++;
      }
    }

    return results;
  }

  public async getTokenPriceHistory(
    asset: string,
  ): Promise<MobulaTokenPriceHistory | null> {
    const { data, error } = await this.makeRequest(
      `/market/history?asset=${asset}`,
    );

    if (error) {
      this.log(`Error fetching price history for asset ${asset}: ` + error);
      return null;
    }

    return data;
  }

  public async queryTokens(params: MobulaTokenQueryParams): Promise<any> {
    const baseUrl = 'https://api.mobula.io/api/1/market/query';
    const url = new URL(baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    const finalUrl = url.toString();

    const response = await fetch(finalUrl);
    const { data, statusCode, message } = await response.json();

    if (statusCode && statusCode >= 400) {
      throw new Error(`Error ${statusCode}, ${message}`);
    }

    return data;
  }

  public async searchTokenByName(
    token: string,
  ): Promise<MobulaSingleToken[] | null> {
    const { data, error } = await this.makeRequest(`/search?input=${token}`);

    if (error) {
      this.log(`Error fetching token by name ${token}: ` + error);
      return null;
    }

    return data;
  }

  public async getSmartMoney(limit = 100): Promise<WalletStats[] | null> {
    const { data, error } = await this.makeRequest('/wallet/smart-money');

    if (error) {
      this.log('Error fetching smart money' + error);
      return null;
    }

    const filteredWallets: WalletStats[] = data
      .filter(
        (w: WalletStats) =>
          !w.blockchains.includes(MobulaChain.SOLANA) &&
          (w.blockchains.includes(MobulaChain.ETHEREUM) ||
            w.blockchains.includes(MobulaChain.BASE)) &&
          w.realized_pnl &&
          w.realized_pnl < 10000000,
      )
      .sort((a, b) => b.realized_pnl - a.realized_pnl);

    return filteredWallets.slice(0, limit);
  }

  public async getWalletTrades({
    wallet,
    order = 'desc',
    limit = 100,
    offset = 0,
    page = 1,
  }: {
    wallet: Address;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    page?: number;
  }): Promise<SwapTransaction[] | null> {
    const { data, error } = await this.makeRequest(
      `/wallet/trades?limit=${limit}&offset=${offset}&page=${page}&wallet=${wallet}&order=${order}`,
    );

    if (error) {
      this.log(`Error fetching ${wallet} trades: ` + error);
      return null;
    }

    return data;
  }

  public async getOHLCV({
    token,
    from = 0,
    to = Date.now(),
  }: {
    token: MobulaExtendedToken;
    from?: number;
    to?: number;
  }): Promise<MobulaOHLCV[]> {
    // https://api.mobula.io/api/1/market/history/pair?symbol=PEIPEI&period=1d&from=0&to=1744380949000
    const endpoint = `/market/history/pair?symbol=${token.symbol}&period=1d&from=${from}&to=${to}`;

    const { data, error } = await this.makeRequest(endpoint);

    if (error) {
      this.log(`Error fetching ${token.name} OHLCV: ` + error);
      return null;
    }

    return data as MobulaOHLCV[];
  }

  public async getWalletHistory(wallet: Address): Promise<WalletHistory> {
    const { data, error } = await this.makeRequest(
      `/wallet/history?wallet=${wallet}`,
    );

    if (error) {
      this.log(`Error fetching ${wallet} history: ` + error);
      return null;
    }

    const { balance_usd, balance_history } = data;

    return { balance_usd, balance_history };
  }

  public async getWalletPortfolio(
    wallet: Address,
    chain: MobulaChain,
  ): Promise<TokenBalance[]> {
    const { data, error } = await this.makeRequest(
      `/wallet/portfolio?wallet=${wallet}&blockchains=${chain.toLowerCase()}`,
    );

    if (error) {
      this.log(`Error fetching ${wallet} portfolio: ` + error);
      return null;
    }

    const assets: TokenBalance[] = data.assets
      .filter((asset) => asset.token_balance)
      .map((asset) => ({
        token_balance: asset.token_balance,
        price: asset.price,
        allocation: asset.allocation,
        asset: asset.asset,
      }));

    return assets;
  }

  private async makeRequest(
    endpoint: string,
  ): Promise<{ data: any; error: string }> {
    const BASE_URL = 'https://production-api.mobula.io/api/1';

    const response = await fetch(BASE_URL + endpoint);

    const { data, message } = await response.json();

    return { data, error: message };
  }

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }
}

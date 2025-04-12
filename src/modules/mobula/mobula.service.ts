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
  WalletStats,
} from './entities/mobula.entities';
import { Address } from 'viem';

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
      this.logger.error(`Error fetching token by id ${token_id}: ` + error);
      return null;
    }

    return data;
  }

  public async getTokenMultiData(
    tokenIds: number[],
  ): Promise<MobulaMultiDataToken[]> {
    const BATCH_SIZE = 500;
    const results: MobulaMultiDataToken[] = [];
    let batchCounter = 1;

    this.logger.log(
      `[getTokenMultiData] Fetching token multi-data (${Math.floor(tokenIds.length / BATCH_SIZE)} batches)`,
    );

    while (tokenIds.length) {
      const batch = tokenIds.splice(0, BATCH_SIZE);
      const endpoint = `/market/multi-data?ids=${batch.join(',')}`; //

      this.logger.log(
        `[getTokenMultiData] Processing batch ${batchCounter} (${tokenIds.length} entries left)`,
      );

      const { data, error } = await this.makeRequest(endpoint);

      if (error) {
        this.logger.error('Error fetching token multi-data :', error);
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
      this.logger.error(
        `Error fetching price history for asset ${asset}: `,
        error,
      );
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
      this.logger.error(`Error fetching token by name ${token}: `, error);
      return null;
    }

    return data;
  }

  public async getSmartMoney(): Promise<WalletStats[] | null> {
    const { data, error } = await this.makeRequest('/wallet/smart-money');

    if (error) {
      this.logger.error('Error fetching smart money', error);
      return null;
    }

    const filteredWallets: WalletStats[] = data
      .filter(
        (w: WalletStats) =>
          !w.blockchains.includes(MobulaChain.SOLANA) &&
          (w.blockchains.includes(MobulaChain.ETHEREUM) ||
            w.blockchains.includes(MobulaChain.BASE)) &&
          w.realized_pnl,
      )
      .sort(
        (a, b) =>
          b.realized_pnl +
          b.unrealized_pnl -
          (a.realized_pnl + a.unrealized_pnl),
      );

    return filteredWallets;
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
      this.logger.error(`Error fetching ${wallet} trades: ` + error);
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
      this.logger.error(`Error fetching ${token.name} OHLCV: ` + error);
      return null;
    }

    return data as MobulaOHLCV[];
  }

  private async makeRequest(
    endpoint: string,
  ): Promise<{ data: any; error: string }> {
    const BASE_URL = 'https://production-api.mobula.io/api/1';

    const response = await fetch(BASE_URL + endpoint);

    const { data, message } = await response.json();

    return { data, error: message };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MobulaMultiDataToken,
  MobulaMultipleTokens,
  MobulaSingleToken,
  MobulaTokenPriceHistory,
  MobulaTokenQueryParams,
} from './entities/mobula.entities';

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
    tokenId: number,
  ): Promise<MobulaMultiDataToken | null> {
    const { data, error } = await this.makeRequest(
      `/market/data?id=${tokenId}`,
    );

    if (error) {
      this.logger.error(`Error fetching token by id ${tokenId}: ` + error);
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
      const endpoint = `/market/multi-data?ids=${batch.join(',')}`;

      this.logger.log(
        `[getTokenMultiData] Processing batch ${batchCounter} (${tokenIds.length} entries left)`,
      );

      try {
        const batchResults = await this.makeRequest(endpoint);

        results.push(
          ...Array.from(
            Object.values(batchResults).map(
              (token) => token as MobulaMultiDataToken,
            ),
          ),
        );

        batchCounter++;
      } catch (error) {
        console.error('Error fetching token multi-data :', error);
        tokenIds.push(...batch);
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

  private async makeRequest(
    endpoint: string,
  ): Promise<{ data: any; error: string }> {
    const BASE_URL = 'https://production-api.mobula.io/api/1';

    const response = await fetch(BASE_URL + endpoint);

    const { data, message } = await response.json();

    return { data, error: message };
  }
}

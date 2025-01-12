import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alchemy, Network, TokenMetadataResponse } from 'alchemy-sdk';
import { EnvConfig } from 'config/env.validation';
import { Address } from 'viem';

type Token = {
  name: string;
  symbol: string;
  balance: string;
};

@Injectable()
export class TokenDataService {
  private _alchemyClient: Alchemy;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  private get alchemyClient() {
    if (!this._alchemyClient) {
      const config = {
        apiKey: this.config.get('ALCHEMY_API_KEY'),
        network: Network.BASE_SEPOLIA,
      };

      this._alchemyClient = new Alchemy(config);
    }

    return this._alchemyClient;
  }

  public async getWalletTokens(wallet: Address): Promise<Token[]> {
    try {
      const balances = await this.alchemyClient.core.getTokenBalances(wallet);

      const nonZeroBalances = balances.tokenBalances.filter((token) => {
        return token.tokenBalance !== '0';
      });

      const tokens: Token[] = [];

      for (let token of nonZeroBalances) {
        let balance = token.tokenBalance;

        const metadata = await this.getTokenMetadata(
          token.contractAddress as Address,
        );

        tokens.push({
          name: metadata.name,
          symbol: metadata.symbol,
          balance: (+balance / Math.pow(10, metadata.decimals)).toString(),
        });
      }

      return tokens;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  private async getTokenMetadata(
    tokenAddress: Address,
  ): Promise<TokenMetadataResponse> {
    const metadata =
      await this.alchemyClient.core.getTokenMetadata(tokenAddress);

    return metadata;
  }
}

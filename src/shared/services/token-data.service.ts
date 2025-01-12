import { Injectable } from '@nestjs/common';
import { TokenMetadataResponse } from 'alchemy-sdk';
import { AlchemyService } from 'src/modules/alchemy/alchemy.service';
import { Address } from 'viem';

type Token = {
  name: string;
  symbol: string;
  balance: string;
};

@Injectable()
export class TokenDataService {
  constructor(private readonly alchemyService: AlchemyService) {}

  public async getWalletTokens(wallet: Address): Promise<Token[]> {
    const client = this.alchemyService.client;

    try {
      const balances = await client.core.getTokenBalances(wallet);

      const nonZeroBalances = balances.tokenBalances.filter((token) => {
        return token.tokenBalance !== '0';
      });

      const tokens: Token[] = [];

      for (let token of nonZeroBalances) {
        const metadata = await this.getTokenMetadata(
          token.contractAddress as Address,
        );

        tokens.push({
          name: metadata.name,
          symbol: metadata.symbol,
          balance: (
            +token.tokenBalance / Math.pow(10, metadata.decimals)
          ).toString(),
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
      await this.alchemyService.client.core.getTokenMetadata(tokenAddress);

    return metadata;
  }
}

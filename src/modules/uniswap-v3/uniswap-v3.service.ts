import { Inject, Injectable } from '@nestjs/common';
import { FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import { TokenMarketData } from 'src/shared/services/token-data/entities/token.type';
import { extractTokenChains } from 'src/shared/utils/helpers';
import {
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
} from './entities/constants';
import { WETH_ADDRESSES } from 'src/shared/utils/constants/chains';
import { RpcUrlConfig } from './entities/rpc-url-config.type';
import { Address, zeroAddress } from 'viem';

@Injectable()
export class UniswapV3Service {
  constructor(
    @Inject('UNISWAP_V3_CONFIG')
    private readonly config: { rpcUrls: RpcUrlConfig },
  ) {
    const { rpcUrls } = config;

    if (!rpcUrls.mainnet || !rpcUrls.testnet) {
      throw new Error('Expected RPC URLs for both mainnet and testnet');
    }
  }

  public async doesPoolExists({
    tokenA,
    tokenB,
    poolFee,
    network = 'mainnet',
  }: {
    tokenA: TokenMarketData;
    tokenB: TokenMarketData;
    poolFee: FeeAmount;
    network?: 'mainnet' | 'testnet';
  }): Promise<boolean> {
    const poolAddress = await this.getPoolAddress({
      tokenA,
      tokenB,
      poolFee,
      network,
    });

    return poolAddress !== zeroAddress;
  }

  public async getPoolAddress({
    tokenA,
    tokenB,
    poolFee,
    network = 'mainnet',
  }: {
    tokenA: TokenMarketData;
    tokenB: TokenMarketData;
    poolFee: FeeAmount;
    network?: 'mainnet' | 'testnet';
  }): Promise<Address> {
    try {
      const chainInfo = this.isWethToken(tokenA)
        ? extractTokenChains(tokenB)[0]
        : extractTokenChains(tokenA)[0];

      const factoryAddress = UNISWAP_V3_FACTORY[chainInfo.name];

      if (!factoryAddress) {
        console.error(
          `No Uniswap V3 Factory found for chain ${chainInfo.name}`,
        );

        return ethers.ZeroAddress as Address;
      }

      const rpcUrl = this.getRpcUrl(chainInfo.name, network);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const factory = new ethers.Contract(
        factoryAddress,
        UNISWAP_V3_FACTORY_ABI,
        provider,
      );

      const tokenAAddress = this.isWethToken(tokenA)
        ? WETH_ADDRESSES[chainInfo.name]
        : tokenA.metadata.contract_addresses[chainInfo.name].contract_address;

      const tokenBAddress = this.isWethToken(tokenB)
        ? WETH_ADDRESSES[chainInfo.name]
        : tokenB.metadata.contract_addresses[chainInfo.name].contract_address;

      const poolAddress = await factory.getPool(
        tokenAAddress,
        tokenBAddress,
        poolFee,
      );

      return poolAddress;
    } catch (error) {
      console.error('Error checking pool:', error);
      return ethers.ZeroAddress as Address;
    }
  }

  private getRpcUrl(
    chainName: string,
    network: 'mainnet' | 'testnet' = 'mainnet',
  ): string {
    const rpcUrl = this.config.rpcUrls[network][chainName];

    if (!rpcUrl) {
      throw new Error(`No RPC URL found for ${chainName} on ${network}`);
    }

    return rpcUrl;
  }

  private isWethToken(token: TokenMarketData): boolean {
    return (
      token.symbol.toLowerCase() === 'eth' ||
      token.symbol.toLowerCase() === 'weth'
    );
  }
}

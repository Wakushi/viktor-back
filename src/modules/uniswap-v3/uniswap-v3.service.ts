import { Inject, Injectable } from '@nestjs/common';
import { FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import {
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
} from './entities/constants';
import { RpcUrlConfig } from './entities/rpc-url-config.type';
import { Address } from 'viem';
import { MobulaChain } from '../mobula/entities/mobula.entities';

@Injectable()
export class UniswapV3Service {
  constructor(
    @Inject('UNISWAP_V3_CONFIG')
    private readonly config: { rpcUrls: RpcUrlConfig },
  ) {
    const { rpcUrls } = config;

    if (!rpcUrls) {
      throw new Error('Expected RPC URLs');
    }
  }

  public async getPoolAddress({
    chain,
    tokenA,
    tokenB,
    poolFee = FeeAmount.MEDIUM,
  }: {
    chain: MobulaChain;
    tokenA: Address | string;
    tokenB: Address | string;
    poolFee?: FeeAmount;
  }): Promise<Address> {
    try {
      const factoryAddress = UNISWAP_V3_FACTORY[chain];

      if (!factoryAddress) {
        return ethers.ZeroAddress as Address;
      }

      const rpcUrl = this.getRpcUrl(chain);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const factory = new ethers.Contract(
        factoryAddress,
        UNISWAP_V3_FACTORY_ABI,
        provider,
      );

      const poolAddress = await factory.getPool(tokenA, tokenB, poolFee);

      return poolAddress;
    } catch (error) {
      console.error('Error checking pool:', error);
      return ethers.ZeroAddress as Address;
    }
  }

  private getRpcUrl(chainName: MobulaChain): string {
    const rpcUrl = this.config.rpcUrls[chainName];

    if (!rpcUrl) {
      throw new Error(`No RPC URL found for ${chainName}`);
    }

    return rpcUrl;
  }
}

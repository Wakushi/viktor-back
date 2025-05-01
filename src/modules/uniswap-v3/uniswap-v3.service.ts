import { Inject, Injectable } from '@nestjs/common';
import { FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import {
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
  UNISWAP_QUOTER_V2_ABI,
} from './entities/constants';
import { RpcUrlConfig } from './entities/rpc-url-config.type';
import { Address, Chain, createPublicClient, http } from 'viem';
import { MobulaChain } from '../mobula/entities/mobula.entities';
import { base } from 'viem/chains';
import { mainnet } from 'viem/chains';
import { arbitrum } from 'viem/chains';
import { QUOTER_CONTRACT_ADDRESSES } from 'src/shared/utils/constants';

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

  public async getUniswapQuote({
    chain,
    tokenIn,
    tokenOut,
    amountIn,
    fee = 3000,
  }: {
    chain: MobulaChain;
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    fee?: number;
  }): Promise<bigint> {
    const publicClient = createPublicClient({
      chain: this.getChain(chain),
      transport: http(this.getRpcUrl(chain)),
    });

    const quoterAddress = QUOTER_CONTRACT_ADDRESSES[chain];

    if (!quoterAddress) {
      throw new Error(`No Quoter contract address defined for chain ${chain}`);
    }

    try {
      const poolAddress = await this.getPoolAddress({
        chain,
        tokenA: tokenIn,
        tokenB: tokenOut,
        poolFee: fee,
      });

      if (!poolAddress) {
        throw new Error(`No pool address found for ${tokenIn} and ${tokenOut}`);
      }

      const { result } = await publicClient.simulateContract({
        address: quoterAddress,
        abi: UNISWAP_QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const [amountOut] = result as [bigint];

      return amountOut as bigint;
    } catch (error) {
      console.error(`Failed to get quote:`, error);
      throw error;
    }
  }

  private getRpcUrl(chainName: MobulaChain): string {
    const rpcUrl = this.config.rpcUrls[chainName];

    if (!rpcUrl) {
      throw new Error(`No RPC URL found for ${chainName}`);
    }

    return rpcUrl;
  }

  private getChain(chainName: MobulaChain): Chain {
    switch (chainName) {
      case MobulaChain.BASE:
        return base;
      case MobulaChain.ARBITRUM:
        return arbitrum;
      case MobulaChain.ETHEREUM:
        return mainnet;
      default:
        throw new Error(`Unsupported chain: ${chainName}`);
    }
  }
}

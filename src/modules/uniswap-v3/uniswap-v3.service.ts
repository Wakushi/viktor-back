import { Inject, Injectable } from '@nestjs/common';
import { FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import { extractTokenChains, isWethToken } from 'src/shared/utils/helpers';
import {
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
} from './entities/constants';
import { WETH_ADDRESSES } from 'src/shared/utils/constants/chains';
import { RpcUrlConfig } from './entities/rpc-url-config.type';
import { Address, zeroAddress } from 'viem';
import { TokenData } from '../tokens/entities/token.type';

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
    poolFee = FeeAmount.MEDIUM,
    network = 'mainnet',
  }: {
    tokenA: TokenData;
    tokenB: TokenData;
    poolFee?: FeeAmount;
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
    poolFee = FeeAmount.MEDIUM,
    network = 'mainnet',
  }: {
    tokenA: TokenData;
    tokenB: TokenData;
    poolFee?: FeeAmount;
    network?: 'mainnet' | 'testnet';
  }): Promise<Address> {
    try {
      const chainInfo = isWethToken(tokenA)
        ? extractTokenChains(tokenB)[0]
        : extractTokenChains(tokenA)[0];

      const factoryAddress = UNISWAP_V3_FACTORY[chainInfo.name];

      if (!factoryAddress) {
        return ethers.ZeroAddress as Address;
      }

      const rpcUrl = this.getRpcUrl(chainInfo.name, network);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const factory = new ethers.Contract(
        factoryAddress,
        UNISWAP_V3_FACTORY_ABI,
        provider,
      );

      const tokenAAddress = isWethToken(tokenA)
        ? WETH_ADDRESSES[chainInfo.name]
        : tokenA.metadata.contract_addresses[chainInfo.name]?.contract_address;

      const tokenBAddress = isWethToken(tokenB)
        ? WETH_ADDRESSES[chainInfo.name]
        : tokenB.metadata.contract_addresses[chainInfo.name]?.contract_address;

      if (!tokenAAddress || !tokenBAddress) {
        throw new Error('One token contract address is not found');
      }

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
}

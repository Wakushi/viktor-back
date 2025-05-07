import { Inject, Injectable } from '@nestjs/common';
import { FeeAmount } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import {
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
  UNISWAP_QUOTER_V2_ABI,
  UNISWAP_COMMON_FEES,
} from './entities/constants';
import { RpcUrlConfig } from './entities/rpc-url-config.type';
import {
  Address,
  Chain,
  createPublicClient,
  formatUnits,
  getAddress,
  Hex,
  http,
  parseUnits,
  zeroAddress,
} from 'viem';
import { MobulaChain } from '../mobula/entities/mobula.entities';
import { base } from 'viem/chains';
import { mainnet } from 'viem/chains';
import { arbitrum } from 'viem/chains';
import {
  QUOTER_CONTRACT_ADDRESSES,
  USDC_ADDRESSES,
  WETH_DECIMALS,
  WRAPPED_NATIVE_ADDRESSES,
} from 'src/shared/utils/constants';
import { encodePath } from 'src/shared/utils/helpers';
import { MobulaService } from '../mobula/mobula.service';
import { MOBULA_ETHER_ID } from '../mobula/entities/constants';
import { Pool } from './entities/pool.entity';

@Injectable()
export class UniswapV3Service {
  constructor(
    @Inject('UNISWAP_V3_CONFIG')
    private readonly config: { rpcUrls: RpcUrlConfig },
    private readonly mobulaService: MobulaService,
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

  public async findShortestViablePath({
    chain,
    tokenIn,
    tokenOut,
    tokenOutDecimals,
    tokenOutPrice,
    tokenInPrice,
    amountIn,
    tokenInDecimals,
  }: {
    chain: MobulaChain;
    tokenIn: Address;
    tokenOut: Address;
    tokenOutDecimals: number;
    tokenInPrice: number;
    tokenOutPrice: number;
    tokenInDecimals: number;
    amountIn: bigint;
  }): Promise<{ path: Hex; minAmountOut: bigint }> {
    try {
      const { path, minAmountOut } = await this.findSingleHopPath({
        chain,
        tokenIn,
        tokenOut,
        tokenOutDecimals,
        amountIn,
        tokenOutPrice,
        tokenInPrice,
        tokenInDecimals,
      });

      return { path, minAmountOut };
    } catch {
      const { path, minAmountOut } = await this.findMultiHopPath({
        chain,
        tokenIn,
        tokenOut,
        tokenOutDecimals,
        amountIn,
        tokenOutPrice,
      });

      return { path, minAmountOut };
    }
  }

  private async findSingleHopPath({
    chain,
    tokenIn,
    tokenOut,
    tokenOutDecimals,
    tokenOutPrice,
    amountIn,
    tokenInPrice,
    tokenInDecimals,
  }: {
    chain: MobulaChain;
    tokenIn: Address;
    tokenOut: Address;
    tokenOutPrice: number;
    tokenOutDecimals: number;
    amountIn: bigint;
    tokenInPrice: number;
    tokenInDecimals: number;
  }): Promise<{ path: Hex; minAmountOut: bigint }> {
    const quoterAddress = QUOTER_CONTRACT_ADDRESSES[chain];

    if (!quoterAddress) throw new Error(`No Quoter contract for ${chain}`);

    const { pool, fee, liquidityIn, liquidityOut } = await this.getBestPool({
      chain,
      tokenIn,
      tokenOut,
    });

    if (!pool || pool === zeroAddress) {
      throw new Error('No single-hop pools');
    }

    const MIN_LIQUIDITY_USD = 5000;

    const liquidityInPrice =
      Number(formatUnits(liquidityIn, tokenInDecimals)) * tokenInPrice;

    const liquidityOutPrice =
      Number(formatUnits(liquidityOut, tokenOutDecimals)) * tokenOutPrice;

    if (
      liquidityOutPrice < MIN_LIQUIDITY_USD ||
      liquidityInPrice < MIN_LIQUIDITY_USD
    ) {
      throw new Error('Pools too shallow for single hop');
    }

    const publicClient = createPublicClient({
      chain: this.getChain(chain),
      transport: http(this.getRpcUrl(chain)),
    });

    const { result: singleHopResult } = await publicClient.simulateContract({
      address: quoterAddress,
      abi: UNISWAP_QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });

    const [amountOutSingleHop] = singleHopResult as [bigint];

    if (amountOutSingleHop > 0n) {
      const path = encodePath([tokenIn, tokenOut], [fee]);

      return { path, minAmountOut: amountOutSingleHop };
    }

    throw new Error(
      `❌ No viable single-hop path found for ${tokenIn} → ${tokenOut} on ${chain}`,
    );
  }

  private async findMultiHopPath({
    chain,
    tokenIn,
    tokenOut,
    tokenOutDecimals,
    tokenOutPrice,
    amountIn,
  }: {
    chain: MobulaChain;
    tokenIn: Address;
    tokenOut: Address;
    tokenOutDecimals: number;
    tokenOutPrice: number;
    amountIn: bigint;
  }): Promise<{ path: Hex; minAmountOut: bigint }> {
    const WETH = WRAPPED_NATIVE_ADDRESSES[chain];
    const USDC = USDC_ADDRESSES[chain];
    const quoterAddress = QUOTER_CONTRACT_ADDRESSES[chain];

    if (!quoterAddress) throw new Error(`No Quoter contract for ${chain}`);

    const MIN_LIQUIDITY_USD = 5000;

    const isSwapToUSDC = getAddress(tokenOut) === getAddress(USDC);
    const middle = WETH;
    const legA = isSwapToUSDC ? tokenIn : USDC;
    const legB = isSwapToUSDC ? USDC : tokenOut;

    const {
      pool: poolA,
      fee: feeA,
      liquidityOut: liquidityAOut,
    } = await this.getBestPool({
      chain,
      tokenIn: legA,
      tokenOut: middle,
    });

    const {
      pool: poolB,
      fee: feeB,
      liquidityOut: liquidityBOut,
    } = await this.getBestPool({
      chain,
      tokenIn: middle,
      tokenOut: legB,
    });

    if (!poolA || poolA === zeroAddress || !poolB || poolB === zeroAddress) {
      throw new Error('No multi-hop pools');
    }

    const wethMarketData =
      await this.mobulaService.getTokenMarketDataById(MOBULA_ETHER_ID);

    if (!wethMarketData) {
      throw new Error('WETH market data not found');
    }

    const wethPrice = wethMarketData.price;

    const liquidityAprice =
      Number(formatUnits(liquidityAOut, WETH_DECIMALS)) * wethPrice;

    const liquidityBPrice =
      Number(formatUnits(liquidityBOut, tokenOutDecimals)) * tokenOutPrice;

    if (
      liquidityAprice < MIN_LIQUIDITY_USD ||
      liquidityBPrice < MIN_LIQUIDITY_USD
    ) {
      throw new Error('Pools too shallow');
    }

    const tokens = isSwapToUSDC
      ? [tokenIn, middle, tokenOut]
      : [USDC, middle, tokenOut];

    const path = encodePath(tokens, [feeA, feeB]);

    const publicClient = createPublicClient({
      chain: this.getChain(chain),
      transport: http(this.getRpcUrl(chain)),
    });

    const { result } = await publicClient.simulateContract({
      address: quoterAddress,
      abi: UNISWAP_QUOTER_V2_ABI,
      functionName: 'quoteExactInput',
      args: [path, amountIn],
    });

    const [amountOut] = result as [bigint];

    if (amountOut > 0n) {
      return { path, minAmountOut: amountOut };
    }
  }

  private async getBestPool({
    chain,
    tokenIn,
    tokenOut,
  }: {
    chain: MobulaChain;
    tokenIn: Address;
    tokenOut: Address;
  }): Promise<Pool> {
    const fees = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

    const publicClient = createPublicClient({
      chain: this.getChain(chain),
      transport: http(this.getRpcUrl(chain)),
    });

    let bestPool: Pool | null = null;

    for (const fee of fees) {
      const pool = await this.getPoolAddress({
        chain,
        tokenA: tokenIn,
        tokenB: tokenOut,
        poolFee: fee,
      });

      const tokenOutBalance = await publicClient.readContract({
        address: tokenOut,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [pool],
      });

      const tokenInBalance = await publicClient.readContract({
        address: tokenIn,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [pool],
      });

      if (
        !bestPool ||
        (tokenOutBalance > bestPool.liquidityOut &&
          tokenInBalance > bestPool.liquidityIn)
      ) {
        bestPool = {
          pool,
          fee,
          liquidityOut: tokenOutBalance,
          liquidityIn: tokenInBalance,
        };
      }
    }

    return bestPool;
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

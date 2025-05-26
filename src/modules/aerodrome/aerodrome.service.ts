import { Inject, Injectable } from '@nestjs/common';
import { MobulaChain } from '../mobula/entities/mobula.entities';
import {
  Address,
  createPublicClient,
  formatUnits,
  getAddress,
  Hex,
  http,
  zeroAddress,
} from 'viem';
import {
  AERODROME_POOL_FACTORY_ABI,
  AERODROME_POOL_FACTORY_ADDRESS,
} from './entities/pool-factory';
import { RpcUrlConfig } from 'src/shared/entities/rpc-url-config.type';
import { ethers } from 'ethers';
import { base } from 'viem/chains';
import { AerodromePool, AerodromeRoute } from './entities/pool.types';
import { ERC20_SIMPLE_ABI } from '../transaction/contracts/constants';
import { AERODROME_POOL_ABI } from './entities/pool-abi';
import { MIN_POOL_LIQUIDITY_USD } from '../uniswap-v3/entities/constants';
import {
  USDC_ADDRESSES,
  WRAPPED_NATIVE_ADDRESSES,
} from 'src/shared/utils/constants';

const DEFAULT_GRANULARITY = 10;

@Injectable()
export class AerodromeService {
  constructor(
    @Inject('AERODROME_CONFIG')
    private readonly config: { rpcUrls: RpcUrlConfig },
  ) {
    if (!config?.rpcUrls) {
      throw new Error('Expected RPC URLs');
    }
  }

  public async getPoolAddress({
    tokenA,
    tokenB,
    isStable = false,
  }: {
    tokenA: Address | string;
    tokenB: Address | string;
    isStable?: boolean;
  }): Promise<Address> {
    try {
      const factoryAddress = AERODROME_POOL_FACTORY_ADDRESS;

      const rpcUrl = this.getRpcUrl();
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const factory = new ethers.Contract(
        factoryAddress,
        AERODROME_POOL_FACTORY_ABI,
        provider,
      );

      const poolAddress = await factory['getPool(address,address,bool)'](
        tokenA,
        tokenB,
        isStable,
      );

      return poolAddress;
    } catch (error) {
      console.error('Error checking pool:', error);
      return ethers.ZeroAddress as Address;
    }
  }

  public async getPool(
    tokenA: Address,
    tokenB: Address,
  ): Promise<AerodromePool> {
    const publicClient = this.getRpcClient();

    const address = await this.getPoolAddress({
      tokenA,
      tokenB,
    });

    if (!address || address === zeroAddress) {
      throw new Error(`No pool found for ${tokenA} -> ${tokenB}`);
    }

    const [token0, token1] = (await publicClient.readContract({
      address,
      abi: AERODROME_POOL_ABI,
      functionName: 'tokens',
    })) as [Address, Address];

    const [token0Balance, token1Balance] = (await Promise.all([
      publicClient.readContract({
        address: token0,
        abi: ERC20_SIMPLE_ABI,
        functionName: 'balanceOf',
        args: [address],
      }),
      publicClient.readContract({
        address: token1,
        abi: ERC20_SIMPLE_ABI,
        functionName: 'balanceOf',
        args: [address],
      }),
    ])) as [bigint, bigint];

    const pool = {
      address,
      token0,
      token1,
      liquidity0: token0Balance,
      liquidity1: token1Balance,
    };

    return pool;
  }

  public async findShortestViablePath({
    amountIn,
    tokenIn,
    tokenInPrice,
    tokenOut,
    tokenOutPrice,
  }: {
    amountIn: bigint;
    tokenIn: Address;
    tokenInPrice: number;
    tokenOut: Address;
    tokenOutPrice: number;
  }): Promise<{ routes: AerodromeRoute[]; minAmountOut: bigint }> {
    try {
      const { routes, minAmountOut } = await this.findSingleHopPath({
        amountIn,
        tokenIn,
        tokenInPrice,
        tokenOut,
        tokenOutPrice,
      });

      return { routes, minAmountOut };
    } catch {
      const { routes, minAmountOut } = await this.findMultiHopPath({
        amountIn,
        tokenIn,
        tokenOut,
      });

      return { routes, minAmountOut };
    }
  }

  public async findSingleHopPath({
    tokenIn,
    tokenInPrice,
    tokenOut,
    tokenOutPrice,
    amountIn,
  }: {
    tokenIn: Address;
    tokenInPrice: number;
    tokenOut: Address;
    tokenOutPrice: number;
    amountIn: bigint;
  }): Promise<{ routes: AerodromeRoute[]; minAmountOut: bigint }> {
    const { address, token0, token1, liquidity0, liquidity1 } =
      await this.getPool(tokenIn, tokenOut);

    if (!address || address === zeroAddress) {
      throw new Error('No single-hop pool');
    }

    const publicClient = this.getRpcClient();

    const [dec0, dec1] = (await Promise.all([
      publicClient.readContract({
        address: token0,
        abi: ERC20_SIMPLE_ABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: token1,
        abi: ERC20_SIMPLE_ABI,
        functionName: 'decimals',
      }),
    ])) as [number, number];

    const isTokenInToken0 = getAddress(token0) === getAddress(tokenIn);

    const tokenInLiquidity = isTokenInToken0 ? liquidity0 : liquidity1;
    const tokenOutLiquidity = isTokenInToken0 ? liquidity1 : liquidity0;

    const tokenInDecimals = isTokenInToken0 ? dec0 : dec1;
    const tokenOutDecimals = isTokenInToken0 ? dec1 : dec0;

    const tokenInLiquidityUsd =
      Number(formatUnits(tokenInLiquidity, tokenInDecimals)) * tokenInPrice;

    const tokenOutLiquidityUsd =
      Number(formatUnits(tokenOutLiquidity, tokenOutDecimals)) * tokenOutPrice;

    if (
      tokenInLiquidityUsd < MIN_POOL_LIQUIDITY_USD ||
      tokenOutLiquidityUsd < MIN_POOL_LIQUIDITY_USD
    ) {
      throw new Error('Pools too shallow for single hop');
    }

    const { result: quote } = await publicClient.simulateContract({
      address,
      abi: AERODROME_POOL_ABI,
      functionName: 'quote',
      args: [tokenIn, amountIn, DEFAULT_GRANULARITY],
    });

    const route: AerodromeRoute = {
      from: tokenIn,
      to: tokenOut,
      stable: false,
      factory: AERODROME_POOL_FACTORY_ADDRESS,
    };

    console.log('Single hop pool: ', address);

    return { minAmountOut: quote, routes: [route] };
  }

  public async findMultiHopPath({
    tokenIn,
    amountIn,
    tokenOut,
  }: {
    tokenIn: Address;
    amountIn: bigint;
    tokenOut: Address;
  }): Promise<{ routes: AerodromeRoute[]; minAmountOut: bigint }> {
    const chain = MobulaChain.BASE;
    const WETH = WRAPPED_NATIVE_ADDRESSES[chain];
    const USDC = USDC_ADDRESSES[chain];

    const isSwapToUSDC = getAddress(tokenOut) === getAddress(USDC);
    const targetToken = isSwapToUSDC ? tokenIn : tokenOut;

    const publicClient = this.getRpcClient();

    const { address: wethUsdcPoolAddress } = await this.getPool(USDC, WETH);
    const { address: wethTokenPoolAddress } = await this.getPool(
      targetToken,
      WETH,
    );

    console.log(
      `Multi hop pools: WETH/USDC -> ${wethUsdcPoolAddress} | WETH/TOKEN -> ${wethTokenPoolAddress}`,
    );

    if (isSwapToUSDC) {
      const { result: wethTokenQuote } = await publicClient.simulateContract({
        address: wethTokenPoolAddress,
        abi: AERODROME_POOL_ABI,
        functionName: 'quote',
        args: [tokenIn, amountIn, DEFAULT_GRANULARITY],
      });

      const { result: usdcQuote } = await publicClient.simulateContract({
        address: wethUsdcPoolAddress,
        abi: AERODROME_POOL_ABI,
        functionName: 'quote',
        args: [WETH, wethTokenQuote, DEFAULT_GRANULARITY],
      });

      const tokenWethRoute: AerodromeRoute = {
        from: targetToken,
        to: WETH,
        stable: false,
        factory: AERODROME_POOL_FACTORY_ADDRESS,
      };

      const wethUsdcRoute: AerodromeRoute = {
        from: WETH,
        to: USDC,
        stable: false,
        factory: AERODROME_POOL_FACTORY_ADDRESS,
      };

      return {
        routes: [tokenWethRoute, wethUsdcRoute],
        minAmountOut: usdcQuote,
      };
    }

    const { result: wethQuote } = await publicClient.simulateContract({
      address: wethUsdcPoolAddress,
      abi: AERODROME_POOL_ABI,
      functionName: 'quote',
      args: [USDC, amountIn, DEFAULT_GRANULARITY],
    });

    const { result: tokenQuote } = await publicClient.simulateContract({
      address: wethTokenPoolAddress,
      abi: AERODROME_POOL_ABI,
      functionName: 'quote',
      args: [WETH, wethQuote, DEFAULT_GRANULARITY],
    });

    const wethUsdcRoute: AerodromeRoute = {
      from: USDC,
      to: WETH,
      stable: false,
      factory: AERODROME_POOL_FACTORY_ADDRESS,
    };

    const tokenWethRoute: AerodromeRoute = {
      from: WETH,
      to: targetToken,
      stable: false,
      factory: AERODROME_POOL_FACTORY_ADDRESS,
    };

    return {
      routes: [wethUsdcRoute, tokenWethRoute],
      minAmountOut: tokenQuote,
    };
  }

  public getRpcClient() {
    return createPublicClient({
      chain: base,
      transport: http(this.getRpcUrl()),
    });
  }

  private getRpcUrl(): string {
    const chain = MobulaChain.BASE;
    const rpcUrl = this.config.rpcUrls[chain];

    if (!rpcUrl) {
      throw new Error(`No RPC URL found for ${chain}`);
    }

    return rpcUrl;
  }
}

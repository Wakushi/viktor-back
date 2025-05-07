import { Inject, Injectable, Logger } from '@nestjs/common';
import { TokenWeekAnalysisResult } from '../analysis/entities/analysis.type';
import { SupabaseService } from '../supabase/supabase.service';
import { getAllocationRatio } from '../analysis/helpers/utils';
import {
  Address,
  createPublicClient,
  createWalletClient,
  Hex,
  http,
  parseUnits,
  getAddress,
  Chain,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, arbitrum, mainnet } from 'viem/chains';
import { RpcUrlConfig } from '../uniswap-v3/entities/rpc-url-config.type';
import {
  MobulaChain,
  MobulaExtendedToken,
  MobulaMultiDataToken,
  TokenBalanceAsset,
} from '../mobula/entities/mobula.entities';
import {
  ERC20_SIMPLE_ABI,
  VIKTOR_ASW_ABI,
  VIKTOR_ASW_CONTRACT_ADDRESSES,
} from './contracts/constants';
import {
  BLOCK_EXPLORER_TX_URL,
  USDC_DECIMALS,
  USDT_ADDRESSES,
} from 'src/shared/utils/constants';
import { USDC_ADDRESSES } from 'src/shared/utils/constants';
import { QuotedToken, Swap } from './entities/swap.type';
import { LogGateway } from 'src/shared/services/log-gateway';
import { Collection } from '../supabase/entities/collections.type';
import { MobulaService } from '../mobula/mobula.service';
import { UniswapV3Service } from '../uniswap-v3/uniswap-v3.service';
import { applySlippage } from 'src/shared/utils/helpers';
import { MIN_USD_AMOUNT_TO_ALLOCATE } from './constants';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  private readonly INITIAL_SLIPPAGE_PERCENT = 0.005;
  private readonly MAX_SLIPPAGE_PERCENT = 0.01;
  private readonly MAX_DIFFERENCE_PERCENT = 0.05;

  constructor(
    @Inject('TRANSACTION_CONFIG')
    private readonly config: {
      privateKey: Hex;
      rpcUrls: RpcUrlConfig;
    },
    private readonly supabaseService: SupabaseService,
    private readonly logGateway: LogGateway,
    private readonly mobulaService: MobulaService,
    private readonly uniswapV3Service: UniswapV3Service,
  ) {
    const { rpcUrls, privateKey } = config;

    if (!rpcUrls || !privateKey) {
      throw new Error('Expected RPC URLs and private key');
    }
  }

  public async getSwaps(): Promise<Swap[]> {
    const { data, error } = await this.supabaseService.client
      .from(Collection.SWAPS)
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  public async buyTokens(
    results: TokenWeekAnalysisResult[],
    fearAndGreed: number,
  ): Promise<TokenWeekAnalysisResult[]> {
    if (!results?.length || !fearAndGreed) return;

    const tokenByChain: Map<MobulaChain, TokenWeekAnalysisResult[]> = new Map();
    const resultByTokenId: Map<number, TokenWeekAnalysisResult> = new Map();
    const tokenBought: TokenWeekAnalysisResult[] = [];

    const latestTokenMetrics = await this.mobulaService.getTokenMultiData(
      results.map((result) => result.token.token_id),
    );

    for (const result of results) {
      const { blockchain } = result.token.contracts[0];

      if (!tokenByChain.has(blockchain)) {
        tokenByChain.set(blockchain, []);
      }

      tokenByChain.get(blockchain)?.push(result);
      resultByTokenId.set(result.token.token_id, result);
    }

    for (const [chain] of tokenByChain.entries()) {
      const tokenResults = tokenByChain.get(chain);

      const totalUsdToAllocate = await this.getTotalUsdToAllocate(
        chain,
        tokenResults,
        fearAndGreed,
      );

      this.log(`Allocating ${totalUsdToAllocate} USDC on ${chain}`);

      const quotedTokens = await this.getQuotedTokens({
        results: tokenResults,
        totalUsdToAllocate,
        chain,
        latestTokenMetrics,
      });

      for (const quotedToken of quotedTokens) {
        try {
          const minTokenAmountOutWithSlippage = applySlippage(
            quotedToken.minAmountOut,
            this.INITIAL_SLIPPAGE_PERCENT,
          );

          const outputPriceWithSlippage =
            Number(
              formatUnits(
                minTokenAmountOutWithSlippage,
                quotedToken.token.decimals,
              ),
            ) * quotedToken.token.price;

          const percentage =
            Math.abs(quotedToken.usdAmountAllocated - outputPriceWithSlippage) /
            quotedToken.usdAmountAllocated;

          if (
            quotedToken.usdAmountAllocated > outputPriceWithSlippage &&
            percentage > this.MAX_DIFFERENCE_PERCENT
          ) {
            this.log(
              `Skipping swap for ${quotedToken.token.name} on ${chain} (Will pay ${quotedToken.usdAmountAllocated} USDC for value of ${outputPriceWithSlippage} USDC) (Difference: ${(percentage * 100).toFixed(2)}%)`,
            );
            continue;
          }

          const { token, usdAmountAllocated } = quotedToken;

          const swap = await this.executeSwap({
            chainName: chain,
            path: quotedToken.path,
            tokenIn: getAddress(USDC_ADDRESSES[chain]),
            tokenOut: getAddress(token.contracts[0].address),
            amountIn: parseUnits(usdAmountAllocated.toString(), USDC_DECIMALS),
            minAmountOut: minTokenAmountOutWithSlippage,
          });

          this.log(
            `Bought ${Number(formatUnits(minTokenAmountOutWithSlippage, token.decimals)).toFixed(2)} $${token.symbol} (value: ${outputPriceWithSlippage.toFixed(2)} USDC) for ${quotedToken.usdAmountAllocated.toFixed(2)} USDC`,
          );

          await this.supabaseService.insertSingle<Swap>(Collection.SWAPS, swap);

          this.log(
            `Swap executed: ${BLOCK_EXPLORER_TX_URL[chain]}/${swap.transaction_hash}`,
          );

          const tokenResult = resultByTokenId.get(quotedToken.token.token_id);
          tokenBought.push(tokenResult);
        } catch (error) {
          this.logger.error(error);
        }
      }
    }

    this.log(`Buying tokens completed !`);
    return tokenBought;
  }

  public async sellPastAnalysisTokens(
    results: TokenWeekAnalysisResult[],
  ): Promise<void> {
    if (!results?.length) return;

    const tokenByChain: Map<MobulaChain, TokenWeekAnalysisResult[]> = new Map();

    for (const result of results) {
      const { blockchain } = result.token.contracts[0];

      if (!tokenByChain.has(blockchain)) {
        tokenByChain.set(blockchain, []);
      }

      tokenByChain.get(blockchain)?.push(result);
    }

    for (const [chain] of tokenByChain.entries()) {
      const tokens = tokenByChain.get(chain);

      for (const token of tokens) {
        try {
          const { blockchain, address: tokenAddress } =
            token.token.contracts[0];

          if (!blockchain || !tokenAddress) continue;

          await this.sellToken({
            chain,
            tokenAddress: getAddress(tokenAddress),
            token: token.token,
          });
        } catch (error) {
          this.logger.error(error);
        }
      }
    }
  }

  private async sellToken({
    chain,
    tokenAddress,
    token,
  }: {
    chain: MobulaChain;
    tokenAddress: Address;
    token: MobulaExtendedToken | TokenBalanceAsset;
  }): Promise<void> {
    this.log(`Preparing to sell ${token.name}`);

    const tokenAmount = await this.getERC20Balance(
      chain,
      getAddress(tokenAddress),
    );

    if (!tokenAmount || tokenAmount === BigInt(0)) {
      this.log(`No balance found for ${token.name}`);
      return;
    }

    const tokenMarketData = await this.mobulaService.getTokenMarketDataById(
      (token as MobulaExtendedToken)?.token_id ?? token.id,
    );

    if (!tokenMarketData) return;

    const { path, minAmountOut } =
      await this.uniswapV3Service.findShortestViablePath({
        chain,
        tokenIn: getAddress(tokenAddress),
        amountIn: tokenAmount,
        tokenOut: USDC_ADDRESSES[chain],
        tokenOutDecimals: USDC_DECIMALS,
        tokenOutPrice: 1,
      });

    const contract = tokenMarketData.contracts.find(
      (c) => c.blockchain === chain,
    );

    if (!contract) {
      throw new Error(`Can't find contract for ${token.name} on ${chain}`);
    }

    const tokenTotalPrice =
      tokenMarketData.price *
      Number(formatUnits(tokenAmount, contract.decimals));

    let slippage = this.INITIAL_SLIPPAGE_PERCENT;
    let success = false;

    while (!success && slippage <= this.MAX_SLIPPAGE_PERCENT) {
      try {
        const minUsdcAmountOutWithSlippage = applySlippage(
          minAmountOut,
          slippage,
        );

        const expectedUsdcAmount = Number(
          formatUnits(minUsdcAmountOutWithSlippage, USDC_DECIMALS),
        );

        const percentage =
          Math.abs(tokenTotalPrice - expectedUsdcAmount) / tokenTotalPrice;

        if (
          tokenTotalPrice > expectedUsdcAmount &&
          percentage > this.MAX_DIFFERENCE_PERCENT
        ) {
          this.log(
            `Skipping swap for ${token.name} (Will sell for ${tokenTotalPrice.toFixed(2)} USDC for value of ${expectedUsdcAmount} USDC) (Difference: ${(percentage * 100).toFixed(2)}%)`,
          );
          return;
        }

        const swap = await this.executeSwap({
          chainName: chain,
          path,
          tokenIn: getAddress(tokenAddress),
          tokenOut: USDC_ADDRESSES[chain],
          amountIn: tokenAmount,
          minAmountOut: minUsdcAmountOutWithSlippage,
        });

        const tokenDecimals =
          typeof token.decimals === 'string'
            ? token.decimals
            : token.decimals[0];

        this.log(
          `Sold ${formatUnits(tokenAmount, tokenDecimals)} ${token.name} (${token.symbol}) on ${chain} for ${expectedUsdcAmount} USDC`,
        );

        this.log(
          `Swap executed: ${BLOCK_EXPLORER_TX_URL[chain]}/${swap.transaction_hash}`,
        );

        await this.supabaseService.insertSingle<Swap>(Collection.SWAPS, swap);

        success = true;
      } catch (error) {
        slippage += 0.0005;
      }
    }

    if (!success) {
      this.log(`Failed to sell ${token.name} (${token.symbol}) on ${chain}`);
    }

    this.log(`Selling tokens completed !`);
  }

  private async executeSwap({
    chainName,
    path,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
  }: {
    chainName: MobulaChain;
    path: Hex;
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    minAmountOut: bigint;
  }): Promise<Swap> {
    try {
      const account = privateKeyToAccount(this.config.privateKey);
      const chain = this.getChain(chainName);
      const rpcUrl = this.getRpcUrl(chainName);
      const viktorAswContractAddress = VIKTOR_ASW_CONTRACT_ADDRESSES[chainName];

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      const { request } = await publicClient.simulateContract({
        account,
        address: viktorAswContractAddress,
        abi: VIKTOR_ASW_ABI,
        functionName: 'swapTokens',
        args: [path, amountIn, minAmountOut],
      });

      const gasEstimate = await publicClient.estimateContractGas({
        account,
        address: viktorAswContractAddress,
        abi: VIKTOR_ASW_ABI,
        functionName: 'swapTokens',
        args: [path, amountIn, minAmountOut],
      });

      const gasWithBuffer = (gasEstimate * 12n) / 10n;

      const txHash = await walletClient.writeContract({
        ...request,
        gas: gasWithBuffer,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status !== 'success') {
        throw new Error(`Transaction reverted: ${txHash}`);
      }

      const swap: Swap = {
        chain: chainName,
        path,
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: amountIn.toString(),
        amount_out: minAmountOut.toString(),
        transaction_hash: txHash,
      };

      return swap;
    } catch (error: any) {
      throw new Error(error);
    }
  }

  private async getQuotedTokens({
    results,
    totalUsdToAllocate,
    chain,
    latestTokenMetrics,
  }: {
    results: TokenWeekAnalysisResult[];
    totalUsdToAllocate: number;
    chain: MobulaChain;
    latestTokenMetrics: MobulaMultiDataToken[];
  }): Promise<QuotedToken[]> {
    if (!results?.length) return [];

    results.sort((a, b) => b.confidence - a.confidence);

    const totalConfidence = results.reduce(
      (sum, curr) => sum + curr.confidence,
      0,
    );

    const quotedTokens: QuotedToken[] = [];

    for (const result of results) {
      const resultConfidencePct = result.confidence / totalConfidence;

      const usdAmountAllocated = resultConfidencePct * totalUsdToAllocate;

      if (usdAmountAllocated < MIN_USD_AMOUNT_TO_ALLOCATE) {
        return await this.getQuotedTokens({
          results: results.slice(0, results.length - 1),
          totalUsdToAllocate,
          chain,
          latestTokenMetrics,
        });
      }

      const tokenPriceUsd =
        latestTokenMetrics.find((token) => token.id === result.token.token_id)
          ?.price ?? 0;

      const tokenAmountToBuy =
        tokenPriceUsd > 0 ? usdAmountAllocated / tokenPriceUsd : 0;

      try {
        const tokenAddress = getAddress(result.token.contracts[0].address);

        const { path, minAmountOut } =
          await this.uniswapV3Service.findShortestViablePath({
            chain,
            tokenIn: USDC_ADDRESSES[chain],
            tokenOut: tokenAddress,
            amountIn: parseUnits(usdAmountAllocated.toString(), USDC_DECIMALS),
            tokenOutDecimals: result.token.decimals,
            tokenOutPrice: tokenPriceUsd,
          });

        quotedTokens.push({
          token: result.token,
          usdAmountAllocated,
          tokenAmountToBuy,
          minAmountOut,
          path,
        });
      } catch (error) {
        this.log(
          `Error quoting ${result.token.name}: ${error?.message || error}`,
        );
        return await this.getQuotedTokens({
          results: results.filter(
            ({ token }) => token.token_id !== result.token.token_id,
          ),
          totalUsdToAllocate,
          chain,
          latestTokenMetrics,
        });
      }
    }

    return quotedTokens;
  }

  private async getERC20Balance(
    chainName: MobulaChain,
    address: Address,
  ): Promise<bigint> {
    const chain = this.getChain(chainName);
    const rpcUrl = this.getRpcUrl(chainName);
    const viktorAswContractAddress = VIKTOR_ASW_CONTRACT_ADDRESSES[chainName];

    try {
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      const balance = (await publicClient.readContract({
        address,
        abi: ERC20_SIMPLE_ABI,
        functionName: 'balanceOf',
        args: [viktorAswContractAddress],
      })) as bigint;

      return balance;
    } catch (error) {
      this.logger.error(error);
      return BigInt(0);
    }
  }

  private async getTotalUsdToAllocate(
    chain: MobulaChain,
    tokenResults: TokenWeekAnalysisResult[],
    fearAndGreed: number,
  ): Promise<number> {
    const usdcBalance = await this.getERC20Balance(
      chain,
      USDC_ADDRESSES[chain],
    );

    if (!usdcBalance || usdcBalance === BigInt(0)) {
      this.log(`No USDC balance on ${chain}`);
      return 0;
    }

    const totalConfidence = tokenResults.reduce(
      (sum, curr) => sum + curr.confidence,
      0,
    );

    const avgConfidence = totalConfidence / tokenResults.length;
    const ratio = getAllocationRatio(avgConfidence, fearAndGreed);

    return Number(formatUnits(usdcBalance, USDC_DECIMALS)) * ratio;
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

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }

  public async sellAllTokens(chain: MobulaChain) {
    const portfolio = await this.mobulaService.getWalletPortfolio(
      VIKTOR_ASW_CONTRACT_ADDRESSES[chain],
      chain,
    );

    const NOT_SELLABLE_TOKENS = [USDC_ADDRESSES[chain], USDT_ADDRESSES[chain]];

    const sellableTokens = portfolio.filter((token) => {
      return (
        token.token_balance > 0 &&
        !token.asset.contracts.some((contract) =>
          NOT_SELLABLE_TOKENS.includes(getAddress(contract)),
        )
      );
    });

    for (const token of sellableTokens) {
      this.log(
        `Selling ${token.token_balance.toFixed(2)} ${token.asset.name} (${token.asset.symbol}) on ${chain}`,
      );

      await this.sellToken({
        chain,
        tokenAddress: getAddress(token.asset.contracts[0]),
        token: token.asset,
      });
    }
  }

  public async test() {
    // await this.sellAllTokens(MobulaChain.BASE);
  }
}

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
import { MobulaChain } from '../mobula/entities/mobula.entities';
import {
  ERC20_SIMPLE_ABI,
  VIKTOR_ASW_ABI,
  VIKTOR_ASW_CONTRACT_ADDRESSES,
} from './contracts/constants';
import {
  BLOCK_EXPLORER_TX_URL,
  USDC_DECIMALS,
} from 'src/shared/utils/constants';
import { USDC_ADDRESSES } from 'src/shared/utils/constants';
import { Swap } from './entities/swap.type';
import { LogGateway } from 'src/shared/services/log-gateway';
import { Collection } from '../supabase/entities/collections.type';
import { MobulaService } from '../mobula/mobula.service';
import { UniswapV3Service } from '../uniswap-v3/uniswap-v3.service';
import { applySlippage } from 'src/shared/utils/helpers';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  private readonly SLIPPAGE_PERCENT = 0.001;

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

  public async buyTokens(
    results: TokenWeekAnalysisResult[],
    fearAndGreed: number,
  ): Promise<void> {
    if (!results?.length || !fearAndGreed) return;

    const tokenByChain: Map<MobulaChain, TokenWeekAnalysisResult[]> = new Map();

    const latestData = await this.mobulaService.getTokenMultiData(
      results.map((result) => result.token.token_id),
    );

    for (const result of results) {
      const { blockchain } = result.token.contracts[0];

      if (!tokenByChain.has(blockchain)) {
        tokenByChain.set(blockchain, []);
      }

      tokenByChain.get(blockchain)?.push(result);
    }

    for (const [chain] of tokenByChain.entries()) {
      const usdcBalance = await this.getERC20Balance(
        chain,
        USDC_ADDRESSES[chain],
      );

      if (!usdcBalance || usdcBalance === BigInt(0)) continue;

      const tokens = tokenByChain.get(chain);

      const totalConfidence = tokens.reduce(
        (sum, curr) => sum + curr.confidence,
        0,
      );

      const avgConfidence = totalConfidence / tokens.length;
      const ratio = getAllocationRatio(avgConfidence, fearAndGreed);

      const totalUsdToAllocate =
        Number(formatUnits(usdcBalance, USDC_DECIMALS)) * ratio;

      this.log(`Allocating ${totalUsdToAllocate} USDC on ${chain}`);

      const tokensAllocations = tokens.map((result) => {
        const pct = result.confidence / totalConfidence;

        const usdAmount = pct * totalUsdToAllocate;

        const tokenPriceUsd =
          latestData.find((data) => data.id === result.token.token_id)?.price ??
          0;

        const tokenAmountToBuy =
          tokenPriceUsd > 0 ? usdAmount / tokenPriceUsd : 0;

        return {
          token: result.token,
          usdAmount,
          tokenAmountToBuy,
        };
      });

      for (const tokenAllocation of tokensAllocations) {
        try {
          const { blockchain, address: tokenAddress } =
            tokenAllocation.token.contracts[0];

          if (!blockchain || !tokenAddress) continue;

          const usdcAddress: Address = getAddress(USDC_ADDRESSES[blockchain]);

          const amountIn = parseUnits(
            tokenAllocation.usdAmount.toString(),
            USDC_DECIMALS,
          );

          const minAmountOut = await this.uniswapV3Service.getUniswapQuote({
            chain: blockchain,
            tokenIn: usdcAddress,
            tokenOut: getAddress(tokenAddress),
            amountIn,
          });

          const minAmountOutWithSlippage = applySlippage(
            minAmountOut,
            this.SLIPPAGE_PERCENT,
          );

          const swap = await this.executeSwap({
            chainName: blockchain,
            tokenIn: usdcAddress,
            tokenOut: getAddress(tokenAddress),
            amountIn,
            minAmountOut: minAmountOutWithSlippage,
          });

          await this.supabaseService.insertSingle<Swap>(Collection.SWAPS, swap);

          this.log(
            `Swap executed: ${BLOCK_EXPLORER_TX_URL[blockchain]}/${swap.transaction_hash}`,
          );
        } catch (error) {
          this.logger.error(error);
        }
      }
    }
  }

  public async sellTokens(results: TokenWeekAnalysisResult[]): Promise<void> {
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

          const tokenAmount = await this.getERC20Balance(
            chain,
            getAddress(tokenAddress),
          );

          if (!tokenAmount || tokenAmount === BigInt(0)) continue;

          const minAmountOut = await this.uniswapV3Service.getUniswapQuote({
            chain: blockchain,
            tokenIn: getAddress(tokenAddress),
            tokenOut: USDC_ADDRESSES[blockchain],
            amountIn: tokenAmount,
          });

          const minAmountOutWithSlippage = applySlippage(
            minAmountOut,
            this.SLIPPAGE_PERCENT,
          );

          this.log(
            `Selling ${formatUnits(tokenAmount, token.token.decimals)} ${token.token.name} (${token.token.symbol}) on ${blockchain} for ${formatUnits(minAmountOutWithSlippage, USDC_DECIMALS)} USDC`,
          );

          const swap = await this.executeSwap({
            chainName: blockchain,
            tokenIn: getAddress(tokenAddress),
            tokenOut: USDC_ADDRESSES[blockchain],
            amountIn: tokenAmount,
            minAmountOut: minAmountOutWithSlippage,
          });

          this.log(
            `Swap executed: ${BLOCK_EXPLORER_TX_URL[blockchain]}/${swap.transaction_hash}`,
          );

          await this.supabaseService.insertSingle<Swap>(Collection.SWAPS, swap);
        } catch (error) {
          this.logger.error(error);
        }
      }
    }
  }

  private async executeSwap({
    chainName,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
  }: {
    chainName: MobulaChain;
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
        functionName: 'swapExactInputSingleHop',
        args: [tokenIn, tokenOut, amountIn, minAmountOut],
      });

      const result = await walletClient.writeContract(request);

      const swap: Swap = {
        chain: chainName,
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: amountIn.toString(),
        amount_out: minAmountOut.toString(),
        transaction_hash: result,
      };

      return swap;
    } catch (error: any) {
      this.logger.error(error);
      throw new Error(error);
    }
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
}

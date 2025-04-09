import { Injectable, Logger } from '@nestjs/common';
import {
  calculateBuyingConfidence,
  calculateDecisionTypeStats,
  calculateProfitabilityScore,
} from './helpers/decision-computation';
import { TokensService } from '../tokens/tokens.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Analysis,
  MINIMUM_SAMPLE_CONFIDENCE,
  TokenAnalysisResult,
  TokenPerformance,
} from './entities/analysis-result.type';

import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import {
  MobulaExtendedToken,
  SwapTransaction,
} from '../mobula/entities/mobula.entities';
import { MobulaService } from '../mobula/mobula.service';
import { getAddress } from 'viem';
import {
  BLACKLISTED_ADDRESSES,
  SUPPORTED_CHAIN_IDS,
} from '../mobula/constants';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly tokensService: TokensService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
    private readonly mobulaService: MobulaService,
  ) {}

  public async seekMarketBuyingTargets(): Promise<TokenAnalysisResult[]> {
    try {
      this.logger.log('Started token search...');

      const tokens: MobulaExtendedToken[] =
        await this.tokensService.discoverTokens();

      this.logger.log(
        `Discovered ${tokens.length} tokens ! Starting analysis...`,
      );

      const analysis: TokenAnalysisResult[] = await this.analyzeTokens(tokens);

      this.logger.log(
        `Analysis completed ! ${analysis.length} results available.`,
      );

      return analysis;
    } catch (error) {
      console.error('Error while seeking market buying targets :', error);
      return [];
    }
  }

  private async analyzeTokens(
    tokens: MobulaExtendedToken[],
  ): Promise<TokenAnalysisResult[]> {
    this.logger.log(`Initiating analysis of ${tokens.length} tokens...`);

    const SIMILARITY_THRESHOLD = 0.7;
    const MATCH_COUNT = 40;
    const MINIMUM_CONFIDENCE_TO_BUY = 0.7;
    const PROFITABLE_THRESHOLD = 0.65;

    const WEIGHTS = {
      decisionTypeRatio: 0.3,
      similarity: 0.35,
      profitability: 0.25,
      confidence: 0.1,
    };

    const analysisResults: TokenAnalysisResult[] = [];

    let batchSize = 5;
    let batchCounter = 1;

    const BATCH_SUCCESS_THRESHOLD = 5;
    const BATCH_FAIL_THRESHOLD = -5;
    const batchRates: Map<number, number> = new Map();

    while (tokens.length) {
      const batch = tokens.splice(0, batchSize);

      this.logger.log(
        `Analyzing token batch ${batchCounter} (${tokens.length} tokens remaining)`,
      );

      try {
        const results: TokenAnalysisResult[] = await Promise.all(
          batch.map(async (token) => {
            const embeddingText =
              this.embeddingService.getEmbeddingTextFromObservation(token);

            const similarConditions =
              await this.embeddingService.findNearestMatch({
                query: embeddingText,
                matchThreshold: SIMILARITY_THRESHOLD,
                matchCount: MATCH_COUNT,
              });

            const allDecisions = await Promise.all(
              similarConditions.map(async (condition) => {
                const decision =
                  await this.supabaseService.getDecisionByMarketObservationId(
                    condition.id,
                  );

                if (!decision) return;

                return {
                  marketCondition: condition,
                  decision,
                  similarity: condition.similarity,
                  profitabilityScore: calculateProfitabilityScore(decision),
                };
              }),
            );

            const decisions = allDecisions.filter((d) => d);

            if (decisions.length === 0) return;

            const decisionStats = calculateDecisionTypeStats(
              decisions,
              PROFITABLE_THRESHOLD,
            );

            const buyingConfidence = calculateBuyingConfidence(
              decisions,
              decisionStats,
              WEIGHTS,
            );

            return {
              token,
              textObservation: embeddingText,
              buyingConfidence,
              similarDecisionsAmount: decisions.length,
              decisionTypeRatio: decisionStats,
            };
          }),
        );

        analysisResults.push(...results);
        batchCounter++;

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) + 1;

        if (newRate >= BATCH_SUCCESS_THRESHOLD) {
          batchSize++;
          this.logger.log(`Increasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 1);
        } else {
          batchRates.set(batchSize, newRate);
        }
      } catch (error) {
        this.logger.error(error);

        if (!batchRates.has(batchSize)) {
          batchRates.set(batchSize, 0);
        }

        const newRate = batchRates.get(batchSize) - 1;

        if (newRate <= BATCH_FAIL_THRESHOLD) {
          batchSize--;
          this.logger.log(`Decreasing batch size to ${batchSize}`);
          batchRates.set(batchSize, 0);
        } else {
          batchRates.set(batchSize, newRate);
        }

        this.logger.warn(`Adding back ${batch.length} tokens to pool..`);
        tokens.push(...batch);
      }
    }

    return analysisResults
      .filter((result) => {
        return (
          result &&
          result.buyingConfidence.score >= MINIMUM_CONFIDENCE_TO_BUY &&
          result.buyingConfidence.sampleSizeConfidence >=
            MINIMUM_SAMPLE_CONFIDENCE
        );
      })
      .sort((a, b) => b.buyingConfidence.score - a.buyingConfidence.score);
  }

  public async evaluatePastAnalysis(date?: Date) {
    try {
      this.logger.log("Fetching yesterday's analysis..");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const formattedAnalysis =
        await this.supabaseService.getAnalysisResultsByDate(date || yesterday);

      if (!formattedAnalysis) return;

      const analysis: Analysis = JSON.parse(formattedAnalysis.analysis);

      this.logger.log('Fetching current prices..');

      const tokenIds = analysis.analysis
        .map((data) => data.token.token_id)
        .filter(Boolean);

      const currentMarketData =
        await this.tokensService.getMultiTokenByMobulaIds(tokenIds);

      this.logger.log('Computing performances..');

      const performances: TokenPerformance[] = [];

      for (let i = 0; i < analysis.analysis.length; i++) {
        const result = analysis.analysis[i];
        const current = currentMarketData.find(
          (t) => t.id === result.token.token_id,
        );

        if (!current) continue;

        const initialPrice = result.token.price;
        const currentPrice = current.price;

        let priceChange = currentPrice - initialPrice;
        let percentageChange = (priceChange / initialPrice) * 100;

        performances.push({
          token: result.token.name,
          initialPrice,
          currentPrice,
          priceChange,
          percentageChange,
        });
      }

      const stringifiedPerformance = JSON.stringify(performances);

      this.logger.log('Saving performances..');

      this.supabaseService.updateAnalysisResults({
        ...formattedAnalysis,
        performance: stringifiedPerformance,
      });
    } catch (error) {
      this.logger.error("Failed to evaluate yesterday's analysis");
      this.logger.error(error);
    }
  }

  public async getFearAndGreed(): Promise<string> {
    return await this.puppeteerService.getFearAndGreed();
  }

  public async compareTradersActivity(
    analysis: TokenAnalysisResult[],
  ): Promise<any> {
    const traders = await this.mobulaService.getSmartMoney();
    const tradersAddresses = traders.map((t) => getAddress(t.wallet_address));

    const analysisTokens = analysis.map((a) => ({
      name: a.token.name,
      tokenId: a.token.token_id,
      contracts: a.token.contracts,
    }));

    const tokenTradeRatio: Map<number, { bought: number; sold: number }> =
      new Map();

    this.logger.log(
      `Starting trader analysis for ${tradersAddresses.length} traders...`,
    );

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const scanStart = Date.now() - 2 * ONE_DAY_MS;

    await Promise.all(
      tradersAddresses.map(async (trader) => {
        if (BLACKLISTED_ADDRESSES.includes(trader)) return;

        const trades = await this.mobulaService.getWalletTrades({
          wallet: trader,
          limit: 100,
        });

        if (!trades) return;

        for (const trade of trades) {
          if (!SUPPORTED_CHAIN_IDS.includes(trade.chain_id)) continue;

          const tradeDate = new Date(trade.date);

          if (tradeDate.getTime() < scanStart) continue;

          const token0 = getAddress(trade.token0_address);
          const token1 = getAddress(trade.token1_address);
          const tradeTokens = [token0, token1];

          const tokenMatch = analysisTokens.find((t) =>
            t.contracts.some((c) =>
              tradeTokens.includes(getAddress(c.address)),
            ),
          );

          if (!tokenMatch) continue;

          const contract = tokenMatch.contracts.find((c) => {
            const contractAddress = getAddress(c.address);
            return contractAddress === token0 || contractAddress === token1;
          });

          const tokenAmountTraded =
            getAddress(contract.address) === token0
              ? trade.amount0
              : trade.amount1;

          const hasBought = Number(tokenAmountTraded) > 0;

          const tokenRatio = tokenTradeRatio.get(tokenMatch.tokenId);

          if (!tokenRatio) {
            tokenTradeRatio.set(tokenMatch.tokenId, {
              bought: hasBought ? 1 : 0,
              sold: hasBought ? 0 : 1,
            });
            continue;
          }

          if (hasBought) {
            tokenRatio.bought++;
          } else {
            tokenRatio.sold++;
          }
        }
      }),
    );

    console.log('tokenTradeRatio: ', tokenTradeRatio);

    // tokenTradeRatio:  Map(10) {
    //   100007238 => { bought: 0, sold: 1 },
    //   102499549 => { bought: 14, sold: 17 },
    //   10486 => { bought: 2, sold: 2 },
    //   100001656 => { bought: 3, sold: 5 },
    //   540 => { bought: 0, sold: 14 },
    //   102503855 => { bought: 18, sold: 25 },
    //   3774 => { bought: 1, sold: 1 },
    //   102502670 => { bought: 1, sold: 0 },
    //   100635869 => { bought: 1, sold: 1 },
    //   100002460 => { bought: 1, sold: 0 }
    // }
  }

  public async performTrades(analysis: TokenAnalysisResult[]): Promise<void> {
    // Fetch trading wallet balance
  }

  public async analyzeWarpcastPresence(
    analysis: TokenAnalysisResult[],
    limit = 100,
  ): Promise<void> {
    const BASE_CHANNEL_URL = 'https://onchainsummer.xyz';
    const FARCASTER_CHANNEL_URL =
      'chain://eip155:7777777/erc721:0x4f86113fc3e9783cf3ec9a552cbb566716a57628';

    const urls = [
      `https://hub.pinata.cloud/v1/castsByParent?url=${FARCASTER_CHANNEL_URL}&reverse=true&pageSize=${limit}`,
      `https://hub.pinata.cloud/v1/castsByParent?url=${BASE_CHANNEL_URL}&reverse=true&pageSize=${limit}`,
    ];

    const responses = await Promise.all(urls.map((url) => fetch(url)));

    const allMessagesText: string[] = [];

    for (const response of responses) {
      if (!response.ok) {
        this.logger.error('Error fetching Warpcast data..');
        continue;
      }

      const { messages } = await response.json();
      const texts = messages.map((m: FarcasterCast) => m.data.castAddBody.text);
      allMessagesText.push(...texts);
    }

    const analysisTokens = analysis.map((a) => ({
      tokenId: a.token.token_id,
      name: a.token.name,
      symbol: a.token.symbol,
    }));

    const tokenMentions: Map<number, string[]> = new Map();

    for (const message of allMessagesText) {
      const formatted = message.toLowerCase().replace(/\n/g, '');
      const words = formatted.split(' ');

      for (const token of analysisTokens) {
        const { tokenId, name, symbol } = token;

        if (
          !words.includes(name.toLowerCase()) &&
          !words.includes(`$${symbol.toLowerCase()}`)
        ) {
          continue;
        }

        const mentions = tokenMentions.get(tokenId);

        if (!mentions) {
          tokenMentions.set(tokenId, [message]);
          continue;
        }

        tokenMentions.set(tokenId, [...mentions, message]);
      }
    }

    // TO-DO Analyze each token mentions using a LLM to extract a global sentiment
    console.log('tokenMentions: ', tokenMentions);
  }
}

export interface FarcasterCast {
  data: {
    type: 'MESSAGE_TYPE_CAST_ADD';
    fid: number;
    timestamp: number;
    network: 'FARCASTER_NETWORK_MAINNET' | string;
    castAddBody: {
      embedsDeprecated: any[];
      mentions: number[];
      parentUrl: string;
      text: string;
      mentionsPositions: number[];
      embeds: {
        url: string;
      }[];
      type: 'LONG_CAST' | string;
    };
  };
  hash: string;
  hashScheme: 'HASH_SCHEME_BLAKE3' | string;
  signature: string;
  signatureScheme: 'SIGNATURE_SCHEME_ED25519' | string;
  signer: string;
}

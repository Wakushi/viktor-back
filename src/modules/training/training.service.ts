import { Injectable } from '@nestjs/common';
import { CsvService } from 'src/shared/services/csv.service';
import {
  CoinCodexCsvDailyMetrics,
  CoinCodexTokenData,
} from './entities/coincodex.type';
import { SupplyMetrics } from './entities/supply.type';
import { TokenMarketObservation } from '../tokens/entities/token.type';

@Injectable()
export class TrainingService {
  constructor(private readonly csvService: CsvService) {}

  public async processHistoricalData(
    tokenSymbol: string,
  ): Promise<TokenMarketObservation[]> {
    try {
      const staticSupplyMetrics = await this.fetchSupplyMetrics(tokenSymbol);

      const dailyMetrics = await this.fetchDailyMetrics(tokenSymbol);

      const tokenMarketObservations = this.buildObservationsFromMetrics({
        tokenSymbol,
        dailyMetrics,
        staticSupplyMetrics,
      });

      return tokenMarketObservations;
    } catch (error) {
      console.error('Error processing historical data:', error);
      throw error;
    }
  }

  private async fetchDailyMetrics(
    tokenSymbol: string,
  ): Promise<CoinCodexCsvDailyMetrics[]> {
    const data = await this.csvService.getHistoricalTokenData(
      `${tokenSymbol}.csv`,
    );

    return data;
  }

  private async fetchSupplyMetrics(
    tokenSymbol: string,
  ): Promise<SupplyMetrics> {
    const response = await fetch(
      `https://coincodex.com/api/coincodex/get_coin/${tokenSymbol}`,
    );

    if (!response.ok) {
      throw new Error(`Coin codex API error: ${response.status}`);
    }

    const data: CoinCodexTokenData = await response.json();

    return this.calculateSupplyMetrics(data);
  }

  private calculateSupplyMetrics(data: CoinCodexTokenData): SupplyMetrics {
    const totalSupply = Number(data.total_supply);
    const circulatingSupply = data.supply;

    return {
      fully_diluted_valuation: totalSupply * data.last_price_usd,
      circulating_supply: circulatingSupply,
      total_supply: totalSupply,
      max_supply: totalSupply,
      supply_ratio: circulatingSupply / totalSupply,
    };
  }

  private buildObservationsFromMetrics({
    tokenSymbol,
    dailyMetrics,
    staticSupplyMetrics,
  }: {
    tokenSymbol: string;
    dailyMetrics: CoinCodexCsvDailyMetrics[];
    staticSupplyMetrics: SupplyMetrics;
  }): TokenMarketObservation[] {
    const round = {
      price: (n: number) => Number(n.toFixed(2)),
      percentage: (n: number) => Number(n.toFixed(5)),
      marketCapPercentage: (n: number) => {
        const rounded = Math.abs(n) < 0.0001 ? 0 : Number(n.toFixed(4));
        return Number(rounded.toString().replace(/\.?0+$/, ''));
      },
      integer: (n: number) => Math.round(n),
    };

    let historicalHigh = dailyMetrics[0].Close;
    let historicalLow = dailyMetrics[0].Close;

    return dailyMetrics.map((dailyMetric, index) => {
      const prevDay = index > 0 ? dailyMetrics[index - 1] : null;
      const timestamp = new Date(dailyMetric.Start).getTime();
      const currentPrice = round.price(dailyMetric.Close);

      const ath = round.price(historicalHigh);
      const atl = round.price(historicalLow);

      const ath_change_percentage = round.percentage(
        ((currentPrice - ath) / ath) * 100,
      );

      const atl_change_percentage = round.percentage(
        ((currentPrice - atl) / atl) * 100,
      );

      const price_change_24h = prevDay
        ? round.price(dailyMetric.Close - prevDay.Close)
        : null;

      const price_change_percentage_24h = prevDay
        ? round.percentage(
            ((dailyMetric.Close - prevDay.Close) / prevDay.Close) * 100,
          )
        : null;

      const market_cap_change_24h = prevDay
        ? round.integer(dailyMetric['Market Cap'] - prevDay['Market Cap'])
        : null;

      const market_cap_change_percentage_24h = prevDay
        ? round.marketCapPercentage(
            ((dailyMetric['Market Cap'] - prevDay['Market Cap']) /
              prevDay['Market Cap']) *
              100,
          )
        : null;

      historicalHigh = Math.max(historicalHigh, dailyMetric.Close);
      historicalLow = Math.min(historicalLow, dailyMetric.Close);

      return {
        coin_gecko_id: tokenSymbol.toLowerCase(),
        timestamp,
        created_at: new Date(timestamp),
        market_cap_rank: 1,
        price_usd: currentPrice,
        high_24h: round.price(dailyMetric.High),
        low_24h: round.price(dailyMetric.Low),
        market_cap: round.integer(dailyMetric['Market Cap']),
        total_volume: round.integer(dailyMetric.Volume),

        ath,
        atl,
        ath_change_percentage,
        atl_change_percentage,

        price_change_24h,
        price_change_percentage_24h,
        market_cap_change_24h,
        market_cap_change_percentage_24h,

        fully_diluted_valuation: round.integer(
          dailyMetric.Close * staticSupplyMetrics.total_supply,
        ),
        circulating_supply: staticSupplyMetrics.circulating_supply,
        total_supply: staticSupplyMetrics.total_supply,
        max_supply: staticSupplyMetrics.max_supply,
        supply_ratio: staticSupplyMetrics.supply_ratio,
      };
    });
  }
}

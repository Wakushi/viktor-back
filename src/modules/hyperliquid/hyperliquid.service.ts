import { Injectable } from '@nestjs/common';
import { Address } from 'viem';
import {
  AllMidsResponse,
  DexMetadata,
  InfoRequestPayload,
  UserInfoRequestPayload,
  Order,
  PerpUniverse,
  UniverseAndMetrics,
  UniverseAndMetricsReponse,
  AccountMarginState,
  UserFundingRequestPayload,
  TransferEvent,
} from './entities/hyperliquid.entities';

const MOCK_TRADER_ADDRESS = '0x4206730E2C2281F4dF24c0e588F6C8f5dBAd03BA';

@Injectable()
export class HyperliquidService {
  private readonly MAINNET_API_URL = 'https://api.hyperliquid.xyz/';
  private readonly TESTNET_API_URL = 'https://api.hyperliquid-testnet.xyz/';

  public async test() {
    // await this.getTraderOpenOrders(MOCK_TRADER_ADDRESS);
    const sum = await this.getTraderSummary(MOCK_TRADER_ADDRESS);

    const data = await this.getTraderTransfers({
      user: MOCK_TRADER_ADDRESS,
      startTime: 1740842564000,
      ledgerUpdates: true,
    });

    console.log('data:', data);
  }

  /////////////
  //  INFO   //
  /////////////

  // Global Info
  public async getAllCoinsMids(): Promise<AllMidsResponse> {
    const mids = await this.getInfo<AllMidsResponse>({
      type: 'allMids',
    });

    return mids;
  }

  public async getTraderOpenOrders(user: Address): Promise<Order[]> {
    const openOrders = await this.getInfo<Order[]>({
      type: 'openOrders',
      user,
    });

    return openOrders;
  }

  // Perp Info
  public async getAllPerpDex(): Promise<DexMetadata[]> {
    const dex = await this.getInfo<DexMetadata[]>({
      type: 'perpDexs',
    });

    return dex; // Returns [null] on mainnet
  }

  public async getAllPerpMetadata(): Promise<PerpUniverse> {
    const metadata = await this.getInfo<PerpUniverse>({
      type: 'meta',
    });

    return metadata;
  }

  public async getAllPerpAssetMetrics(): Promise<UniverseAndMetrics> {
    const [metadata, metrics] = await this.getInfo<UniverseAndMetricsReponse>({
      type: 'metaAndAssetCtxs',
    });

    return {
      universe: metadata.universe,
      metrics,
    };
  }

  // User info
  /**
   * @notice Retrieves the margin account summary for a given user.
   * @param user The address of the trader whose margin account summary to fetch.
   * @return A promise that resolves to an object containing:
   * - `marginSummary`: values related to isolated margin (e.g. account value, total notional, margin used),
   * - `crossMarginSummary`: similar metrics but for the cross-margin account,
   * - `crossMaintenanceMarginUsed`: the margin needed to avoid liquidation for cross-margin positions,
   * - `withdrawable`: amount of USDC the user can withdraw right now,
   * - `assetPositions`: a list of current positions (empty if user holds none),
   * - `time`: server timestamp (in milliseconds).
   */
  public async getTraderSummary(user: Address): Promise<AccountMarginState> {
    return await this.getInfo<AccountMarginState>({
      type: 'clearinghouseState',
      user,
    });
  }

  /**
   * @notice Retrieves a list of all wallet interactions for a given user, such as transfers and deposits.
   * @param user The address of the trader whose activity you want to retrieve.
   * @param startTime The start time (in milliseconds since epoch) from which to begin querying activity.
   * @param ledgerUpdates Optional. If true, returns all non-funding ledger updates. If false or omitted, returns only funding-related events.
   * @return A promise that resolves to an array of transfer events, each containing:
   * - the type of transfer (e.g., deposit),
   * - the token and amount transferred,
   * - the timestamp of the event,
   * - and the Arbitrum transaction hash.
   */
  public async getTraderTransfers({
    user,
    startTime,
    ledgerUpdates = false,
  }: {
    user: Address;
    startTime: number;
    ledgerUpdates?: boolean;
  }): Promise<TransferEvent[]> {
    return await this.getInfo<TransferEvent[]>({
      type: ledgerUpdates ? 'userNonFundingLedgerUpdates' : 'userFunding',
      user,
      startTime,
    });
  }

  private async getInfo<T>(
    payload:
      | InfoRequestPayload
      | UserInfoRequestPayload
      | UserFundingRequestPayload,
  ): Promise<T> {
    const response = await fetch(this.MAINNET_API_URL + 'info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();

    return data as T;
  }

  /////////////////
  //  EXCHANGE   // The exchange endpoint is used to interact
  ///////////////// with and trade on the Hyperliquid chain

  // public async placeOrder()
}

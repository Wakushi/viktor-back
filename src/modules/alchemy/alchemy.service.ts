import { Inject, Injectable } from '@nestjs/common';
import { Alchemy, Network } from 'alchemy-sdk';

@Injectable()
export class AlchemyService {
  private _client: Alchemy;

  constructor(
    @Inject('ALCHEMY_CONFIG')
    private readonly config: { apiKey: string; network: Network },
  ) {
    this._client = new Alchemy({
      apiKey: config.apiKey,
      network: config.network,
    });
  }

  public get client() {
    return this._client;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient<any, 'public', any>;

  constructor(
    @Inject('SUPABASE_CONFIG')
    private readonly config: { privateKey: string; url: string },
  ) {
    const { privateKey, url } = config;

    if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
    if (!url) throw new Error(`Expected env var SUPABASE_URL`);

    this._client = createClient(url, privateKey);
  }

  public get client(): SupabaseClient<any, 'public', any> {
    return this._client;
  }
}

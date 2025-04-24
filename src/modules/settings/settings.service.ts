import { Injectable } from '@nestjs/common';
import { SupabaseError, SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections.type';
import { MobulaChain } from '../mobula/entities/mobula.entities';
import { ViktorSettings } from './entities/settings.type';

@Injectable()
export class SettingsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  public async getWhitelistedChains(): Promise<MobulaChain[] | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from(Collection.SETTINGS)
        .select('*')
        .single();

      if (error) {
        throw new SupabaseError('Failed to fetch analysis results', error);
      }

      const settings: ViktorSettings = data;
      return settings.whitelisted_chains;
    } catch (error) {
      console.error('Error fetching whitelisted chains results:', error);
      return null;
    }
  }

  public async updateWhitelistedChains(chains: MobulaChain[]): Promise<void> {
    const { error } = await this.supabaseService.client
      .from(Collection.SETTINGS)
      .update({ whitelisted_chains: chains })
      .eq('id', 1);

    if (error) {
      throw new SupabaseError('Failed to update whitelisted chains', error);
    }
  }
}

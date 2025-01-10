import { Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { ethers } from 'ethers';
import { CONTRACT_ABI } from 'src/shared/utils/constants/contract';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from 'config/env.validation';

@Injectable()
export class ContractService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  public agentContract(walletAddress: Address) {
    const provider = new ethers.JsonRpcProvider(
      this.config.get('BASE_SEPOLIA_RPC_URL'),
    );

    const wallet = new ethers.Wallet(this.config.get('PRIVATE_KEY'), provider);

    return new ethers.Contract(walletAddress, CONTRACT_ABI, wallet);
  }
}

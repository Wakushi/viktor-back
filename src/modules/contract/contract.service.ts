import { Inject, Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { ethers } from 'ethers';
import { CONTRACT_ABI } from 'src/shared/utils/constants/contract';

@Injectable()
export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(
    @Inject('CONTRACT_CONFIG')
    private readonly config: { rpcUrl: string; privateKey: string },
  ) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
  }

  public agentContract(walletAddress: Address) {
    return new ethers.Contract(walletAddress, CONTRACT_ABI, this.wallet);
  }
}

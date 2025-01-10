import { ethers } from 'ethers';

export function generateRequestId(uuid: string): string {
  return ethers.keccak256(ethers.solidityPacked(['string'], [uuid]));
}

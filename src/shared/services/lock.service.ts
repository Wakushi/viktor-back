import { Injectable } from '@nestjs/common';

@Injectable()
export class LockService {
  private locks = new Map<string, boolean>();

  acquireLock(uuid: string): boolean {
    if (this.locks.get(uuid)) {
      return false;
    }

    this.locks.set(uuid, true);
    return true;
  }

  releaseLock(uuid: string): void {
    this.locks.delete(uuid);
  }
}

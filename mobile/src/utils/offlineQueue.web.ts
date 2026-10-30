import { OfflinePunchTransaction } from '../types';

export async function getDatabase() {
  return null;
}

export async function queueOfflineTransaction(_item: OfflinePunchTransaction): Promise<boolean> {
  return false;
}

export async function getPendingOfflineTransactions(): Promise<OfflinePunchTransaction[]> {
  return [];
}

export async function markTransactionSynced(_id: string): Promise<void> {
  return;
}

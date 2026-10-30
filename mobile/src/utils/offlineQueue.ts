import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { OfflinePunchTransaction } from '../types';

let dbInstance: any = null;

export async function getDatabase() {
  if (Platform.OS === 'web') return null;
  if (!dbInstance) {
    try {
      dbInstance = await SQLite.openDatabaseAsync('adani_workforce_offline.db');
      await dbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS attendance_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          siteId TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL NOT NULL,
          photoUri TEXT,
          remarks TEXT,
          timestamp TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
    } catch (e) {
      console.warn('SQLite init warning:', e);
    }
  }
  return dbInstance;
}

export async function queueOfflineTransaction(item: OfflinePunchTransaction): Promise<boolean> {
  const db = await getDatabase();
  if (!db) return false;
  try {
    await db.runAsync(
      `INSERT INTO attendance_queue (id, type, siteId, latitude, longitude, accuracy, photoUri, remarks, timestamp, synced) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        item.id,
        item.type,
        item.siteId,
        item.latitude,
        item.longitude,
        item.accuracy,
        item.photoUri || '',
        item.remarks || '',
        item.timestamp,
        0,
      ]
    );
    return true;
  } catch (error) {
    console.error('Failed to queue offline transaction:', error);
    return false;
  }
}

export async function getPendingOfflineTransactions(): Promise<OfflinePunchTransaction[]> {
  const db = await getDatabase();
  if (!db) return [];
  try {
    const rows = await db.getAllAsync(
      `SELECT * FROM attendance_queue WHERE synced = 0 ORDER BY timestamp ASC;`
    );
    return rows as OfflinePunchTransaction[];
  } catch (error) {
    console.error('Failed to get offline transactions:', error);
    return [];
  }
}

export async function markTransactionSynced(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  try {
    await db.runAsync(`UPDATE attendance_queue SET synced = 1 WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('Failed to mark synced:', error);
  }
}

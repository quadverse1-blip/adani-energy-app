import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { OfflinePunchTransaction } from '../types';

let dbPromise: Promise<any> | null = null;

const CREATE_TABLE_SQL = `
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
`;

export async function getDatabase() {
  if (Platform.OS === 'web') return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('adani_workforce_offline.db');
        await db.execAsync(CREATE_TABLE_SQL);
        return db;
      } catch (e) {
        console.warn('SQLite init warning:', e);
        dbPromise = null;
        return null;
      }
    })();
  }
  return dbPromise;
}

export async function queueOfflineTransaction(item: OfflinePunchTransaction): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.runAsync(
      `INSERT OR REPLACE INTO attendance_queue (id, type, siteId, latitude, longitude, accuracy, photoUri, remarks, timestamp, synced) 
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
    console.warn('Failed to queue offline transaction:', error);
    return false;
  }
}

export async function getPendingOfflineTransactions(): Promise<OfflinePunchTransaction[]> {
  try {
    const db = await getDatabase();
    if (!db) return [];

    // Ensure table is ready before querying
    await db.execAsync(CREATE_TABLE_SQL);

    const rows = await db.getAllAsync(
      `SELECT * FROM attendance_queue WHERE synced = 0 ORDER BY timestamp ASC;`
    );
    return (rows || []) as OfflinePunchTransaction[];
  } catch (error) {
    console.warn('Offline transactions notice:', error);
    return [];
  }
}

export async function markTransactionSynced(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    if (!db) return;
    await db.runAsync(`UPDATE attendance_queue SET synced = 1 WHERE id = ?;`, [id]);
  } catch (error) {
    console.warn('Failed to mark synced notice:', error);
  }
}

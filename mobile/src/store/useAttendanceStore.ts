import { create } from 'zustand';
import { AttendanceRecord, Substation } from '../types';
import { attendanceService } from '../services/attendanceService';
import { getPendingOfflineTransactions, markTransactionSynced } from '../utils/offlineQueue';

interface AttendanceState {
  todayStatus: 'not_started' | 'active' | 'completed';
  todayRecord: AttendanceRecord | null;
  assignedSite: Substation | null;
  assignedSites: Substation[];
  liveElapsedSeconds: number;
  isLoading: boolean;
  error: string | null;
  pendingSyncCount: number;

  fetchTodayAttendance: () => Promise<void>;
  incrementTimer: () => void;
  syncOfflineQueue: () => Promise<void>;
  setShiftCompleted: (record: AttendanceRecord) => void;
  resetAttendance: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  todayStatus: 'not_started',
  todayRecord: null,
  assignedSite: null,
  assignedSites: [],
  liveElapsedSeconds: 0,
  isLoading: false,
  error: null,
  pendingSyncCount: 0,

  resetAttendance: () => {
    set({
      todayStatus: 'not_started',
      todayRecord: null,
      assignedSite: null,
      assignedSites: [],
      liveElapsedSeconds: 0,
      isLoading: false,
      error: null,
      pendingSyncCount: 0,
    });
  },

  fetchTodayAttendance: async () => {
    // Only set global isLoading on initial cold fetch to prevent UI flashing during background sync
    if (!get().todayRecord) {
      set({ isLoading: true, error: null });
    }
    try {
      const data = await attendanceService.getTodayAttendance();
      const elapsedSec = (data.liveElapsedMinutes || 0) * 60;
      set({
        todayStatus: data.status,
        todayRecord: data.record,
        assignedSite: data.site,
        assignedSites: data.sites || (data.site ? [data.site] : []),
        liveElapsedSeconds: elapsedSec,
        isLoading: false,
      });

      // Check offline pending items
      const pending = await getPendingOfflineTransactions();
      set({ pendingSyncCount: pending.length });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Failed to fetch attendance status',
      });
    }
  },

  incrementTimer: () => {
    if (get().todayStatus === 'active') {
      set((state) => ({ liveElapsedSeconds: state.liveElapsedSeconds + 1 }));
    }
  },

  setShiftCompleted: (record: AttendanceRecord) => {
    set({
      todayStatus: 'completed',
      todayRecord: record,
    });
  },

  syncOfflineQueue: async () => {
    try {
      const pending = await getPendingOfflineTransactions();
      for (const item of pending) {
        if (item.type === 'check_in') {
          await attendanceService.checkIn({
            siteId: item.siteId,
            latitude: item.latitude,
            longitude: item.longitude,
            accuracy: item.accuracy,
            remarks: item.remarks,
            photoUrl: item.photoUri,
          });
        } else if (item.type === 'check_out') {
          await attendanceService.checkOut({
            latitude: item.latitude,
            longitude: item.longitude,
            accuracy: item.accuracy,
            remarks: item.remarks,
          });
        }
        await markTransactionSynced(item.id);
      }
      const remaining = await getPendingOfflineTransactions();
      set({ pendingSyncCount: remaining.length });
      await get().fetchTodayAttendance();
    } catch (e) {
      console.warn('Sync failed:', e);
    }
  },
}));

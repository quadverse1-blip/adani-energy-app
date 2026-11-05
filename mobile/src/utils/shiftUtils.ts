/**
 * Shift Timing Rules (IST - Indian Standard Time):
 * - Shift Check-In Window: 09:00 AM IST to 06:00 PM IST (09:00 to 18:00)
 * - Outside 09:00 AM - 06:00 PM: Check-In is strictly DISABLED
 *   - After 06:00 PM (18:00 - 23:59): Disabled (Reopens tomorrow at 09:00 AM)
 *   - Before 09:00 AM (00:00 - 08:59): Disabled (Reopens today at 09:00 AM)
 * - Within Window (09:00 AM - 06:00 PM): Check-In is ENABLED
 *   - 09:00 AM - 09:30 AM: On-Time
 *   - 09:30 AM - 10:30 AM: Late Checked-In
 *   - 10:30 AM - 06:00 PM: Half-Day
 * - At 06:00 PM IST (18:00): Auto Checked-Out & Check-In Disabled
 * 
 * Applies to both Employee and Supervisor portals.
 */

export interface ShiftInfo {
  isCheckInAllowed: boolean;     // True ONLY between 09:00 AM and 06:00 PM IST
  isPastShiftEnd: boolean;       // True if outside 09:00 AM - 06:00 PM
  isBeforeShiftStart: boolean;   // True if < 09:00 IST
  isAfterShiftEnd: boolean;      // True if >= 18:00 IST
  punctualityLabel: 'On-Time' | 'Half-Day' | 'Check-In Closed';
  statusKey: 'present' | 'half-day' | 'closed';
  istHours: number;
  istMinutes: number;
  formattedTimeIST: string;
  windowMessage: string;
}

// Strictly enforce shift limit: Check-in closes at 6:00 PM IST
export const MANUAL_TESTING_BYPASS_SHIFT_LIMIT = false;

export const getShiftInfo = (): ShiftInfo => {
  const now = new Date();
  // Robust IST calculation: UTC minutes + 330 minutes (+05:30)
  const utcTotalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istTotalMinutes = (utcTotalMinutes + 330) % 1440;
  const istHours = Math.floor(istTotalMinutes / 60);
  const istMinutes = istTotalMinutes % 60;

  const ampm = istHours >= 12 ? 'PM' : 'AM';
  const displayHours = istHours % 12 || 12;
  const formattedTimeIST = `${displayHours}:${istMinutes < 10 ? '0' : ''}${istMinutes} ${ampm}`;

  const startMinutes = 9 * 60;       // 09:00 AM IST = 540 minutes
  const endMinutes = 18 * 60;        // 06:00 PM IST = 1080 minutes

  // Case 1: After 06:00 PM IST (18:00 to 23:59) - Check-in strictly closed
  if (istTotalMinutes >= endMinutes) {
    return {
      isCheckInAllowed: false,
      isPastShiftEnd: true,
      isBeforeShiftStart: false,
      isAfterShiftEnd: true,
      punctualityLabel: 'Check-In Closed',
      statusKey: 'closed',
      istHours,
      istMinutes,
      formattedTimeIST,
      windowMessage: 'Shift hours ended at 06:00 PM IST • Check-in reopens tomorrow at 09:00 AM IST',
    };
  }

  // Case 2: Before 09:00 AM IST (00:00 to 08:59)
  if (istTotalMinutes < startMinutes) {
    return {
      isCheckInAllowed: false,
      isPastShiftEnd: true,
      isBeforeShiftStart: true,
      isAfterShiftEnd: false,
      punctualityLabel: 'Check-In Closed',
      statusKey: 'closed',
      istHours,
      istMinutes,
      formattedTimeIST,
      windowMessage: 'Check-in is closed (06:00 PM – 09:00 AM) • Reopens today at 09:00 AM IST',
    };
  }

  // Case 3: Within Check-In Window (09:00 AM to 06:00 PM IST)
  // Check-in up to 10:30 AM IST (09:00 to 10:30) -> On-Time (Present)
  if (istTotalMinutes <= 10 * 60 + 30) {
    return {
      isCheckInAllowed: true,
      isPastShiftEnd: false,
      isBeforeShiftStart: false,
      isAfterShiftEnd: false,
      punctualityLabel: 'On-Time',
      statusKey: 'present',
      istHours,
      istMinutes,
      formattedTimeIST,
      windowMessage: 'Check-in window active (09:00 AM – 10:30 AM IST: On-Time / Present)',
    };
  } else {
    // Check-in after 10:30 AM IST -> Half-Day
    return {
      isCheckInAllowed: true,
      isPastShiftEnd: false,
      isBeforeShiftStart: false,
      isAfterShiftEnd: false,
      punctualityLabel: 'Half-Day',
      statusKey: 'half-day',
      istHours,
      istMinutes,
      formattedTimeIST,
      windowMessage: 'Half-day check-in window active (10:30 AM – 06:00 PM IST)',
    };
  }
};

export const isShiftConcluded = (): boolean => {
  return !getShiftInfo().isCheckInAllowed;
};

/**
 * Accurately formats an ISO string or timestamp to Indian Standard Time (IST - UTC+5:30)
 * in 12-hour AM/PM format (e.g., "10:55 AM").
 */
export const formatTimeIST = (raw?: string | null): string => {
  if (!raw) return '--:--';
  if (raw.includes('AM') || raw.includes('PM')) return raw;
  try {
    let clean = raw.trim();
    if (clean.includes('T') && !clean.endsWith('Z')) {
      clean = clean + 'Z';
    }
    const dt = new Date(clean);
    if (!isNaN(dt.getTime())) {
      // Convert UTC ms to IST ms (UTC + 5 hours 30 mins)
      const istMs = dt.getTime() + 5.5 * 3600000;
      const istDate = new Date(istMs);
      const hours = istDate.getUTCHours();
      const mins = istDate.getUTCMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12}:${mins < 10 ? '0' : ''}${mins} ${ampm}`;
    }
  } catch {}
  return raw;
};

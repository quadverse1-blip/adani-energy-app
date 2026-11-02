export type UserRole = 'technician' | 'supervisor' | 'admin';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: UserRole;
  designation: string;
  assignedSiteId?: string;
  assignedSiteIds?: string[];
  phone?: string;
  email?: string;
  avatar?: string;
  department?: string;
  circle?: string;
  division?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  status?: string;
  shiftStatus?: string;
  assignedBy?: string;
  assignedByPhone?: string;
  assignedByRole?: string;
  assignedAt?: string;
}

export interface ManagerInfo {
  name: string;
  phone: string;
  email: string;
  designation?: string;
  photoUrl?: string;
  avatar?: string;
}

export interface Substation {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  voltageClass: string;
  manager: ManagerInfo;
  photoUrl?: string;
  activeEngineersCount?: number;
  status: 'active' | 'inactive';
  workingHours?: string;
  assignedBy?: string;
  assignedByPhone?: string;
  assignedByRole?: string;
  assignedAt?: string;
}

export interface PunchRecord {
  time: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters?: number;
  photoUrl?: string;
  remarks?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'half-day' | 'absent' | 'weekly_off' | 'holiday';

export interface AttendanceRecord {
  _id?: string;
  id: string;
  employeeId: string;
  employeeName?: string;
  siteId: string;
  siteName?: string;
  date: string;
  checkIn?: PunchRecord;
  checkOut?: PunchRecord;
  status: AttendanceStatus;
  isHalfDay?: boolean;
  attendanceCategory?: string;
  workingMinutes: number;
  workingHoursFormatted?: string;
  adminRemarks?: string;
  photoUrl?: string;
}

export interface AttendanceSummary {
  totalWorkingDays: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  totalHours: number;
}

export interface EarningsBreakdown {
  basicSalary: number;
  hra: number;
  da: number;
  travelAllowance: number;
  siteFieldAllowance: number;
  grossEarnings: number;
}

export interface DeductionsBreakdown {
  pf: number;
  esic: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
}

export interface SalarySlip {
  employeeId: string;
  employeeName: string;
  designation: string;
  department?: string;
  month: number;
  year: number;
  monthName: string;
  netPay: number;
  status: 'PAID' | 'PROCESSING' | 'FINALIZED' | 'DRAFT' | 'REVISED' | string;
  payableDays: number;
  presentDays: number;
  paidLeaves: number;
  lossOfPay: number;
  monthlySalary?: number;
  dailySalaryRate?: number;
  absentDays?: number;
  halfDays?: number;
  weeklyOffDays?: number;
  publicHolidayDays?: number;
  absentDeductionRate?: number;
  halfDayDeductionRate?: number;
  absentDeductionTotal?: number;
  halfDayDeductionTotal?: number;
  totalDeductionAmount?: number;
  referenceNumber?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  revisionReason?: string;
  earnings: EarningsBreakdown;
  deductions: DeductionsBreakdown;
  payslipPdfUrl?: string;
  hasUploadedDocument?: boolean;
  documentUrl?: string;
  fileName?: string;
  notes?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface SalaryConfig {
  employeeId: string;
  employeeName: string;
  monthlySalary: number;
  dailyRate: number;
  absentDeductionRate: number;
  halfDayDeductionRate: number;
  effectiveDate: string;
  updatedAt?: string;
  updatedBy?: string;
  notes?: string;
}

export interface SalarySummaryResponse {
  month: number;
  year: number;
  monthName: string;
  totalEmployees: number;
  totalGrossDisbursed: number;
  totalDeductions: number;
  totalNetPayable: number;
  finalizedCount: number;
  draftCount: number;
  slips: SalarySlip[];
}

export interface FleetTechnician {
  id: string;
  name: string;
  employeeId: string;
  phone: string;
  avatar?: string;
  designation: string;
  status: 'on_duty_inside' | 'on_duty_outside' | 'completed' | 'offline' | string;
  attendanceBadge?: string;
  markerColor: 'green' | 'amber' | 'grey' | 'blue' | string;
  hasGps?: boolean;
  latitude: number | null;
  longitude: number | null;
  batteryLevel?: number;
  accuracy?: string;
  assignedSiteName: string;
  assignedSiteCode?: string;
  assignedSiteId: string;
  checkInTime?: string;
  distanceMeters: number;
  lastSeen: string;
  locationName?: string;
}

export interface OfflinePunchTransaction {
  id: string;
  type: 'check_in' | 'check_out';
  siteId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photoUri?: string;
  remarks?: string;
  timestamp: string;
  synced: number;
}

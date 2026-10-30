import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  Upload,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  FileText,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { salaryService, SalarySummary } from '../../services/salaryService';
import { employeeService } from '../../services/employeeService';
import { SalarySlip, User } from '../../types';
import { UploadSalarySlipModal } from '../../components/compensation/UploadSalarySlipModal';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CompensationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openDrawer } = useAdminDrawerStore();

  const [selectedMonth, setSelectedMonth] = useState<number>(10); // Oct
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [search, setSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'uploaded' | 'pending'>('all');

  // Modal State
  const [uploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
  const [selectedEmpForUpload, setSelectedEmpForUpload] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    try {
      const [sumRes, empRes] = await Promise.all([
        salaryService.getSalarySummary(selectedMonth, selectedYear),
        employeeService.getEmployees().catch(() => []),
      ]);
      setSummary(sumRes);

      if (empRes && empRes.length > 0) {
        setEmployees(empRes);
      } else if (sumRes?.slips && sumRes.slips.length > 0) {
        // Fallback from summary slips
        const mappedUsers: User[] = sumRes.slips.map((s) => ({
          id: s.employeeId,
          employeeId: s.employeeId,
          name: s.employeeName,
          designation: s.designation,
          role: 'technician',
          phone: '',
          status: 'active',
        }));
        setEmployees(mappedUsers);
      }
    } catch (e: any) {
      console.warn('Compensation fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleOpenUpload = (empId?: string) => {
    setSelectedEmpForUpload(empId);
    setUploadModalVisible(true);
  };

  const handleDownloadSlip = async (slip: SalarySlip) => {
    try {
      const url = salaryService.getDownloadUrl(slip.employeeId, selectedMonth, selectedYear);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }

      const extension = slip.fileName && slip.fileName.includes('.')
        ? slip.fileName.split('.').pop()
        : (slip.hasUploadedDocument ? 'pdf' : 'txt');
      const filename = slip.fileName || `Adani_Payslip_${slip.employeeId}_${selectedMonth}_${selectedYear}.${extension}`;

      const destination = new ExpoFile(Paths.document, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: extension === 'pdf' ? 'application/pdf' : 'text/plain',
          dialogTitle: `Adani Payslip - ${slip.employeeName}`,
        });
      } else {
        Alert.alert('Payslip Downloaded', `Saved to ${downloadedFile.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download payslip');
    }
  };

  const filteredSlips = useMemo(() => {
    if (!summary?.slips) return [];
    return summary.slips.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.employeeName.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterTab === 'uploaded') return s.hasUploadedDocument;
      if (filterTab === 'pending') return !s.hasUploadedDocument;
      return true;
    });
  }, [summary, search, filterTab]);

  const uploadedCount = useMemo(
    () => summary?.slips.filter((s) => s.hasUploadedDocument).length || 0,
    [summary]
  );
  const totalCount = summary?.slips.length || 0;

  if (loading && !summary) {
    return <LoadingSpinner message="Loading workforce payroll & compensation..." />;
  }

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* 1. Header with Upload Action */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => openDrawer()} activeOpacity={0.7}>
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Workforce Compensation</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Payroll, Shift Wages & Signed Payslip Archiving
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.uploadMainBtn}
          onPress={() => handleOpenUpload()}
          activeOpacity={0.8}
        >
          <Upload size={15} color="#FFFFFF" />
          <Text style={styles.uploadMainBtnText}>Upload Salary Slip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E63F0']} />
        }
      >
        {/* 2. Month & Year Selector Bar */}
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => {
              if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear((y) => y - 1);
              } else {
                setSelectedMonth((m) => m - 1);
              }
            }}
          >
            <ChevronLeft size={18} color="#1E63F0" />
          </TouchableOpacity>

          <View style={styles.monthTitleBox}>
            <Calendar size={16} color="#1E63F0" />
            <Text style={styles.monthTitleText}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </Text>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Verified Cycle</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => {
              if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear((y) => y + 1);
              } else {
                setSelectedMonth((m) => m + 1);
              }
            }}
          >
            <ChevronRight size={18} color="#1E63F0" />
          </TouchableOpacity>
        </View>

        {/* 3. Summary Metric KPI Cards */}
        <View style={styles.metricsRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL DISBURSED</Text>
            <Text style={styles.kpiValue}>
              ₹{(summary?.totalDisbursed || 196000).toLocaleString('en-IN')}
            </Text>
            <View style={styles.kpiFooter}>
              <View style={styles.greenDot} />
              <Text style={styles.kpiSub}>Bank ACH Verified</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>ARCHIVED PAYSLIPS</Text>
            <Text style={styles.kpiValue}>
              {uploadedCount} / {totalCount}
            </Text>
            <View style={styles.kpiFooter}>
              <CheckCircle2 size={12} color="#10B981" />
              <Text style={styles.kpiSub}>Signed PDFs</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PAYROLL STATUS</Text>
            <Text style={[styles.kpiValue, { color: '#15803D' }]}>Fully Active</Text>
            <View style={styles.kpiFooter}>
              <Clock size={12} color="#3B82F6" />
              <Text style={styles.kpiSub}>30-Day Payout</Text>
            </View>
          </View>
        </View>

        {/* 4. Filter & Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Search size={16} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search technician name, ID, or designation..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, filterTab === 'all' && styles.filterPillActive]}
              onPress={() => setFilterTab('all')}
            >
              <Text style={[styles.filterPillText, filterTab === 'all' && styles.filterPillTextActive]}>
                All ({totalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filterTab === 'uploaded' && styles.filterPillActive]}
              onPress={() => setFilterTab('uploaded')}
            >
              <Text style={[styles.filterPillText, filterTab === 'uploaded' && styles.filterPillTextActive]}>
                Archived ({uploadedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filterTab === 'pending' && styles.filterPillActive]}
              onPress={() => setFilterTab('pending')}
            >
              <Text style={[styles.filterPillText, filterTab === 'pending' && styles.filterPillTextActive]}>
                Pending ({totalCount - uploadedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Employee Compensation List (Clean Mobile Card Layout) */}
        <View style={styles.slipsList}>
          {filteredSlips.map((slip) => {
            const initials = slip.employeeName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .substring(0, 2)
              .toUpperCase();

            return (
              <View key={slip.employeeId} style={styles.empCard}>
                {/* Top Row: Avatar + Name + Verified Badge */}
                <View style={styles.empCardTop}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>

                  <View style={styles.empNameCol}>
                    <Text style={styles.empNameText}>{slip.employeeName}</Text>
                    <Text style={styles.empIdText}>
                      {slip.employeeId} • {slip.designation}
                    </Text>
                  </View>

                  {slip.hasUploadedDocument ? (
                    <View style={styles.verifiedBadge}>
                      <CheckCircle2 size={11} color="#15803D" />
                      <Text style={styles.verifiedBadgeText}>Verified PDF</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending Slip</Text>
                    </View>
                  )}
                </View>

                {/* Middle Row: Financial & Attendance Strip */}
                <View style={styles.statsStrip}>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>NET PAYOUT</Text>
                    <Text style={styles.statValMoney}>
                      ₹{slip.netPay.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>PRESENT DAYS</Text>
                    <Text style={styles.statVal}>{slip.presentDays} Days</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>PAYABLE DAYS</Text>
                    <Text style={styles.statVal}>{slip.payableDays} Days</Text>
                  </View>
                </View>

                {/* If external signed payslip file attached, show pill */}
                {slip.hasUploadedDocument && (
                  <View style={styles.fileIndicatorRow}>
                    <FileText size={13} color="#1E63F0" />
                    <Text style={styles.fileIndicatorName} numberOfLines={1}>
                      {slip.fileName || `Payslip_${slip.employeeId}_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.pdf`}
                    </Text>
                  </View>
                )}

                {/* Bottom Row: Actions */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={() => handleOpenUpload(slip.employeeId)}
                    activeOpacity={0.8}
                  >
                    <Upload size={14} color="#1E63F0" />
                    <Text style={styles.uploadBtnText}>
                      {slip.hasUploadedDocument ? 'Replace Payslip' : 'Upload Salary Slip'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => handleDownloadSlip(slip)}
                    activeOpacity={0.8}
                  >
                    <Download size={14} color="#334155" />
                    <Text style={styles.downloadBtnText}>Download</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Upload/Record Salary Slip Modal matching user reference image */}
      <UploadSalarySlipModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => fetchData()}
        employees={employees}
        initialEmployeeId={selectedEmpForUpload}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
      />

      {/* Global Navigation Drawer */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  uploadMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E63F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#1E63F0',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  uploadMainBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },

  // Month Selector Bar
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitleText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },

  // Metrics KPI Row
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  kpiFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  kpiSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },

  // Search Section
  searchSection: {
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#1E63F0',
    borderColor: '#1E63F0',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Slips List & Employee Cards
  slipsList: {
    gap: 12,
  },
  empCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  empCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
  },
  empNameCol: {
    flex: 1,
  },
  empNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  empIdText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },

  // Stats Strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statValMoney: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#15803D',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // File Indicator
  fileIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fileIndicatorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    flex: 1,
  },

  // Actions Row
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  uploadBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 9,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E63F0',
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 9,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
});

export default CompensationScreen;

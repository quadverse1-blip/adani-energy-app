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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  Upload,
  Download,
  Calendar,
  CheckCircle2,
  FileText,
  Search,
  X,
  Check,
  ChevronDown,
  RefreshCw,
  FileUp,
  ShieldCheck,
  Info,
  Clock,
  User as UserIcon,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { salaryService } from '../../services/salaryService';
import { employeeService } from '../../services/employeeService';
import { SalarySlip, SalarySummaryResponse, User } from '../../types';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { AppBackButton } from '../../components/common/AppBackButton';
import { COLORS, SHADOWS } from '../../constants/theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028];

export const CompensationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAdminDrawerStore();

  // Period Selection
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [showYearModal, setShowYearModal] = useState<boolean>(false);

  // Data States
  const [employees, setEmployees] = useState<User[]>(() => employeeService.getCachedEmployees());
  const [summary, setSummary] = useState<SalarySummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(() => employeeService.getCachedEmployees().length === 0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Upload Placeholder Form States
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
    const cached = employeeService.getCachedEmployees();
    return cached.length > 0 ? (cached[0].id || (cached[0] as any)._id || cached[0].employeeId) : '';
  });
  const [showEmpModal, setShowEmpModal] = useState<boolean>(false);
  const [empSearchQuery, setEmpSearchQuery] = useState<string>('');
  const [netAmount, setNetAmount] = useState<string>('20000');
  const [notes, setNotes] = useState<string>('Verified monthly salary slip');
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    size?: number;
    uri: string;
    base64?: string;
  } | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Search & Filter for Uploaded List
  const [listSearchQuery, setListSearchQuery] = useState<string>('');
  const [downloadingEmpId, setDownloadingEmpId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [sumRes, empRes] = await Promise.all([
        salaryService.getSalarySummary(selectedMonth, selectedYear).catch(() => null),
        employeeService.getEmployees().catch(() => employeeService.getCachedEmployees()),
      ]);

      if (sumRes) {
        setSummary(sumRes);
      }

      if (empRes && empRes.length > 0) {
        setEmployees(empRes);
        if (!selectedEmpId) {
          setSelectedEmpId(empRes[0].id || (empRes[0] as any)._id || empRes[0].employeeId);
        }
      } else if (sumRes?.slips && sumRes.slips.length > 0) {
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
        if (!selectedEmpId) {
          setSelectedEmpId(mappedUsers[0].id || mappedUsers[0].employeeId);
        }
      }
    } catch (e: any) {
      console.warn('Salary slip data fetch error:', e);
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

  // Find currently selected employee for upload form
  const selectedEmployee = useMemo(() => {
    return (
      employees.find(
        (e) =>
          e.id === selectedEmpId ||
          (e as any)._id === selectedEmpId ||
          e.employeeId === selectedEmpId
      ) || employees[0]
    );
  }, [employees, selectedEmpId]);

  // Pick Document (Strictly PDF)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        let base64Data: string | undefined = undefined;

        // Ensure filename always cleanly ends with .pdf
        let cleanName = file.name || `Adani_Salary_Slip_${selectedEmpId}_${selectedMonth}_${selectedYear}.pdf`;
        if (!cleanName.toLowerCase().endsWith('.pdf')) {
          cleanName = cleanName.replace(/\.[^/.]+$/, '') + '.pdf';
          if (!cleanName.toLowerCase().endsWith('.pdf')) {
            cleanName += '.pdf';
          }
        }

        if (Platform.OS === 'web') {
          if ((file as any).file) {
            try {
              const rawFile = (file as any).file as File;
              const reader = new FileReader();
              base64Data = await new Promise((resolve) => {
                reader.onload = () => {
                  const res = reader.result as string;
                  resolve(res.includes(',') ? res.split(',')[1] : res);
                };
                reader.readAsDataURL(rawFile);
              });
            } catch {}
          } else if (file.uri) {
            try {
              const resp = await fetch(file.uri);
              const blob = await resp.blob();
              const reader = new FileReader();
              base64Data = await new Promise((resolve) => {
                reader.onload = () => {
                  const res = reader.result as string;
                  resolve(res.includes(',') ? res.split(',')[1] : res);
                };
                reader.readAsDataURL(blob);
              });
            } catch {}
          }
        } else {
          // Native Android & iOS in Expo SDK 58: read file bytes and convert to base64
          try {
            const expoFile = new ExpoFile(file.uri);
            let uint8: Uint8Array | null = null;
            if (typeof (expoFile as any).bytes === 'function') {
              uint8 = await (expoFile as any).bytes();
            } else if (typeof expoFile.arrayBuffer === 'function') {
              const buf = await expoFile.arrayBuffer();
              uint8 = new Uint8Array(buf);
            }

            if (uint8 && uint8.length > 0) {
              let binary = '';
              const chunkSize = 8192;
              for (let i = 0; i < uint8.length; i += chunkSize) {
                const sub = uint8.subarray(i, Math.min(i + chunkSize, uint8.length));
                binary += String.fromCharCode.apply(null, Array.from(sub));
              }
              base64Data = typeof btoa === 'function' ? btoa(binary) : undefined;
            }
          } catch (err) {
            console.log('Error reading native ExpoFile bytes:', err);
          }

          if (!base64Data) {
            try {
              const resp = await fetch(file.uri);
              const blob = await resp.blob();
              const reader = new FileReader();
              base64Data = await new Promise((resolve) => {
                reader.onloadend = () => {
                  const res = reader.result as string;
                  resolve(res.includes(',') ? res.split(',')[1] : res);
                };
                reader.readAsDataURL(blob);
              });
            } catch (blobErr) {
              console.log('Error reading blob via fetch:', blobErr);
            }
          }
        }

        setPickedFile({
          name: cleanName,
          size: file.size,
          uri: file.uri,
          base64: base64Data,
        });
        setUploadSuccessMsg(null);
      }
    } catch (err: any) {
      Alert.alert('Error Picking Document', err.message || 'Could not select the document.');
    }
  };

  // Upload Salary Slip Handler
  const handleUploadSalarySlip = async () => {
    if (!selectedEmployee) {
      Alert.alert('Missing Employee', 'Please select an employee to upload the salary slip for.');
      return;
    }

    setUploading(true);
    setUploadSuccessMsg(null);

    const empId =
      selectedEmployee.employeeId ||
      selectedEmployee.id ||
      (selectedEmployee as any)._id;

    let targetFileName = pickedFile?.name || `Adani_Salary_Slip_${empId}_${selectedMonth}_${selectedYear}.pdf`;
    if (!targetFileName.toLowerCase().endsWith('.pdf')) {
      targetFileName = targetFileName.replace(/\.[^/.]+$/, '') + '.pdf';
    }

    try {
      await salaryService.uploadSalarySlip({
        employeeId: empId,
        month: selectedMonth,
        year: selectedYear,
        netAmount: parseFloat(netAmount) || 20000,
        notes: notes.trim() || `Verified salary slip for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
        fileName: targetFileName,
        fileBase64: pickedFile?.base64,
      });

      const successText = `Salary slip for ${selectedEmployee.name} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}) uploaded successfully as an official PDF! It is now retrievable by the employee and supervisor.`;
      setUploadSuccessMsg(successText);
      setPickedFile(null);

      Alert.alert('Salary Slip Uploaded', successText);

      // Refresh list to show newly uploaded document
      fetchData();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Failed to upload salary slip. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Download / Retrieve Document (Admin verification)
  const handleDownloadSlip = async (slip: SalarySlip) => {
    const empId = slip.employeeId;
    setDownloadingEmpId(empId);
    try {
      const token = useAuthStore.getState().token;
      const rawFileName =
        slip.fileName || `Adani_Salary_Slip_${empId}_${selectedMonth}_${selectedYear}.pdf`;
      const filename = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

      if (Platform.OS === 'web') {
        const res = await salaryService.downloadPayslipFile(empId, selectedMonth, selectedYear, filename);
        if (!res.success) {
          const fallbackUrl = salaryService.getDownloadUrl(empId, selectedMonth, selectedYear, token || undefined);
          window.open(fallbackUrl, '_blank');
        }
        setDownloadingEmpId(null);
        return;
      }

      const url = salaryService.getDownloadUrl(empId, selectedMonth, selectedYear, token || undefined);
      let downloadedUri: string | null = null;
      try {
        const destination = new ExpoFile(Paths.document, filename);
        const downloadedFile = await ExpoFile.downloadFileAsync(url, destination, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        downloadedUri = downloadedFile.uri;
      } catch (expoErr) {
        try {
          const FileSystemLegacy = require('expo-file-system/legacy');
          const destUri = `${FileSystemLegacy.documentDirectory}${filename}`;
          const res = await FileSystemLegacy.downloadAsync(url, destUri, {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
          });
          downloadedUri = res.uri;
        } catch {
          throw expoErr;
        }
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare && downloadedUri) {
        await Sharing.shareAsync(downloadedUri, {
          mimeType: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          dialogTitle: `Adani Salary Slip - ${slip.employeeName} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          UTI: 'com.adobe.pdf',
        });
      } else if (downloadedUri) {
        Alert.alert(
          'Document Retrieved',
          `Saved ${filename} to your device documents.\n\nPath: ${downloadedUri}`
        );
      }
    } catch (err: any) {
      console.warn('Payslip download error:', err);
      Alert.alert('Error', err.message || 'Failed to download salary slip document.');
    } finally {
      setDownloadingEmpId(null);
    }
  };

  // Filter employees for employee picker modal
  const filteredModalEmployees = useMemo(() => {
    if (!empSearchQuery.trim()) return employees;
    const q = empSearchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.employeeId?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q)
    );
  }, [employees, empSearchQuery]);

  // Slips list filtered by search
  const filteredSlips = useMemo(() => {
    const slips = summary?.slips || [];
    if (!listSearchQuery.trim()) return slips;
    const q = listSearchQuery.toLowerCase();
    return slips.filter(
      (s) =>
        s.employeeName?.toLowerCase().includes(q) ||
        s.employeeId?.toLowerCase().includes(q) ||
        s.designation?.toLowerCase().includes(q)
    );
  }, [summary, listSearchQuery]);

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar with Left-Aligned Back Button */}
      <View style={[styles.topNavBar, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
        <View style={styles.topNavLeft}>
          <AppBackButton />
          <TouchableOpacity
            style={styles.navRoundBtn}
            onPress={() => openDrawer('Salary')}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={19} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Salary Slip</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh Records"
        >
          <RefreshCw size={12} color="#1E63F0" style={{ marginRight: 5 }} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Payroll Period Selector */}
        <View style={styles.periodRow}>
          <View style={styles.periodBadge}>
            <Calendar size={13} color="#4338CA" style={{ marginRight: 5 }} />
            <Text style={styles.periodBadgeText}>Payroll Period</Text>
          </View>

          <View style={styles.dropdownsGroup}>
            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => setShowMonthModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.dropdownPillText}>{MONTH_NAMES[selectedMonth - 1]}</Text>
              <ChevronDown size={14} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => setShowYearModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.dropdownPillText}>{selectedYear}</Text>
              <ChevronDown size={14} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================== */}
        {/* 1. PRIMARY PLACEHOLDER: UPLOAD SALARY SLIP FORM                */}
        {/* ============================================================== */}
        <View style={[styles.uploadCard, SHADOWS.md]}>
          <View style={styles.uploadCardHeader}>
            <View style={styles.uploadIconBadge}>
              <Upload size={22} color="#1E40AF" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadCardTitle}>Upload Salary Slip</Text>
              
            </View>
          </View>

          {/* Success Banner */}
          {uploadSuccessMsg && (
            <View style={styles.successBanner}>
              <CheckCircle2 size={16} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.successBannerText}>{uploadSuccessMsg}</Text>
            </View>
          )}

          {/* Form Step 1: Select Employee */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>SELECT WORKFORCE EMPLOYEE *</Text>
            <TouchableOpacity
              style={styles.employeeSelectorBtn}
              onPress={() => setShowEmpModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.empAvatarCircle}>
                <UserIcon size={16} color="#1E63F0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedEmpName}>
                  {selectedEmployee?.name || 'Select Employee'}
                </Text>
                <Text style={styles.selectedEmpSub}>
                  {selectedEmployee?.employeeId || 'ID Pending'} •{' '}
                  {selectedEmployee?.designation || 'Smart Meter Technician'}
                </Text>
              </View>
              <ChevronDown size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Form Step 2: Document Dropzone / File Picker */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>SALARY SLIP DOCUMENT (.PDF ONLY) *</Text>
            {pickedFile ? (
              <View style={styles.fileSelectedBox}>
                <View style={styles.fileIconBadgeWrap}>
                  <FileText size={24} color="#DC2626" />
                  <View style={styles.pdfBadgeMini}>
                    <Text style={styles.pdfBadgeMiniText}>PDF</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileSelectedName} numberOfLines={1}>
                    {pickedFile.name}
                  </Text>
                  <Text style={styles.fileSelectedMeta}>
                    {pickedFile.size
                      ? `${(pickedFile.size / 1024).toFixed(1)} KB • Official PDF Ready`
                      : 'Official PDF Ready to Upload'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeFileBtn}
                  onPress={handlePickDocument}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeFileBtnText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeFileBtn}
                  onPress={() => setPickedFile(null)}
                  activeOpacity={0.7}
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.dropzoneBox}
                onPress={handlePickDocument}
                activeOpacity={0.75}
              >
                <View style={styles.dropzoneIconWrap}>
                  <FileUp size={28} color="#2563EB" />
                </View>
                <Text style={styles.dropzoneTitle}>Tap to Browse & Select Salary Slip (.PDF)</Text>
                <Text style={styles.dropzoneSub}>
                  Upload official PDF document for {selectedEmployee?.name || 'the employee'}
                </Text>
                <View style={styles.browsePill}>
                  <Text style={styles.browsePillText}>Select PDF File</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Form Step 3: Net Amount */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>NET SALARY AMOUNT (₹) *</Text>
            <TextInput
              style={styles.inputField}
              value={netAmount}
              onChangeText={setNetAmount}
              placeholder="e.g. 20000"
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Form Step 4: Remarks / Notes */}
          <View style={styles.formGroup}>
            <View style={styles.formLabelRow}>
              <Text style={styles.formLabel}>REMARKS / NOTES (OPTIONAL)</Text>
              {notes.trim().length > 0 && (
                <TouchableOpacity onPress={() => setNotes('')} activeOpacity={0.7}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.remarksInputField}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add optional remarks or notes for employee (e.g. Verified monthly salary payout, shift bonus, adjustments)..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.formHelperText}>
              These remarks will appear on the employee's salary slip view and archived record.
            </Text>
          </View>

          {/* Upload Button */}
          <TouchableOpacity
            style={[styles.uploadSubmitBtn, uploading && { opacity: 0.75 }]}
            onPress={handleUploadSalarySlip}
            activeOpacity={0.85}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Upload size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.uploadSubmitBtnText}>
              {uploading
                ? 'Uploading Salary Slip...'
                : `Upload Salary Slip for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================== */}
        {/* 2. UPLOADED SALARY SLIPS RETRIEVAL & VERIFICATION              */}
        {/* ============================================================== */}
        <View style={[styles.listCard, SHADOWS.sm]}>
          <View style={styles.listCardHeader}>
            <View>
              <Text style={styles.listCardTitle}>
                Uploaded Slips ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
              </Text>
              
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBox}>
            <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by employee name or ID..."
              placeholderTextColor="#94A3B8"
              value={listSearchQuery}
              onChangeText={setListSearchQuery}
            />
            {listSearchQuery ? (
              <TouchableOpacity onPress={() => setListSearchQuery('')}>
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Slips List */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#1E63F0" />
              <Text style={styles.centerBoxText}>Loading salary slips...</Text>
            </View>
          ) : filteredSlips.length === 0 ? (
            <View style={styles.emptyListBox}>
              <FileText size={36} color="#CBD5E1" />
              <Text style={styles.emptyListTitle}>No Slips Uploaded for This Period</Text>
              <Text style={styles.emptyListSub}>
                Use the upload section above to upload salary slips for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
              </Text>
            </View>
          ) : (
            <View style={styles.slipsListWrap}>
              {filteredSlips.map((slip) => {
                const isUploaded =
                  slip.hasUploadedDocument ||
                  slip.status === 'FINALIZED' ||
                  slip.status === 'PAID';
                const isDownloadingThis = downloadingEmpId === slip.employeeId;

                return (
                  <View key={slip.employeeId} style={styles.slipItemRow}>
                    <View style={styles.slipItemIconWrap}>
                      <FileText size={22} color={isUploaded ? '#059669' : '#94A3B8'} />
                    </View>

                    <View style={styles.slipItemContent}>
                      <View style={styles.slipItemNameRow}>
                        <Text style={styles.slipItemEmpName} numberOfLines={1}>
                          {slip.employeeName}
                        </Text>
                        <View
                          style={[
                            styles.statusBadgeMini,
                            isUploaded ? styles.statusBadgeUploaded : styles.statusBadgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeMiniText,
                              { color: isUploaded ? '#059669' : '#D97706' },
                            ]}
                          >
                            {isUploaded ? 'UPLOADED' : 'PENDING'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.slipItemEmpMeta}>
                        {slip.employeeId} • {slip.designation}
                      </Text>

                      {isUploaded && (
                        <Text style={styles.slipItemFileName} numberOfLines={1}>
                          📄 {slip.fileName || `Adani_Salary_Slip_${selectedMonth}_${selectedYear}.pdf`}
                        </Text>
                      )}
                    </View>

                    {/* Download / Verify Action */}
                    <View style={styles.slipItemActions}>
                      <TouchableOpacity
                        style={[styles.downloadSlipBtn, isDownloadingThis && { opacity: 0.6 }]}
                        onPress={() => handleDownloadSlip(slip)}
                        activeOpacity={0.8}
                        disabled={isDownloadingThis}
                      >
                        {isDownloadingThis ? (
                          <ActivityIndicator size="small" color="#1E63F0" />
                        ) : (
                          <>
                            <Download size={14} color="#1E63F0" style={{ marginRight: 4 }} />
                            <Text style={styles.downloadSlipBtnText}>Retrieve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Security & Isolation Strip */}
        <View style={styles.securityStrip}>
          <ShieldCheck size={16} color="#059669" style={{ marginRight: 8 }} />
          <Text style={styles.securityText}>
            Centralized Workforce Payroll • Slips accessible only by the assigned employee & supervisor
          </Text>
        </View>
      </ScrollView>

      {/* Month Picker Modal */}
      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Payroll Month</Text>
              <TouchableOpacity onPress={() => setShowMonthModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {MONTH_NAMES.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerItem, selectedMonth === idx + 1 && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedMonth(idx + 1);
                    setShowMonthModal(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedMonth === idx + 1 && styles.pickerItemTextActive]}>
                    {m}
                  </Text>
                  {selectedMonth === idx + 1 && <Check size={16} color="#1E63F0" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearModal} transparent animationType="fade" onRequestClose={() => setShowYearModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowYearModal(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Payroll Year</Text>
              <TouchableOpacity onPress={() => setShowYearModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {AVAILABLE_YEARS.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickerItem, selectedYear === y && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedYear(y);
                    setShowYearModal(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedYear === y && styles.pickerItemTextActive]}>
                    {y}
                  </Text>
                  {selectedYear === y && <Check size={16} color="#1E63F0" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Employee Selector Modal */}
      <Modal visible={showEmpModal} transparent animationType="fade" onRequestClose={() => setShowEmpModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEmpModal(false)}>
          <View style={[styles.pickerModal, { maxHeight: '80%' }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Employee</Text>
              <TouchableOpacity onPress={() => setShowEmpModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Search size={15} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search staff by name or code..."
                placeholderTextColor="#94A3B8"
                value={empSearchQuery}
                onChangeText={setEmpSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {filteredModalEmployees.map((emp) => {
                const empId = emp.employeeId || emp.id || (emp as any)._id;
                const isSelected =
                  empId === selectedEmpId ||
                  emp.id === selectedEmpId ||
                  (emp as any)._id === selectedEmpId;

                return (
                  <TouchableOpacity
                    key={empId}
                    style={[styles.empPickerItem, isSelected && styles.empPickerItemActive]}
                    onPress={() => {
                      setSelectedEmpId(empId);
                      setShowEmpModal(false);
                      setEmpSearchQuery('');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.empAvatarCircleMini}>
                      <UserIcon size={14} color={isSelected ? '#1E63F0' : '#64748B'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empPickerName, isSelected && styles.empPickerNameActive]}>
                        {emp.name}
                      </Text>
                      <Text style={styles.empPickerMeta}>
                        {emp.employeeId || emp.id} • {emp.designation || 'Technician'}
                      </Text>
                    </View>
                    {isSelected && <Check size={16} color="#1E63F0" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sidecar Navigation Drawer */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  navRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E63F0',
  },
  mainScroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  periodBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4338CA',
  },
  dropdownsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dropdownPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  uploadCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  uploadCardSub: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
    lineHeight: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.3,
  },
  employeeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10,
  },
  empAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectedEmpName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedEmpSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  dropzoneBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dropzoneIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dropzoneTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  dropzoneSub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
  },
  browsePill: {
    marginTop: 6,
    backgroundColor: '#1E63F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  browsePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fileSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  fileIconBadgeWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pdfBadgeMini: {
    position: 'absolute',
    bottom: -3,
    backgroundColor: '#DC2626',
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  pdfBadgeMiniText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
  },
  fileSelectedName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  fileSelectedMeta: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 2,
  },
  changeFileBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  changeFileBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  removeFileBtn: {
    padding: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clearBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
    paddingHorizontal: 4,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  remarksInputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    minHeight: 74,
    textAlignVertical: 'top',
  },
  formHelperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  uploadSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E63F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  uploadSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  listCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  centerBoxText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyListBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyListTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  emptyListSub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  slipsListWrap: {
    gap: 10,
  },
  slipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  slipItemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slipItemContent: {
    flex: 1,
  },
  slipItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slipItemEmpName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusBadgeUploaded: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeMiniText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  slipItemEmpMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  slipItemFileName: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 2,
  },
  slipItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  downloadSlipBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E63F0',
  },
  securityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
  },
  securityText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#166534',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pickerItemTextActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  empPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 8,
  },
  empPickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  empAvatarCircleMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empPickerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  empPickerNameActive: {
    color: '#1E63F0',
  },
  empPickerMeta: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
});

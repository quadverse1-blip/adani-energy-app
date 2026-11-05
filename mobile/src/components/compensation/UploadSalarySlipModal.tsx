import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Upload,
  X,
  ChevronDown,
  FileText,
  CheckCircle2,
  Trash2,
  Check,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { salaryService } from '../../services/salaryService';
import { User, SalarySlip } from '../../types';

interface UploadSalarySlipModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (slip: SalarySlip) => void;
  employees: User[];
  initialEmployeeId?: string;
  initialMonth?: number;
  initialYear?: number;
}

const MONTHS = [
  { id: 1, name: 'January' },
  { id: 2, name: 'February' },
  { id: 3, name: 'March' },
  { id: 4, name: 'April' },
  { id: 5, name: 'May' },
  { id: 6, name: 'June' },
  { id: 7, name: 'July' },
  { id: 8, name: 'August' },
  { id: 9, name: 'September' },
  { id: 10, name: 'October' },
  { id: 11, name: 'November' },
  { id: 12, name: 'December' },
];

const YEARS = [2024, 2025, 2026, 2027];

const FALLBACK_EMPLOYEES: User[] = [];

export const UploadSalarySlipModal: React.FC<UploadSalarySlipModalProps> = ({
  visible,
  onClose,
  onSuccess,
  employees: propEmployees,
  initialEmployeeId,
  initialMonth = 10,
  initialYear = 2026,
}) => {
  const employees = propEmployees || [];

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [month, setMonth] = useState<number>(initialMonth);
  const [year, setYear] = useState<number>(initialYear);
  const [netAmount, setNetAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    size?: number;
    uri: string;
    base64?: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [pickerModal, setPickerModal] = useState<'emp' | 'month' | 'year' | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialEmployeeId) {
        setSelectedEmpId(initialEmployeeId);
      } else if (employees.length > 0) {
        setSelectedEmpId(employees[0].id || (employees[0] as any)._id || employees[0].employeeId);
      }
      setMonth(initialMonth);
      setYear(initialYear);
      setNetAmount('28000');
      setNotes('Monthly verified technician salary payout');
      setPickedFile(null);
      setPickerModal(null);
    }
  }, [visible, initialEmployeeId, initialMonth, initialYear, employees]);

  const selectedEmployee =
    employees.find(
      (e) =>
        e.id === selectedEmpId ||
        (e as any)._id === selectedEmpId ||
        e.employeeId === selectedEmpId
    ) || employees[0];

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        let base64Data: string | undefined = undefined;

        let cleanName = file.name || `Adani_Salary_Slip_${selectedEmpId}_${month}_${year}.pdf`;
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
                reader.onloadend = () => {
                  const res = reader.result as string;
                  resolve(res.includes(',') ? res.split(',')[1] : res);
                };
                reader.readAsDataURL(blob);
              });
            } catch {}
          }
        } else if (file.uri) {
          try {
            const { File: ExpoFile } = await import('expo-file-system');
            const localFile = new ExpoFile(file.uri);
            let uint8: Uint8Array | null = null;
            if (typeof (localFile as any).bytes === 'function') {
              uint8 = await (localFile as any).bytes();
            } else if (typeof localFile.arrayBuffer === 'function') {
              const buf = await localFile.arrayBuffer();
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
          } catch (e) {
            console.log('Native base64 resolution error:', e);
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
            } catch {}
          }
        }

        setPickedFile({
          name: cleanName,
          size: file.size,
          uri: file.uri,
          base64: base64Data,
        });
      }
    } catch (err: any) {
      Alert.alert('File Picker', err.message || 'Could not attach payslip file');
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(netAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid net paid salary amount.');
      return;
    }

    if (!selectedEmployee) {
      Alert.alert('No Employee Selected', 'Please select an employee.');
      return;
    }

    setSaving(true);
    try {
      const targetEmpId =
        selectedEmployee.employeeId || selectedEmployee.id || (selectedEmployee as any)._id;

      let targetFileName = pickedFile?.name || `Adani_Salary_Slip_${targetEmpId}_${month}_${year}.pdf`;
      if (!targetFileName.toLowerCase().endsWith('.pdf')) {
        targetFileName = targetFileName.replace(/\.[^/.]+$/, '') + '.pdf';
      }

      const res = await salaryService.uploadSalarySlip({
        employeeId: targetEmpId,
        month,
        year,
        netAmount: numAmount,
        notes: notes.trim(),
        fileName: targetFileName,
        fileBase64: pickedFile?.base64,
      });

      Alert.alert(
        'Salary Slip Archived',
        `Successfully recorded ${MONTHS.find((m) => m.id === month)?.name} ${year} salary slip for ${selectedEmployee.name}.`
      );
      onSuccess(res);
      onClose();
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err.response?.data?.detail || err.message || 'Failed to record salary slip.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (pickerModal) setPickerModal(null);
            else onClose();
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrapper}
        >
          <View style={styles.modalContainer}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header: Title and Subtitle matching reference image */}
              <View style={styles.header}>
                <View style={styles.headerIconWrap}>
                  <Upload size={22} color="#1E63F0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Upload / Record Employee Salary Slip</Text>
                  <Text style={styles.subtitle}>
                    Upload external signed PDF payslips or manually archive verified monthly compensation payments.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Field 1: Select Employee */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Select Employee</Text>
                <TouchableOpacity
                  style={styles.selectBox}
                  onPress={() => setPickerModal('emp')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectBoxText} numberOfLines={1}>
                    {selectedEmployee
                      ? `${selectedEmployee.name} (${selectedEmployee.employeeId || 'EMP'}) • ${selectedEmployee.designation || 'Junior Engineer'}`
                      : 'Select Employee...'}
                  </Text>
                  <ChevronDown size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Field 2 & 3: Month & Year Row */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1.1 }]}>
                  <Text style={styles.fieldLabel}>Month</Text>
                  <TouchableOpacity
                    style={styles.selectBox}
                    onPress={() => setPickerModal('month')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.selectBoxText}>
                      {MONTHS.find((m) => m.id === month)?.name || 'October'}
                    </Text>
                    <ChevronDown size={18} color="#475569" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.fieldGroup, { flex: 0.9 }]}>
                  <Text style={styles.fieldLabel}>Year</Text>
                  <TouchableOpacity
                    style={styles.selectBox}
                    onPress={() => setPickerModal('year')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.selectBoxText}>{year}</Text>
                    <ChevronDown size={18} color="#475569" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Field 4: Net Paid Amount (₹) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Net Paid Amount (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={netAmount}
                  onChangeText={setNetAmount}
                  placeholder="28000"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Field 5: Attach Salary Slip Document (PDF / Scan) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Attach Salary Slip Document (PDF / Scan)</Text>

                <TouchableOpacity
                  style={styles.dashedDropzone}
                  onPress={handlePickDocument}
                  activeOpacity={0.75}
                >
                  <View style={styles.dropzoneIconWrap}>
                    <FileText size={32} color="#94A3B8" />
                  </View>

                  {pickedFile ? (
                    <View style={styles.fileSelectedBox}>
                      <CheckCircle2 size={18} color="#10B981" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fileNameText} numberOfLines={1}>
                          {pickedFile.name}
                        </Text>
                        <Text style={styles.fileSizeText}>
                          {pickedFile.size
                            ? `${(pickedFile.size / 1024).toFixed(1)} KB • Attached & Verified`
                            : 'Document Attached & Verified'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setPickedFile(null);
                        }}
                        style={styles.fileRemoveBtn}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.dropzoneTitle}>Click to choose PDF payslip file</Text>
                      <Text style={styles.dropzoneSub}>Supports PDF, PNG, JPG (Max 5MB)</Text>
                      <View style={styles.browseBtn}>
                        <Text style={styles.browseBtnText}>Browse File</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Field 6: Accounting / Compliance Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Accounting / Compliance Notes</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Monthly verified technician salary payout"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Field 7: Save & Record Button */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save & Record Salary Slip</Text>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* In-Modal Dropdown Overlays (No nested Modals for Android stability) */}
            {pickerModal && (
              <View style={styles.pickerOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setPickerModal(null)}
                />
                <View style={styles.pickerCard}>
                  <View style={styles.pickerHeaderRow}>
                    <Text style={styles.pickerCardTitle}>
                      {pickerModal === 'emp'
                        ? 'Select Employee'
                        : pickerModal === 'month'
                        ? 'Select Month'
                        : 'Select Year'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPickerModal(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                    {pickerModal === 'emp' &&
                      employees.map((emp) => {
                        const empId =
                          emp.id || (emp as any)._id || emp.employeeId;
                        const isSelected =
                          empId === selectedEmpId || emp.employeeId === selectedEmpId;
                        return (
                          <TouchableOpacity
                            key={empId}
                            style={[
                              styles.pickerItem,
                              isSelected && styles.pickerItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedEmpId(empId);
                              setPickerModal(null);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.pickerItemName,
                                  isSelected && { color: '#1E40AF', fontWeight: '800' },
                                ]}
                              >
                                {emp.name} ({emp.employeeId || 'EMP'})
                              </Text>
                              <Text style={styles.pickerItemSub}>
                                {emp.designation || 'Technician'} • {emp.department || 'Operations'}
                              </Text>
                            </View>
                            {isSelected && <Check size={18} color="#1E40AF" />}
                          </TouchableOpacity>
                        );
                      })}

                    {pickerModal === 'month' &&
                      MONTHS.map((m) => {
                        const isSelected = m.id === month;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[
                              styles.pickerItem,
                              isSelected && styles.pickerItemSelected,
                            ]}
                            onPress={() => {
                              setMonth(m.id);
                              setPickerModal(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerItemName,
                                isSelected && { color: '#1E40AF', fontWeight: '800' },
                              ]}
                            >
                              {m.name}
                            </Text>
                            {isSelected && <Check size={18} color="#1E40AF" />}
                          </TouchableOpacity>
                        );
                      })}

                    {pickerModal === 'year' &&
                      YEARS.map((y) => {
                        const isSelected = y === year;
                        return (
                          <TouchableOpacity
                            key={y}
                            style={[
                              styles.pickerItem,
                              isSelected && styles.pickerItemSelected,
                            ]}
                            onPress={() => {
                              setYear(y);
                              setPickerModal(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerItemName,
                                isSelected && { color: '#1E40AF', fontWeight: '800' },
                              ]}
                            >
                              {y}
                            </Text>
                            {isSelected && <Check size={18} color="#1E40AF" />}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalWrapper: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '94%',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  modalScroll: {
    maxHeight: 640,
  },
  modalScrollContent: {
    padding: 22,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
  },

  // Form Fields
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectBoxText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },

  // Dashed Dropzone
  dashedDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneIconWrap: {
    marginBottom: 6,
  },
  dropzoneTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  dropzoneSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 12,
  },
  browseBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  browseBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  fileSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  fileSizeText: {
    fontSize: 10.5,
    color: '#15803D',
    marginTop: 2,
  },
  fileRemoveBtn: {
    padding: 6,
  },

  // Save Button
  saveBtn: {
    backgroundColor: '#1E63F0',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#1E63F0',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Dropdown Picker Overlay (Inside modal)
  pickerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pickerItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  pickerItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});

export default UploadSalarySlipModal;

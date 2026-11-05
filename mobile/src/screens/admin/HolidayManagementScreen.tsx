import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Menu,
  ArrowLeft,
  X,
  FileText,
  Sparkles,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { holidayService, HolidayItem } from '../../services/holidayService';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { triggerHaptic } from '../../utils/haptics';
import { AppBackButton } from '../../components/common/AppBackButton';

export const HolidayManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { openDrawer } = useAdminDrawerStore();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('AdminDashboard');
    }
  };

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentHolidayId, setCurrentHolidayId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formType, setFormType] = useState<string>('Gazetted');
  const [formDesc, setFormDesc] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Calendar Picker State
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handlePrevCalMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextCalMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const handleSelectCalDay = (day: number) => {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const pickedDate = `${calYear}-${mm}-${dd}`;
    setFormDate(pickedDate);
    setShowDatePicker(false);
    triggerHaptic('light');
  };

  const handleSelectToday = () => {
    const today = new Date();
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setFormDate(`${today.getFullYear()}-${mm}-${dd}`);
    setShowDatePicker(false);
    triggerHaptic('light');
  };

  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDayOffset = new Date(calYear, calMonth, 1).getDay();

  // Delete Confirmation State
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
  const [holidayToDelete, setHolidayToDelete] = useState<HolidayItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const data = await holidayService.getHolidays(selectedYear);
      setHolidays(data);
    } catch (err: any) {
      console.warn('Failed to load holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await holidayService.getHolidays(selectedYear);
      setHolidays(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setCurrentHolidayId(null);
    setFormName('');
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setFormDate(`${selectedYear}-${mm}-${dd}`);
    setCalYear(selectedYear);
    setCalMonth(today.getMonth());
    setShowDatePicker(false);
    setFormType('Gazetted');
    setFormDesc('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (item: HolidayItem) => {
    setIsEditing(true);
    setCurrentHolidayId(item._id);
    setFormName(item.name);
    setFormDate(item.date);
    if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      const parts = item.date.split('-');
      setCalYear(parseInt(parts[0], 10));
      setCalMonth(parseInt(parts[1], 10) - 1);
    } else {
      setCalYear(selectedYear);
      setCalMonth(new Date().getMonth());
    }
    setShowDatePicker(false);
    setFormType(item.type || 'Gazetted');
    setFormDesc(item.description || '');
    setModalVisible(true);
  };

  const handleSaveHoliday = async () => {
    if (!formName.trim()) {
      Alert.alert('Validation Error', 'Please enter a holiday name.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(formDate.trim())) {
      Alert.alert('Validation Error', 'Date must be in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && currentHolidayId) {
        await holidayService.updateHoliday(currentHolidayId, {
          name: formName.trim(),
          date: formDate.trim(),
          type: formType,
          description: formDesc.trim(),
        });
        triggerHaptic('success');
        Alert.alert('Holiday Updated', `Holiday "${formName}" has been updated and synchronized.`);
      } else {
        await holidayService.createHoliday({
          name: formName.trim(),
          date: formDate.trim(),
          type: formType,
          description: formDesc.trim(),
        });
        triggerHaptic('success');
        Alert.alert('Holiday Added', `Holiday "${formName}" is now active and marked as PH throughout the system.`);
      }
      setModalVisible(false);
      await fetchHolidays();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save holiday.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteHoliday = (item: HolidayItem) => {
    setHolidayToDelete(item);
    setDeleteConfirmVisible(true);
  };

  const executeDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    setDeleting(true);
    try {
      await holidayService.deleteHoliday(holidayToDelete._id);
      triggerHaptic('success');
      setDeleteConfirmVisible(false);
      setHolidayToDelete(null);
      Alert.alert('Holiday Deleted', `Holiday "${holidayToDelete.name}" has been removed.`);
      await fetchHolidays();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || err.message || 'Failed to delete holiday.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await holidayService.downloadHolidaysPdf(selectedYear);
      Alert.alert('PDF Downloaded', `Gazetted Holidays Calendar for ${selectedYear} is ready.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to download holidays PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const stats = useMemo(() => {
    const total = holidays.length;
    const national = holidays.filter((h) => (h.type || '').toLowerCase().includes('national')).length;
    const gazetted = holidays.filter((h) => !(h.type || '').toLowerCase().includes('national') && !(h.type || '').toLowerCase().includes('regional')).length;
    const regional = holidays.filter((h) => (h.type || '').toLowerCase().includes('regional')).length;
    return { total, national, gazetted, regional };
  }, [holidays]);

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={[styles.headerCard, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <AppBackButton onPress={handleBack} style={{ marginRight: 6 }} />

          <TouchableOpacity delayPressIn={0}
            style={styles.headerIconBtn}
            onPress={() => openDrawer('Holidays')}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>Holiday Management</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Centralized Public Holiday Calendar</Text>
          </View>

          <TouchableOpacity delayPressIn={0}
            style={styles.headerAddBtn}
            onPress={handleOpenAddModal}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.headerAddBtnText}>Add Holiday</Text>
          </TouchableOpacity>
        </View>

        {/* Action Bar: Year Selector & PDF Download */}
        <View style={styles.actionBarRow}>
          <View style={styles.yearPillsGroup}>
            {[2025, 2026, 2027].map((y) => (
              <TouchableOpacity delayPressIn={0}
                key={y}
                style={[styles.yearPill, selectedYear === y && styles.yearPillActive]}
                onPress={() => setSelectedYear(y)}
              >
                <Text style={[styles.yearPillText, selectedYear === y && styles.yearPillTextActive]}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity delayPressIn={0}
            style={styles.pdfDownloadBtn}
            onPress={handleDownloadPdf}
            disabled={downloadingPdf}
            activeOpacity={0.8}
          >
            {downloadingPdf ? (
              <ActivityIndicator size="small" color="#1E63F0" />
            ) : (
              <>
                <Download size={14} color="#1E63F0" style={{ marginRight: 6 }} />
                <Text style={styles.pdfDownloadBtnText}>PDF Calendar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E63F0']} />}
      >
        {/* Sync Info Banner */}
        <View style={styles.syncBanner}>
          <Sparkles size={18} color="#7C3AED" style={{ marginRight: 10, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.syncBannerTitle}>Centralized Application Synchronization Active</Text>
            <Text style={styles.syncBannerText}>
              Any holiday added here automatically assigns status <Text style={{ fontWeight: '800', color: '#5B21B6' }}>PH (Public Holiday)</Text> across all Admin, Supervisor, and Employee attendance calendars, reports, and Excel exports.
            </Text>
          </View>
        </View>

        {/* KPI Stats Strip */}
        <View style={styles.kpiStrip}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL HOLIDAYS</Text>
            <Text style={[styles.kpiValue, { color: '#6B21A8' }]}>{stats.total}</Text>
            <Text style={styles.kpiSub}>In {selectedYear} master ledger</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>NATIONAL</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{stats.national}</Text>
            <Text style={styles.kpiSub}>Gazetted / All Circles</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>REGIONAL / STATE</Text>
            <Text style={[styles.kpiValue, { color: '#D97706' }]}>{stats.regional + stats.gazetted}</Text>
            <Text style={styles.kpiSub}>Substation Grid Sites</Text>
          </View>
        </View>

        {/* Holidays List Card */}
        <View style={styles.holidaysCard}>
          <View style={styles.holidaysCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Calendar size={18} color="#1E63F0" style={{ marginRight: 8 }} />
              <Text style={styles.holidaysCardTitle}>
                Official Public Holidays ({selectedYear})
              </Text>
            </View>
            <View style={styles.holidayCountBadge}>
              <Text style={styles.holidayCountBadgeText}>{holidays.length} Days</Text>
            </View>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40 }}>
              <LoadingSpinner message="Loading centralized holidays..." />
            </View>
          ) : holidays.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Calendar size={42} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Holidays Added for {selectedYear}</Text>
              <Text style={styles.emptySub}>
                Click "Add Holiday" above to add new gazetted holidays to the centralized database.
              </Text>
            </View>
          ) : (
            holidays.map((item, idx) => {
              const weekdayStr =
                item.day && item.day !== 'Day'
                  ? item.day.length > 3
                    ? item.day.slice(0, 3)
                    : item.day
                  : item.date
                  ? new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
                  : 'Day';

              return (
                <View
                  key={item._id || idx}
                  style={[
                    styles.holidayRow,
                    idx === holidays.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  {/* Left Date Block */}
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateDayText}>
                      {item.date ? item.date.split('-')[2] : '--'}
                    </Text>
                    <Text style={styles.dateMonthText}>
                      {item.date
                        ? new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                        : '--'}
                    </Text>
                    <Text style={styles.dateWeekdayText}>{weekdayStr}</Text>
                  </View>

                  {/* Center Content */}
                  <View style={styles.holidayInfoCol}>
                    <View style={styles.holidayTitleRow}>
                      <Text style={styles.holidayNameText} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.phBadge}>
                        <Text style={styles.phBadgeText}>PH</Text>
                      </View>
                    </View>

                    <View style={styles.holidayMetaRow}>
                      <View style={styles.typeTag}>
                        <Text style={styles.holidayTypeText}>{item.type || 'Gazetted'}</Text>
                      </View>
                      {item.description ? (
                        <Text style={styles.holidayDescText} numberOfLines={1}>
                          • {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Right Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.actionIconBtn}
                      onPress={() => handleOpenEditModal(item)}
                      activeOpacity={0.7}
                      accessibilityLabel="Edit Holiday"
                    >
                      <Edit2 size={15} color="#1E63F0" />
                    </TouchableOpacity>

                    <TouchableOpacity delayPressIn={0}
                      style={styles.actionDeleteBtn}
                      onPress={() => confirmDeleteHoliday(item)}
                      activeOpacity={0.7}
                      accessibilityLabel="Delete Holiday"
                    >
                      <Trash2 size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add / Edit Holiday Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>
                  {isEditing ? 'Edit Public Holiday' : 'Add New Public Holiday'}
                </Text>
                <Text style={styles.modalSub}>
                  Centralized holiday auto-marked as PH in Attendance
                </Text>
              </View>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 6 }}
            >
              <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Holiday Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Republic Day, Diwali, Eid..."
                value={formName}
                onChangeText={setFormName}
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Date (YYYY-MM-DD) *</Text>
              <View style={styles.dateInputRow}>
                <TextInput
                  style={styles.dateTextInput}
                  placeholder="YYYY-MM-DD"
                  value={formDate}
                  onChangeText={(val) => {
                    setFormDate(val);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                      const p = val.split('-');
                      setCalYear(parseInt(p[0], 10));
                      setCalMonth(parseInt(p[1], 10) - 1);
                    }
                  }}
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity delayPressIn={0}
                  style={[
                    styles.dateCalendarIconBtn,
                    showDatePicker && styles.dateCalendarIconBtnActive,
                  ]}
                  onPress={() => setShowDatePicker((prev) => !prev)}
                  activeOpacity={0.7}
                  accessibilityLabel="Pick date from calendar"
                >
                  <Calendar size={18} color={showDatePicker ? '#FFFFFF' : '#1E63F0'} />
                </TouchableOpacity>
              </View>

              {/* Inline Interactive Calendar Picker */}
              {showDatePicker && (
                <View style={styles.calPickerBox}>
                  {/* Calendar Navigation Header */}
                  <View style={styles.calNavHeader}>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.calNavBtn}
                      onPress={handlePrevCalMonth}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={16} color="#334155" />
                    </TouchableOpacity>

                    <Text style={styles.calMonthYearTitle}>
                      {MONTH_NAMES[calMonth]} {calYear}
                    </Text>

                    <TouchableOpacity delayPressIn={0}
                      style={styles.calNavBtn}
                      onPress={handleNextCalMonth}
                      activeOpacity={0.7}
                    >
                      <ChevronRight size={16} color="#334155" />
                    </TouchableOpacity>
                  </View>

                  {/* Day of Week Headers */}
                  <View style={styles.calWeekdaysRow}>
                    {WEEKDAY_NAMES.map((w, idx) => (
                      <View key={idx} style={styles.calWeekdayCell}>
                        <Text
                          style={[
                            styles.calWeekdayText,
                            (idx === 0 || idx === 6) && styles.calWeekendText,
                          ]}
                        >
                          {w}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Days Matrix */}
                  <View style={styles.calDaysMatrix}>
                    {Array.from({ length: calFirstDayOffset }).map((_, i) => (
                      <View key={`empty-${i}`} style={styles.calDayCell} />
                    ))}

                    {Array.from({ length: daysInCalMonth }).map((_, i) => {
                      const day = i + 1;
                      const mm = String(calMonth + 1).padStart(2, '0');
                      const dd = String(day).padStart(2, '0');
                      const cellDate = `${calYear}-${mm}-${dd}`;
                      const isSelected = formDate === cellDate;
                      const isSunday = (calFirstDayOffset + i) % 7 === 0;

                      return (
                        <TouchableOpacity delayPressIn={0}
                          key={`day-${day}`}
                          style={[
                            styles.calDayCell,
                            isSelected && styles.calDayCellSelected,
                          ]}
                          onPress={() => handleSelectCalDay(day)}
                          activeOpacity={0.65}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              isSunday && styles.calDaySundayText,
                              isSelected && styles.calDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Calendar Quick Actions */}
                  <View style={styles.calFooterActions}>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.calTodayBtn}
                      onPress={handleSelectToday}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.calTodayBtnText}>Select Today</Text>
                    </TouchableOpacity>

                    <TouchableOpacity delayPressIn={0}
                      style={styles.calCloseBtn}
                      onPress={() => setShowDatePicker(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.calCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Classification / Type</Text>
              <View style={styles.typeSelectorRow}>
                {['National Gazetted', 'Gazetted', 'Regional'].map((t) => (
                  <TouchableOpacity delayPressIn={0}
                    key={t}
                    style={[styles.typePill, formType === t && styles.typePillActive]}
                    onPress={() => setFormType(t)}
                  >
                    <Text style={[styles.typePillText, formType === t && styles.typePillTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Description / Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Optional notes or details..."
                value={formDesc}
                onChangeText={setFormDesc}
                multiline
                placeholderTextColor="#94A3B8"
              />
            </View>
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity delayPressIn={0}
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity delayPressIn={0}
                style={styles.modalSaveBtn}
                onPress={handleSaveHoliday}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>
                    {isEditing ? 'Save Changes' : 'Add Holiday'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={deleteConfirmVisible}
        title="Delete Holiday"
        message={`Are you sure you want to delete the holiday "${holidayToDelete?.name}" (${holidayToDelete?.date})? This will remove the PH status for this date.`}
        confirmTitle="Delete Holiday"
        cancelTitle="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={executeDeleteHoliday}
        onCancel={() => setDeleteConfirmVisible(false)}
      />

      {/* Admin Drawer Modal */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
    includeFontPadding: false,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E63F0',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  actionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearPillsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  yearPill: {
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearPillActive: {
    backgroundColor: '#1E63F0',
    borderColor: '#1E63F0',
  },
  yearPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    includeFontPadding: false,
  },
  yearPillTextActive: {
    color: '#FFFFFF',
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pdfDownloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E63F0',
    includeFontPadding: false,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  syncBanner: {
    flexDirection: 'row',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  syncBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5B21B6',
    marginBottom: 2,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  syncBannerText: {
    fontSize: 11.5,
    color: '#6D28D9',
    lineHeight: 16.5,
    includeFontPadding: false,
  },
  kpiStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 88,
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    includeFontPadding: false,
  },
  kpiSub: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#94A3B8',
    lineHeight: 13,
    includeFontPadding: false,
  },
  holidaysCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  holidaysCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  holidaysCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  holidayCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  holidayCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
    includeFontPadding: false,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    includeFontPadding: false,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
    includeFontPadding: false,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateBlock: {
    width: 52,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateDayText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 20,
    includeFontPadding: false,
  },
  dateMonthText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E63F0',
    letterSpacing: 0.5,
    marginTop: 1,
    includeFontPadding: false,
  },
  dateWeekdayText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 1,
    includeFontPadding: false,
  },
  holidayInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
  },
  holidayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  holidayNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
    includeFontPadding: false,
  },
  phBadge: {
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignSelf: 'center',
  },
  phBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6B21A8',
    includeFontPadding: false,
  },
  holidayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
    gap: 4,
  },
  typeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  holidayTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    includeFontPadding: false,
  },
  holidayDescText: {
    fontSize: 10.5,
    color: '#64748B',
    flexShrink: 1,
    includeFontPadding: false,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  modalSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    includeFontPadding: false,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  modalScroll: {
    maxHeight: 460,
  },
  modalBody: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    includeFontPadding: false,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    includeFontPadding: false,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingRight: 4,
  },
  dateTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    includeFontPadding: false,
  },
  dateCalendarIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateCalendarIconBtnActive: {
    backgroundColor: '#1E63F0',
  },
  calPickerBox: {
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  calNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calMonthYearTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    includeFontPadding: false,
  },
  calWeekdaysRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  calWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    includeFontPadding: false,
  },
  calWeekendText: {
    color: '#EF4444',
  },
  calDaysMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.28%',
    aspectRatio: 1.15,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  calDayCellSelected: {
    backgroundColor: '#1E63F0',
  },
  calDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    includeFontPadding: false,
  },
  calDaySundayText: {
    color: '#EF4444',
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calTodayBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calTodayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
    includeFontPadding: false,
  },
  calCloseBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calCloseBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    includeFontPadding: false,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillActive: {
    backgroundColor: '#6B21A8',
    borderColor: '#6B21A8',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    includeFontPadding: false,
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    includeFontPadding: false,
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    minWidth: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});

export default HolidayManagementScreen;


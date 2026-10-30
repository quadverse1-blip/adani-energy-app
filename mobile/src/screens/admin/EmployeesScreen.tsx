import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Linking,
  Dimensions,
} from 'react-native';
import {
  Search,
  UserPlus,
  X,
  Building2,
  MapPin,
  Navigation,
  Check,
  ChevronDown,
  ExternalLink,
  Menu,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { employeeService } from '../../services/employeeService';
import { siteService } from '../../services/siteService';
import { User, Substation, UserRole } from '../../types';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { EmployeeCard } from '../../components/employee/EmployeeCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';

const DESIGNATION_OPTIONS = [
  'Junior Engineer',
  'Field Smart Meter Technician',
  'Senior Smart Meter Technician',
  'Zonal Workforce Supervisor',
  'Lead Meter Inspector',
];

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Field Technician (Mobile App)', value: 'technician' },
  { label: 'Zonal Workforce Supervisor', value: 'supervisor' },
  { label: 'Operations Admin', value: 'admin' },
];

const SHIFT_STATUS_OPTIONS = ['Present', 'Late', 'Absent', 'Completed', 'Half Day'];

export const EmployeesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAdminDrawerStore();
  const [employees, setEmployees] = useState<User[]>([]);
  const [sites, setSites] = useState<Substation[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Technician' | 'Supervisor' | 'Active'>('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<User | null>(null);

  // Form Fields matching Image 2
  const [employeeId, setEmployeeId] = useState('b4S/Adani/01');
  const [name, setName] = useState('Rohit Sharma');
  const [email, setEmail] = useState('rahul.sharma@adani.com');
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('Junior Engineer');
  const [role, setRole] = useState<UserRole>('technician');
  const [circle, setCircle] = useState('Gujarat Circle');
  const [division, setDivision] = useState('Surat Division');
  const [assignedSiteIds, setAssignedSiteIds] = useState<string[]>([]);
  const [latitude, setLatitude] = useState('12.962879');
  const [longitude, setLongitude] = useState('77.5968');
  const [locationName, setLocationName] = useState(
    "St. Joseph's University, Richmond Circle Flyover, Langford Road"
  );
  const [shiftStatus, setShiftStatus] = useState<string>('Present');
  const [saving, setSaving] = useState(false);

  // Dropdown Picker Modal States
  const [pickerType, setPickerType] = useState<'designation' | 'role' | 'shift' | null>(null);

  const sitesMap = useMemo(() => {
    const map: Record<string, Substation> = {};
    sites.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [sites]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const roleParam =
        activeFilter === 'Technician'
          ? 'technician'
          : activeFilter === 'Supervisor'
          ? 'supervisor'
          : undefined;
      const data = await employeeService.getEmployees({
        search: search.trim() || undefined,
        role: roleParam,
      });
      setEmployees(data);

      const siteList = await siteService.getSites();
      setSites(siteList);
    } catch (e) {
      console.warn('Employees fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const handleOpenAdd = () => {
    setEditingEmp(null);
    const newId = `b4S/Adani/${Math.floor(10 + Math.random() * 90)}`;
    setEmployeeId(newId);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('Adani@2026');
    setDesignation('Junior Engineer');
    setRole('technician');
    setCircle('Gujarat Circle');
    setDivision('Surat Division');
    setAssignedSiteIds(sites.length > 0 ? [sites[0].id] : []);
    setLatitude(sites[0] ? String(sites[0].latitude) : '12.962879');
    setLongitude(sites[0] ? String(sites[0].longitude) : '77.5968');
    setLocationName("St. Joseph's University, Richmond Circle Flyover, Langford Road");
    setShiftStatus('Present');
    setShowModal(true);
  };

  const handleOpenEdit = (emp: User) => {
    setEditingEmp(emp);
    setEmployeeId(emp.employeeId || '');
    setName(emp.name || '');
    setEmail(emp.email || `${emp.employeeId?.toLowerCase().replace('/', '.')}@adani.com`);
    setPhone(emp.phone || '');
    setPassword('');
    setDesignation(emp.designation || 'Junior Engineer');
    setRole(emp.role || 'technician');
    setCircle(emp.circle || 'Gujarat Circle');
    setDivision(emp.division || 'Surat Division');

    const assigned =
      emp.assignedSiteIds && emp.assignedSiteIds.length > 0
        ? emp.assignedSiteIds
        : emp.assignedSiteId
        ? [emp.assignedSiteId]
        : sites.length > 0
        ? [sites[0].id]
        : [];
    setAssignedSiteIds(assigned);

    setLatitude(emp.latitude ? String(emp.latitude) : '12.962879');
    setLongitude(emp.longitude ? String(emp.longitude) : '77.5968');
    setLocationName(
      emp.locationName || "St. Joseph's University, Richmond Circle Flyover, Langford Road"
    );
    setShiftStatus(emp.shiftStatus || 'Present');
    setShowModal(true);
  };

  const toggleSiteAssignment = (siteId: string) => {
    if (assignedSiteIds.includes(siteId)) {
      setAssignedSiteIds(assignedSiteIds.filter((id) => id !== siteId));
    } else {
      setAssignedSiteIds([...assignedSiteIds, siteId]);
    }
  };

  const removeSiteAssignment = (siteId: string) => {
    setAssignedSiteIds(assignedSiteIds.filter((id) => id !== siteId));
  };

  const handleSyncSiteCoords = () => {
    const primarySite = sites.find((s) => assignedSiteIds.includes(s.id)) || sites[0];
    if (primarySite) {
      setLatitude(String(primarySite.latitude));
      setLongitude(String(primarySite.longitude));
      setLocationName(primarySite.address || primarySite.name);
      Alert.alert(
        'Coordinates Synced',
        `Copied coordinates from "${primarySite.name}" (${primarySite.latitude}, ${primarySite.longitude}).`
      );
    }
  };

  const handleGetMyGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to tag current GPS.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(loc.coords.latitude.toFixed(6));
      setLongitude(loc.coords.longitude.toFixed(6));
      Alert.alert(
        'GPS Captured',
        `Current Location: ${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}`
      );
    } catch (e: any) {
      Alert.alert('GPS Error', e.message || 'Unable to fetch device GPS');
    }
  };

  const handleSaveCoordsToSite = async () => {
    const primarySite = sites.find((s) => assignedSiteIds.includes(s.id)) || sites[0];
    if (!primarySite) return;
    try {
      await siteService.updateSite(primarySite.id, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      });
      Alert.alert('Site Baseline Updated', `Saved coordinates permanently to "${primarySite.name}".`);
      fetchEmployees();
    } catch (e: any) {
      Alert.alert('Save Error', e.message || 'Failed to update substation coordinates');
    }
  };

  const handleOpenGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch((err) => console.warn('Could not open map URL', err));
  };

  const handleSaveEmployee = async () => {
    if (!name.trim() || !phone.trim() || !employeeId.trim()) {
      Alert.alert('Required Fields', 'Please complete Employee ID, Full Name, and Phone Number.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<User> = {
        name,
        employeeId,
        phone,
        email,
        role,
        designation,
        circle,
        division,
        assignedSiteIds,
        assignedSiteId: assignedSiteIds[0] || undefined,
        latitude: parseFloat(latitude) || undefined,
        longitude: parseFloat(longitude) || undefined,
        locationName,
        shiftStatus,
      };

      if (editingEmp) {
        await employeeService.updateEmployee(editingEmp.id, payload);
        Alert.alert('Success', `Employee ${name} updated successfully.`);
      } else {
        await employeeService.createEmployee({
          ...payload,
          password: password || 'Adani@2026',
        } as any);
        Alert.alert('Success', `New employee ${name} added successfully.`);
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save employee record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: User) => {
    Alert.alert('Delete Employee', `Are you sure you want to delete ${emp.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await employeeService.deleteEmployee(emp.id);
            fetchEmployees();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const primarySite = sites.find((s) => assignedSiteIds.includes(s.id)) || sites[0];

  return (
    <View style={styles.container}>
      {/* Search & Top Action Header with 3-Line Menu */}
      <View
        style={[
          styles.searchHeader,
          { paddingTop: Math.max(insets.top, 24) + 8 },
        ]}
      >
        {/* 3-Line Hamburger Menu Icon Button */}
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => openDrawer('Employees')}
          activeOpacity={0.7}
          accessibilityLabel="Open Navigation Menu"
        >
          <Menu size={22} color="#0F172A" />
        </TouchableOpacity>

        {/* Search Input Box */}
        <View style={styles.searchInputWrap}>
          <Search size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by Name, ID, or Phone..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchEmployees}
            style={styles.searchTextInput}
          />
        </View>

        {/* Add Employee Button */}
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.85}>
          <UserPlus size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['All', 'Technician', 'Supervisor', 'Active'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Employees List Container Card (Matches Image 1) */}
      <ScrollView
        contentContainerStyle={styles.listScrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.listCard, SHADOWS.sm]}>
          {employees.length === 0 ? (
            loading ? (
              <LoadingSpinner message="Searching workforce directory..." />
            ) : (
              <EmptyState
                title="No Employees Found"
                message="No field technicians matched your search criteria."
                actionTitle="Add New Employee"
                onAction={handleOpenAdd}
              />
            )
          ) : (
            employees.map((item, index) => (
              <EmployeeCard
                key={item.id || item.employeeId}
                employee={item}
                sitesMap={sitesMap}
                onEdit={() => handleOpenEdit(item)}
                onDelete={() => handleDelete(item)}
                isLast={index === employees.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* EDIT / ADD EMPLOYEE MODAL (Matches Image 2)                  */}
      {/* ============================================================ */}
      <Modal visible={showModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, SHADOWS.lg]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEmp ? `Edit: ${editingEmp.name}` : 'Add Field Employee'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollView}>
              {/* Row 1: Employee ID & Full Name */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Employee ID</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={employeeId}
                    onChangeText={setEmployeeId}
                    placeholder="b4S/Adani/01"
                    placeholderTextColor="#94A3B8"
                    editable={!editingEmp}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={name}
                    onChangeText={setName}
                    placeholder="Rohit Sharma"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Row 2: Email Address & Phone Number */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="rahul.sharma@adani.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9876543210"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Row 3: Designation & System Role (Dropdown Selectors) */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Designation</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => setPickerType('designation')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownText} numberOfLines={1}>
                      {designation}
                    </Text>
                    <ChevronDown size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>System Role</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => setPickerType('role')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownText} numberOfLines={1}>
                      {ROLE_OPTIONS.find((r) => r.value === role)?.label || 'Field Technician'}
                    </Text>
                    <ChevronDown size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 4: CIRCLE & Division */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>CIRCLE (e.g. Rastapeth, Prc)</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={circle}
                    onChangeText={setCircle}
                    placeholder="Gujarat Circle"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>
                    Division (e.g. Bundgarden, Padmavati Division, Office)
                  </Text>
                  <TextInput
                    style={styles.inputBox}
                    value={division}
                    onChangeText={setDivision}
                    placeholder="Surat Division"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* SECTION: Assigned Substations & Sites */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>
                  Assigned Substations & Sites ({assignedSiteIds.length} selected)
                </Text>
                <Text style={styles.sectionSubHeading}>Click to assign multiple sites</Text>
              </View>

              {/* Selected Sites Pills with ✕ button */}
              <View style={styles.selectedPillsRow}>
                {assignedSiteIds.map((siteId) => {
                  const s = sitesMap[siteId];
                  return (
                    <View key={siteId} style={styles.selectedPill}>
                      <Building2 size={12} color="#2563EB" />
                      <Text style={styles.selectedPillText}>{s?.name || siteId}</Text>
                      <TouchableOpacity
                        onPress={() => removeSiteAssignment(siteId)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={12} color="#2563EB" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* 2-Column Selectable Substation Cards Grid */}
              <View style={styles.sitesGrid}>
                {sites.map((site) => {
                  const isAssigned = assignedSiteIds.includes(site.id);
                  return (
                    <TouchableOpacity
                      key={site.id}
                      style={[styles.siteCard, isAssigned && styles.siteCardAssigned]}
                      onPress={() => toggleSiteAssignment(site.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.siteCardTop}>
                        {/* Checkbox */}
                        <View style={[styles.checkboxBox, isAssigned && styles.checkboxBoxActive]}>
                          {isAssigned && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </View>
                        {/* Assigned Badge */}
                        {isAssigned && (
                          <View style={styles.assignedBadge}>
                            <Text style={styles.assignedBadgeText}>Assigned</Text>
                          </View>
                        )}
                      </View>

                      {/* Name & Code */}
                      <Text style={styles.siteCardTitle} numberOfLines={1}>
                        {site.name}
                      </Text>
                      <Text style={styles.siteCardCode}>{site.code}</Text>

                      {/* Coordinates Pill */}
                      <View style={styles.siteCardCoords}>
                        <MapPin size={9} color="#16A34A" />
                        <Text style={styles.siteCardCoordsText}>
                          {site.latitude.toFixed(3)}, {site.longitude.toFixed(3)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* SECTION: Specified Location Coordinates (Lat / Long) */}
              <View style={styles.coordsSectionCard}>
                <View style={styles.coordsHeaderRow}>
                  <View style={styles.coordsTitleCol}>
                    <View style={styles.coordsIconBadge}>
                      <MapPin size={16} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.coordsHeading}>
                        Specified Location Coordinates (Lat / Long)
                      </Text>
                      <Text style={styles.coordsSubHeading}>
                        Geofenced baseline for mobile attendance & tracking
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons: Sync Site Coords, My GPS, Map Pin */}
                  <View style={styles.coordsActionsRow}>
                    <TouchableOpacity
                      style={styles.coordActionBtn}
                      onPress={handleSyncSiteCoords}
                      activeOpacity={0.7}
                    >
                      <Building2 size={12} color="#2563EB" />
                      <Text style={styles.coordActionBtnText}>Sync Site Coords</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.coordActionBtn}
                      onPress={handleGetMyGPS}
                      activeOpacity={0.7}
                    >
                      <Navigation size={12} color="#2563EB" />
                      <Text style={styles.coordActionBtnText}>My GPS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.coordActionBtn}
                      onPress={handleSyncSiteCoords}
                      activeOpacity={0.7}
                    >
                      <MapPin size={12} color="#2563EB" />
                      <Text style={styles.coordActionBtnText}>Map Pin</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2-Column Lat / Long Inputs */}
                <View style={[styles.formRow, { marginTop: 12 }]}>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>Latitude</Text>
                    <TextInput
                      style={styles.inputBox}
                      value={latitude}
                      onChangeText={setLatitude}
                      keyboardType="numeric"
                      placeholder="12.962879"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>Longitude</Text>
                    <TextInput
                      style={styles.inputBox}
                      value={longitude}
                      onChangeText={setLongitude}
                      keyboardType="numeric"
                      placeholder="77.5968"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Specified Location Landmark Input */}
                <Text style={styles.fieldLabel}>Specified Location Name / Landmark (Optional)</Text>
                <TextInput
                  style={[styles.inputBox, { marginBottom: 12 }]}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="St. Joseph's University, Richmond Circle Flyover, Langford..."
                  placeholderTextColor="#94A3B8"
                />

                {/* Save Coordinates to Primary Site Button */}
                <View style={styles.saveToSiteRow}>
                  <TouchableOpacity
                    style={styles.saveToSiteBtn}
                    onPress={handleSaveCoordsToSite}
                    activeOpacity={0.8}
                  >
                    <Building2 size={13} color="#2563EB" />
                    <Text style={styles.saveToSiteBtnText}>
                      Save Coordinates to "{primarySite?.name || 'Surat ST-1'}"
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.saveToSiteHelpText}>Updates site profile permanently</Text>
                </View>

                {/* Tagged GPS Status & View on Google Maps Link */}
                <View style={styles.taggedGpsRow}>
                  <View style={styles.taggedGpsCol}>
                    <View style={styles.greenGpsDot} />
                    <Text style={styles.taggedGpsText}>
                      Tagged GPS: {parseFloat(latitude || '0').toFixed(6)},{' '}
                      {parseFloat(longitude || '0').toFixed(6)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.viewMapsLink}
                    onPress={handleOpenGoogleMaps}
                    activeOpacity={0.7}
                  >
                    <MapPin size={12} color="#2563EB" />
                    <Text style={styles.viewMapsLinkText}>View on Google Maps</Text>
                    <ExternalLink size={10} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION: Shift Status */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>Shift Status</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setPickerType('shift')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownText}>{shiftStatus}</Text>
                  <ChevronDown size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Modal Bottom Actions: Cancel & Save Changes */}
            <View style={styles.modalBottomActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveEmployee}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* QUICK PICKER POPUP MODAL (Designation, Role, Shift)          */}
      {/* ============================================================ */}
      <Modal visible={!!pickerType} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setPickerType(null)}
        >
          <View style={[styles.pickerBox, SHADOWS.lg]}>
            <Text style={styles.pickerTitle}>
              {pickerType === 'designation'
                ? 'Select Designation'
                : pickerType === 'role'
                ? 'Select System Role'
                : 'Select Shift Status'}
            </Text>

            {pickerType === 'designation' &&
              DESIGNATION_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.pickerOption, designation === item && styles.pickerOptionActive]}
                  onPress={() => {
                    setDesignation(item);
                    setPickerType(null);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      designation === item && styles.pickerOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {designation === item && <Check size={16} color="#2563EB" />}
                </TouchableOpacity>
              ))}

            {pickerType === 'role' &&
              ROLE_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.pickerOption, role === item.value && styles.pickerOptionActive]}
                  onPress={() => {
                    setRole(item.value);
                    setPickerType(null);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      role === item.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {role === item.value && <Check size={16} color="#2563EB" />}
                </TouchableOpacity>
              ))}

            {pickerType === 'shift' &&
              SHIFT_STATUS_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.pickerOption, shiftStatus === item && styles.pickerOptionActive]}
                  onPress={() => {
                    setShiftStatus(item);
                    setPickerType(null);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      shiftStatus === item && styles.pickerOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {shiftStatus === item && <Check size={16} color="#2563EB" />}
                </TouchableOpacity>
              ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Admin Navigation Drawer */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  menuBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#1E63F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E63F0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#1E63F0',
    borderColor: '#1E63F0',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },

  // Modal Styles (Matches Image 2)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 14,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    maxHeight: '94%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalScrollView: {
    maxHeight: Dimensions.get('window').height * 0.72,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  formCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  inputBox: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  dropdownBtn: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dropdownText: {
    fontSize: 12,
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },

  // Assigned Substations Section
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionSubHeading: {
    fontSize: 10,
    color: '#64748B',
  },
  selectedPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  sitesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  siteCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  siteCardAssigned: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  siteCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  assignedBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  assignedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  siteCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  siteCardCode: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  siteCardCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  siteCardCoordsText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },

  // Specified Location Coordinates Section Card
  coordsSectionCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 14,
  },
  coordsHeaderRow: {
    flexDirection: 'column',
    gap: 8,
  },
  coordsTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordsIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordsHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  coordsSubHeading: {
    fontSize: 9,
    color: '#64748B',
  },
  coordsActionsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  coordActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  coordActionBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  saveToSiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  saveToSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  saveToSiteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  saveToSiteHelpText: {
    fontSize: 9,
    color: '#64748B',
  },
  taggedGpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 6,
  },
  taggedGpsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenGpsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  taggedGpsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  viewMapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewMapsLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Modal Bottom Actions
  modalBottomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Picker Backdrop & Box
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  pickerOptionTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
});

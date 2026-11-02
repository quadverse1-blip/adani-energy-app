import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Image,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle } from '../../components/common/AppMapView';
import * as Location from 'expo-location';
import {
  Plus,
  MapPin,
  Zap,
  Phone,
  Mail,
  Edit,
  Trash2,
  X,
  Shield,
  Layers,
  Menu,
  Search,
  Crosshair,
  ExternalLink,
  Clock,
  User,
  Building2,
  ChevronDown,
  Check,
  RotateCcw,
  Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { siteService } from '../../services/siteService';
import { Substation } from '../../types';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AppBackButton } from '../../components/common/AppBackButton';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';

const { width, height } = Dimensions.get('window');

const QUICK_PINS = [
  {
    name: 'Surat ST-1',
    code: 'ADN-SITE-010',
    address: 'Ring Road, Textile Market Hub, Surat, Gujarat 395002',
    latitude: 21.1926,
    longitude: 72.7997,
  },
  {
    name: 'Pune Phase 1',
    code: 'ADN-PS-001',
    address: 'Hinjawadi Phase 1, Near Tata T-Hub, Pune, Maharashtra 411057',
    latitude: 18.5913,
    longitude: 73.7389,
  },
  {
    name: 'BKC Smart Grid',
    code: 'ADN-BKC-001',
    address: 'Bandra Kurla Complex, G Block, Mumbai, Maharashtra 400051',
    latitude: 19.0657,
    longitude: 72.8679,
  },
  {
    name: 'Ahmedabad Solar',
    code: 'ADN-AMD-001',
    address: 'Adani Shantigram, SG Highway, Ahmedabad, Gujarat 382421',
    latitude: 23.0225,
    longitude: 72.5714,
  },
  {
    name: 'Mundra Energy Port',
    code: 'ADN-MUN-001',
    address: 'APSEZ Mundra Port Zone, Kutch, Gujarat 370421',
    latitude: 22.7533,
    longitude: 69.7042,
  },
  {
    name: 'Bengaluru Tech Grid',
    code: 'ADN-BLR-001',
    address: 'Electronic City Phase 1, Bengaluru, Karnataka 560100',
    latitude: 12.8452,
    longitude: 77.6602,
  },
];

interface LocationSuggestion {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export const SitesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAdminDrawerStore();
  const [sites, setSites] = useState<Substation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add/Edit Substation Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Substation | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('500');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [workingHours, setWorkingHours] = useState('09:00 AM - 06:00 PM');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search & Map Navigation States
  const searchDebounceTimer = useRef<any>(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Map state
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 21.1926,
    longitude: 72.7997,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const fetchSites = async () => {
    setLoading(true);
    try {
      const data = await siteService.getSites();
      setSites(data);
    } catch (e) {
      console.warn('Sites fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSites();
    setRefreshing(false);
  };

  const handleOpenAdd = () => {
    setEditingSite(null);
    setName('');
    setCode(`ADN-SITE-00${sites.length + 1}`);
    setAddress('');
    setLatitude('21.1926');
    setLongitude('72.7997');
    setRadiusMeters('500');
    setManagerName('');
    setManagerPhone('');
    setManagerEmail('');
    setWorkingHours('');
    setStatus('Active');
    setSearchLocation('');
    setSuggestions([]);
    setShowSuggestions(false);

    const initialRegion = {
      latitude: 21.1926,
      longitude: 72.7997,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
    setRegion(initialRegion);
    setShowModal(true);
  };

  const handleOpenEdit = (site: Substation) => {
    setEditingSite(site);
    setName(site.name);
    setCode(site.code);
    setAddress(site.address || '');
    setLatitude(site.latitude.toString());
    setLongitude(site.longitude.toString());
    setRadiusMeters((site.radiusMeters || 500).toString());
    setManagerName(site.manager?.name || '');
    setManagerPhone(site.manager?.phone || '');
    setManagerEmail(site.manager?.email || '');
    setWorkingHours(site.workingHours || '');
    setStatus(site.status === 'inactive' ? 'Inactive' : 'Active');
    setSearchLocation(site.name || site.address || '');
    setSuggestions([]);
    setShowSuggestions(false);

    const siteRegion = {
      latitude: site.latitude,
      longitude: site.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
    setRegion(siteRegion);
    setShowModal(true);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setRegion((prev) => {
      const nextDelta = Math.max(prev.latitudeDelta / 2, 0.002);
      const nextRegion = {
        ...prev,
        latitudeDelta: nextDelta,
        longitudeDelta: nextDelta,
      };
      mapRef.current?.animateToRegion(nextRegion, 250);
      return nextRegion;
    });
  };

  const handleZoomOut = () => {
    setRegion((prev) => {
      const nextDelta = Math.min(prev.latitudeDelta * 2, 0.3);
      const nextRegion = {
        ...prev,
        latitudeDelta: nextDelta,
        longitudeDelta: nextDelta,
      };
      mapRef.current?.animateToRegion(nextRegion, 250);
      return nextRegion;
    });
  };

  // Map press / pin drag
  const handleMapPress = async (coord: { latitude: number; longitude: number }) => {
    setLatitude(coord.latitude.toFixed(6));
    setLongitude(coord.longitude.toFixed(6));

    const nextRegion = {
      ...region,
      latitude: coord.latitude,
      longitude: coord.longitude,
    };
    setRegion(nextRegion);

    try {
      const rev = await Location.reverseGeocodeAsync({
        latitude: coord.latitude,
        longitude: coord.longitude,
      });
      if (rev && rev.length > 0) {
        const r = rev[0];
        const addr = [r.name, r.street, r.city, r.region, r.postalCode]
          .filter(Boolean)
          .join(', ');
        if (addr) {
          setAddress(addr);
          setSearchLocation(addr);
        }
      }
    } catch (e) {
      // Keep existing address
    }
  };

  // Quick pin selection
  const handleSelectQuickPin = (pin: (typeof QUICK_PINS)[0]) => {
    setName(pin.name);
    setCode(pin.code);
    setAddress(pin.address);
    setLatitude(pin.latitude.toFixed(6));
    setLongitude(pin.longitude.toFixed(6));
    setSearchLocation(pin.name);
    setShowSuggestions(false);

    const nextRegion = {
      latitude: pin.latitude,
      longitude: pin.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 400);
  };

  // Pin Current GPS Location
  const handlePinCurrentGPS = async () => {
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access device location is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));

      const nextRegion = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 400);

      const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (rev && rev.length > 0) {
        const r = rev[0];
        const addr = [r.name, r.street, r.city, r.region, r.postalCode]
          .filter(Boolean)
          .join(', ');
        if (addr) {
          setAddress(addr);
          setSearchLocation(addr);
        }
      }
    } catch (err: any) {
      Alert.alert('GPS Error', err.message || 'Could not acquire GPS position.');
    }
  };

  // Autocomplete Suggestions on Input Change (Real-Time Indian Geocoding + Quick Pins)
  const handleSearchTextChange = (text: string) => {
    setSearchLocation(text);
    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchingLocation(false);
      if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
      return;
    }

    const query = text.trim().toLowerCase();

    // 1. Instantly match preset hubs and created sites
    const localMatches: LocationSuggestion[] = [];
    const allPresets = QUICK_PINS.concat(
      sites.map((s) => ({
        name: s.name,
        code: s.code,
        address: s.address || '',
        latitude: s.latitude,
        longitude: s.longitude,
        managerName: s.manager?.name || '',
        workingHours: s.workingHours || '09:00 AM - 06:00 PM',
      }))
    );

    for (const p of allPresets) {
      if (
        p.name.toLowerCase().includes(query) ||
        p.address.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query)
      ) {
        localMatches.push({
          title: p.name,
          subtitle: p.address,
          lat: p.latitude,
          lng: p.longitude,
        });
      }
    }

    if (localMatches.length > 0) {
      setSuggestions(localMatches.slice(0, 4));
      setShowSuggestions(true);
    }

    // 2. Debounce online Nominatim & Expo Geocoding lookup
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    setSearchingLocation(true);
    searchDebounceTimer.current = setTimeout(async () => {
      try {
        const onlineSuggestions: LocationSuggestion[] = [];

        // Real-time OpenStreetMap Nominatim search
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            text.trim()
          )}&limit=5`;
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'AdaniWorkforceApp/1.0' },
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              for (const item of data) {
                const displayName = item.display_name || '';
                const parts = displayName.split(',');
                const title = parts[0]?.trim() || text.trim();
                const lat = parseFloat(item.lat);
                const lng = parseFloat(item.lon);
                if (!isNaN(lat) && !isNaN(lng)) {
                  onlineSuggestions.push({
                    title,
                    subtitle: displayName,
                    lat,
                    lng,
                  });
                }
              }
            }
          }
        } catch (fetchErr) {
          // Nominatim fetch notice
        }

        // Native Expo Geocoder fallback
        if (onlineSuggestions.length < 3) {
          try {
            const geo = await Location.geocodeAsync(text.trim());
            if (geo && geo.length > 0) {
              for (const g of geo.slice(0, 3)) {
                onlineSuggestions.push({
                  title: text.trim(),
                  subtitle: `GPS: ${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}`,
                  lat: g.latitude,
                  lng: g.longitude,
                });
              }
            }
          } catch (geoErr) {}
        }

        // Merge without duplicates
        const combined = [...localMatches];
        for (const item of onlineSuggestions) {
          const exists = combined.some(
            (c) => Math.abs(c.lat - item.lat) < 0.001 && Math.abs(c.lng - item.lng) < 0.001
          );
          if (!exists) {
            combined.push(item);
          }
        }

        if (combined.length > 0) {
          setSuggestions(combined.slice(0, 6));
          setShowSuggestions(true);
        }
      } catch (err) {
        console.warn('Autocomplete search notice:', err);
      } finally {
        setSearchingLocation(false);
      }
    }, 250);
  };

  // Select a suggestion and auto-populate site specifications
  const handleSelectSuggestion = (item: LocationSuggestion) => {
    setSearchLocation(item.title);
    setAddress(item.subtitle);
    if (!name.trim()) {
      setName(item.title);
    }
    setLatitude(item.lat.toFixed(6));
    setLongitude(item.lng.toFixed(6));
    setShowSuggestions(false);
    setSuggestions([]);

    const nextRegion = {
      latitude: item.lat,
      longitude: item.lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 400);
  };

  // Search & Navigate Action Button
  const handleSearchAndNavigate = async () => {
    if (!searchLocation.trim()) return;
    setSearchingLocation(true);
    try {
      const geo = await Location.geocodeAsync(searchLocation);
      if (geo && geo.length > 0) {
        const lat = geo[0].latitude;
        const lng = geo[0].longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setShowSuggestions(false);

        const nextRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        };
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 400);

        const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (rev && rev.length > 0) {
          const r = rev[0];
          const addr = [r.name, r.street, r.city, r.region, r.postalCode]
            .filter(Boolean)
            .join(', ');
          if (addr) setAddress(addr);
        }
      } else {
        Alert.alert(
          'Location Not Found',
          `Could not resolve coordinates for "${searchLocation}". Tap on the map to pin manually.`
        );
      }
    } catch (err: any) {
      Alert.alert('Search Error', err.message || 'Location search failed.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert('Required Fields', 'Please enter Site Name and Site Code.');
      return;
    }

    const rad = parseFloat(radiusMeters);
    if (isNaN(rad) || rad < 50 || rad > 5000) {
      Alert.alert('Invalid Radius', 'Attendance radius must be between 50m and 5000m.');
      return;
    }

    setSaving(true);
    try {
      const hasManager = managerName.trim().length > 0 || managerPhone.trim().length > 0;
      const sitePayload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim() || undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: rad,
        voltageClass: editingSite?.voltageClass || undefined,
        manager: hasManager ? {
          name: managerName.trim() || undefined,
          phone: managerPhone.trim() || undefined,
          designation: 'Site Manager',
        } : undefined,
        workingHours: workingHours.trim() || undefined,
        status: status.toLowerCase() as 'active' | 'inactive',
      };

      if (editingSite) {
        await siteService.updateSite(editingSite.id, sitePayload);
        Alert.alert('Success', `Site "${name}" updated successfully.`);
      } else {
        await siteService.createSite(sitePayload);
        Alert.alert('Success', `New site "${name}" created successfully.`);
      }
      setShowModal(false);
      fetchSites();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save site record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (site: Substation) => {
    Alert.alert('Delete Site', `Permanently delete ${site.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await siteService.deleteSite(site.id);
            fetchSites();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const parsedLat = parseFloat(latitude) || 21.1926;
  const parsedLng = parseFloat(longitude) || 72.7997;
  const parsedRadius = parseFloat(radiusMeters) || 500;

  return (
    <View style={styles.container}>
      {/* Top Header with 3-Line Menu */}
      <View
        style={[
          styles.headerRow,
          { paddingTop: Math.max(insets.top, 24) + 8 },
        ]}
      >
        <AppBackButton style={{ marginRight: 8 }} />

        <TouchableOpacity delayPressIn={0}
          style={styles.menuBtn}
          onPress={() => openDrawer('Sites')}
          activeOpacity={0.7}
          accessibilityLabel="Open Navigation Menu"
        >
          <Menu size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={styles.headerTitle}>Site Management</Text>
        </View>

        <TouchableOpacity delayPressIn={0} style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.8}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Substations Cards List (Matching Background of User Photo) */}
      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 30 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        renderItem={({ item }) => (
          <AppCard style={styles.siteCard}>
            {/* Top Image Banner */}
            <View style={styles.cardImageWrap}>
              <Image
                source={{
                  uri:
                    item.photoUrl ||
                    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80',
                }}
                style={styles.cardImage}
              />
              <View style={styles.cardImageOverlay} />

              {/* Distance Tag on Image */}
              <View style={styles.distanceTag}>
                <View style={styles.distanceDot} />
                <Text style={styles.distanceText}>271 km</Text>
              </View>

              {/* Active Status Badge on Image */}
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText}>
                  {item.status ? item.status.toUpperCase() : 'ACTIVE'}
                </Text>
              </View>
            </View>

            {/* Site Info Content */}
            <View style={styles.cardBody}>
              <View style={styles.siteTitleRow}>
                <Text style={styles.siteName}>{item.name}</Text>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{item.code}</Text>
                </View>
              </View>

              {/* Address */}
              <View style={styles.infoRow}>
                <MapPin size={14} color="#EF4444" style={{ marginTop: 2, marginRight: 6 }} />
                <Text style={styles.infoText} numberOfLines={2}>
                  {item.address}
                </Text>
              </View>

              {/* Manager */}
              <View style={styles.infoRow}>
                <User size={14} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Manager: </Text>
                <Text style={styles.infoVal}>
                  {item.manager?.name || (item.manager?.phone ? item.manager.phone : 'Not Assigned')}
                </Text>
              </View>
              {item.manager?.phone && item.manager?.name ? (
                <View style={styles.infoRow}>
                  <Phone size={14} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.infoLabel}>Contact: </Text>
                  <Text style={styles.infoVal}>{item.manager.phone}</Text>
                </View>
              ) : null}

              {/* Working Hours */}
              <View style={styles.infoRow}>
                <Clock size={14} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Hours: </Text>
                <Text style={styles.infoVal}>
                  {item.workingHours || 'Standard Shift'}
                </Text>
              </View>

              {/* Allowed Radius */}
              <View style={styles.infoRow}>
                <Shield size={14} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Allowed Radius: </Text>
                <Text style={[styles.infoVal, { color: '#059669', fontWeight: '800' }]}>
                  {item.radiusMeters || 500}m
                </Text>
              </View>

              {/* GPS Tag with Link */}
              <TouchableOpacity delayPressIn={0}
                style={styles.gpsLinkRow}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
                  )
                }
              >
                <Zap size={13} color="#2563EB" style={{ marginRight: 5 }} />
                <Text style={styles.gpsLinkText}>
                  GPS Tag: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                </Text>
                <ExternalLink size={12} color="#2563EB" style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              {/* Action Buttons Row */}
              <View style={styles.actionRow}>
                <TouchableOpacity delayPressIn={0} style={styles.rosterBtn} activeOpacity={0.8}>
                  <Users size={14} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.rosterBtnText}>STAFF ROSTER</Text>
                </TouchableOpacity>

                <View style={styles.iconActionsWrap}>
                  <TouchableOpacity delayPressIn={0}
                    style={styles.iconActionBtn}
                    onPress={() => handleOpenEdit(item)}
                    activeOpacity={0.7}
                  >
                    <Edit size={16} color="#64748B" />
                  </TouchableOpacity>

                  <TouchableOpacity delayPressIn={0}
                    style={[styles.iconActionBtn, { backgroundColor: '#FEF2F2' }]}
                    onPress={() => handleDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </AppCard>
        )}
      />

      {/* ========================================================================= */}
      {/* ADD / EDIT SITE MODAL DIALOG (MATCHES USER IMAGE EXACTLY)                  */}
      {/* ========================================================================= */}
      <Modal visible={showModal} animationType="fade" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, SHADOWS.lg]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSite ? `Edit Site: ${name || editingSite.name}` : 'Add New Site'}
              </Text>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Row 1: Site Name & Site Code */}
              <View style={styles.formRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Site Name</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="e.g. Surat ST-1"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Site Code</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="e.g. ADN-SITE-010"
                    placeholderTextColor="#94A3B8"
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
              </View>

              {/* Location Section Header & Pin GPS Button */}
              <View style={styles.locationHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.locationSectionTitle}>Site Location & Address</Text>
                </View>

                <TouchableOpacity delayPressIn={0}
                  style={styles.pinGpsBtn}
                  onPress={handlePinCurrentGPS}
                  activeOpacity={0.8}
                >
                  <Crosshair size={14} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.pinGpsBtnText}>Pin My Current GPS</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar with Autocomplete Suggestions */}
              <View style={styles.searchBarWrapper}>
                <View style={styles.searchInputContainer}>
                  <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchTextInput}
                    placeholder="Search by location, city, or address..."
                    placeholderTextColor="#94A3B8"
                    value={searchLocation}
                    onChangeText={handleSearchTextChange}
                    onSubmitEditing={handleSearchAndNavigate}
                  />
                  {searchLocation.length > 0 && (
                    <TouchableOpacity delayPressIn={0}
                      onPress={() => {
                        setSearchLocation('');
                        setSuggestions([]);
                        setShowSuggestions(false);
                      }}
                      style={{ padding: 4 }}
                    >
                      <X size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity delayPressIn={0}
                  style={styles.searchNavBtn}
                  onPress={handleSearchAndNavigate}
                  activeOpacity={0.85}
                  disabled={searchingLocation}
                >
                  {searchingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.searchNavBtnText}>Search & Navigate</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Autocomplete Suggestions Dropdown with Immediate Pinning */}
              {showSuggestions && suggestions.length > 0 && (
                <View style={[styles.suggestionsBox, SHADOWS.md]}>
                  <View style={styles.suggestionsHeader}>
                    <Text style={styles.suggestionsHeaderText}>
                      SELECT LOCATION SUGGESTION ({suggestions.length})
                    </Text>
                  </View>
                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {suggestions.map((item, index) => (
                      <TouchableOpacity delayPressIn={0}
                        key={`${item.title}-${index}`}
                        style={[
                          styles.suggestionItem,
                          index === suggestions.length - 1 && { borderBottomWidth: 0 },
                        ]}
                        onPress={() => handleSelectSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.suggestionIconWrap}>
                          <MapPin size={15} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.suggestionSub} numberOfLines={2}>
                            {item.subtitle}
                          </Text>
                          <View style={styles.coordTag}>
                            <Text style={styles.coordTagText}>
                              GPS: {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Interactive Embedded Map */}
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  region={region}
                  onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
                >
                  {/* Geofence Perimeter Circle */}
                  <Circle
                    center={{ latitude: parsedLat, longitude: parsedLng }}
                    radius={parsedRadius}
                    strokeColor="#10B981"
                    strokeWidth={2}
                    fillColor="rgba(16, 185, 129, 0.16)"
                  />

                  {/* Tagged Location Custom Marker */}
                  <Marker
                    coordinate={{ latitude: parsedLat, longitude: parsedLng }}
                    draggable
                    onDragEnd={(e) => handleMapPress(e.nativeEvent.coordinate)}
                  >
                    <View style={styles.customMarkerContainer}>
                      <View style={styles.customMarkerPill}>
                        <Building2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.customMarkerText} numberOfLines={1}>
                          {name || 'Surat ST-1'}
                        </Text>
                      </View>
                      <View style={styles.markerTriangle} />
                    </View>
                  </Marker>
                </MapView>

                {/* Top Overlay Instruction Banner */}
                <View style={styles.mapInstructionPill}>
                  <View style={styles.greenInstructionDot} />
                  <Text style={styles.mapInstructionText}>
                    Click map or drag pin to tag exact location
                  </Text>
                </View>

                {/* Map Engine Badge (Bottom Left) */}
                <View style={styles.mapEngineBadge}>
                  <View style={styles.engineDot} />
                  <Text style={styles.mapEngineText}>
                    Map Engine: Leaflet + OpenStreetMap & Mappls GIS API
                  </Text>
                </View>

                {/* Map Zoom Controls (+ / -) */}
                <View style={styles.zoomControlsWrap}>
                  <TouchableOpacity delayPressIn={0}
                    style={styles.zoomBtn}
                    onPress={handleZoomIn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.zoomBtnText}>+</Text>
                  </TouchableOpacity>
                  <View style={styles.zoomDivider} />
                  <TouchableOpacity delayPressIn={0}
                    style={styles.zoomBtn}
                    onPress={handleZoomOut}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.zoomBtnText}>−</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Coordinates & Geofence Status Bar */}
              <View style={styles.statusCoordsBar}>
                <View style={styles.gpsCoordRow}>
                  <View style={styles.redCoordDot} />
                  <Text style={styles.gpsCoordText}>
                    GPS Coordinates: <Text style={styles.gpsCoordBold}>{parsedLat.toFixed(6)}, {parsedLng.toFixed(6)}</Text>
                  </Text>
                </View>

                <View style={styles.geofencePerimeterPill}>
                  <Shield size={12} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.geofencePerimeterText}>
                    {radiusMeters}m Geofence Perimeter
                  </Text>
                </View>
              </View>

              {/* Quick Pins Row */}
              <View style={styles.quickPinsRow}>
                <Text style={styles.quickPinsLabel}>QUICK PINS:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {QUICK_PINS.map((pin) => (
                    <TouchableOpacity delayPressIn={0}
                      key={pin.name}
                      style={[
                        styles.quickPinChip,
                        name === pin.name && styles.quickPinChipActive,
                      ]}
                      onPress={() => handleSelectQuickPin(pin)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickPinText,
                          name === pin.name && styles.quickPinTextActive,
                        ]}
                      >
                        {pin.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Row 2: Latitude & Longitude */}
              <View style={styles.formRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Latitude</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="21.1926"
                    placeholderTextColor="#94A3B8"
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Longitude</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="72.7997"
                    placeholderTextColor="#94A3B8"
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Row 3: Site Manager & Manager Phone */}
              <View style={styles.formRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Manager / In-Charge Name</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Enter manager name"
                    placeholderTextColor="#94A3B8"
                    value={managerName}
                    onChangeText={setManagerName}
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Manager Phone Number</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Enter phone number"
                    placeholderTextColor="#94A3B8"
                    value={managerPhone}
                    onChangeText={setManagerPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Row 4: Attendance Radius & Working Hours */}
              <View style={styles.formRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Attendance Radius (meters)</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="500"
                    placeholderTextColor="#94A3B8"
                    value={radiusMeters}
                    onChangeText={setRadiusMeters}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Working Hours</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="e.g. 09:00 AM - 06:00 PM"
                    placeholderTextColor="#94A3B8"
                    value={workingHours}
                    onChangeText={setWorkingHours}
                  />
                </View>
              </View>

              {/* Row 5: Status */}
              <View style={styles.formRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <TouchableOpacity delayPressIn={0}
                    style={styles.selectBox}
                    onPress={() => setShowStatusPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.selectBoxText}>{status}</Text>
                    <ChevronDown size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Footer Action Buttons */}
              <View style={styles.footerRow}>
                <TouchableOpacity delayPressIn={0}
                  style={styles.cancelBtn}
                  onPress={() => setShowModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={styles.saveChangesBtn}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveChangesBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Status Dropdown Picker Modal */}
        <Modal
          visible={showStatusPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatusPicker(false)}
        >
          <TouchableOpacity delayPressIn={0}
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowStatusPicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Select Site Status</Text>
              {(['Active', 'Inactive'] as const).map((opt) => (
                <TouchableOpacity delayPressIn={0}
                  key={opt}
                  style={[
                    styles.pickerOption,
                    status === opt && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setStatus(opt);
                    setShowStatusPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      status === opt && styles.pickerOptionTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                  {status === opt && <Check size={16} color="#1E63F0" />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Admin Slide-Out Drawer Navigation */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  menuBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADII.btn,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADII.btn,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  siteCard: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardImageWrap: {
    width: '100%',
    height: 125,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  distanceTag: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    marginRight: 5,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusPill: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  cardBody: {
    padding: 14,
  },
  siteTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  codeBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E63F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  gpsLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  gpsLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  rosterBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  iconActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: Math.min(width - 20, 520),
    maxHeight: height * 0.92,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  colHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  locationSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  pinGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  pinGpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    position: 'relative',
    zIndex: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    height: 40,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
  },
  searchNavBtn: {
    backgroundColor: '#1E63F0',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
  },
  searchNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    marginTop: -4,
    marginBottom: 12,
    maxHeight: 240,
    overflow: 'hidden',
    shadowColor: '#1E63F0',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  suggestionsHeader: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  suggestionsHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  suggestionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  coordTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  coordTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  mapContainer: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  customMarkerContainer: {
    alignItems: 'center',
  },
  customMarkerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  customMarkerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  markerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#DC2626',
  },
  mapInstructionPill: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  greenInstructionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  mapInstructionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  mapEngineBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  engineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  mapEngineText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#334155',
  },
  zoomControlsWrap: {
    position: 'absolute',
    right: 8,
    bottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 30,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: -2,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  statusCoordsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gpsCoordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  redCoordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  gpsCoordText: {
    fontSize: 11,
    color: '#64748B',
  },
  gpsCoordBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  geofencePerimeterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  geofencePerimeterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  quickPinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  quickPinsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  quickPinChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPinChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E63F0',
  },
  quickPinText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quickPinTextActive: {
    color: '#1E63F0',
  },
  selectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    height: 40,
  },
  selectBoxText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveChangesBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveChangesBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pickerOptionTextActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
});

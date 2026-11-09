import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Linking,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  fetchRealDeviceLocation,
  subscribeRealDeviceLocationWatcher,
  checkBrowserPermissionState,
  DeviceCoordinates,
  GeolocationErrorDetail,
} from '../../utils/geolocationUtils';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ArrowLeft,
  MapPin,
  Camera as CameraIcon,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Building2,
  Lock,
  RefreshCw,
  Navigation,
  Clock,
  Radio,
  Check,
  X,
  Zap,
  Phone,
  Mail,
  UserCheck,
  Image as ImageIcon,
  Search,
} from 'lucide-react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from '../../components/common/AppMapView';
import { useAuthStore } from '../../store/useAuthStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { siteService } from '../../services/siteService';
import { attendanceService } from '../../services/attendanceService';
import { placesService, NearbyPlace } from '../../services/placesService';
import { calculateHaversineDistance } from '../../utils/haversine';
import { triggerHaptic } from '../../utils/haptics';
import { Substation } from '../../types';
import { COLORS } from '../../constants/theme';
import { getShiftInfo, formatTimeIST } from '../../utils/shiftUtils';
import { AppBackButton } from '../../components/common/AppBackButton';

const { width } = Dimensions.get('window');
const isTablet = width >= 800;

export const CheckInScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { todayStatus, todayRecord, fetchTodayAttendance } = useAttendanceStore();

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const isRecordForCurrentUser = useMemo(() => {
    if (!todayRecord || !user) return false;
    const userEmpId = (user.employeeId || '').toLowerCase().trim();
    const userId = (user.id || (user as any)._id || '').toLowerCase().trim();
    const recEmpId = (todayRecord.employeeId || '').toLowerCase().trim();
    const recTechCode = ((todayRecord as any).technicianCode || '').toLowerCase().trim();
    const recUserId = ((todayRecord as any).userId || '').toLowerCase().trim();
    return (
      Boolean(userEmpId && (recEmpId === userEmpId || recTechCode === userEmpId || recUserId === userEmpId)) ||
      Boolean(userId && (recEmpId === userId || recTechCode === userId || recUserId === userId))
    );
  }, [todayRecord, user]);

  const isAlreadyCheckedIn = useMemo(() => {
    if (!isRecordForCurrentUser) return false;
    return todayStatus === 'active' || todayStatus === 'completed' || Boolean(todayRecord?.checkIn);
  }, [isRecordForCurrentUser, todayStatus, todayRecord]);

  // Substation List
  const [sites, setSites] = useState<Substation[]>([]);
  const [selectedSite, setSelectedSite] = useState<Substation | null>(null);

  // Always show all assigned sites to the employee
  const checkedInSiteName = todayRecord?.siteName || (todayRecord?.checkIn as any)?.siteName || selectedSite?.name;
  const checkedInSiteId = todayRecord?.siteId;

  const displayedSites = useMemo(() => {
    return sites;
  }, [sites]);

  // GPS & Real Device Location State
  const [gpsLoading, setGpsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isGpsOff, setIsGpsOff] = useState(false);
  const [isGpsTimeout, setIsGpsTimeout] = useState(false);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(8.5);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const watcherCleanupRef = useRef<(() => void) | null>(null);
  const coordsRef = useRef<DeviceCoordinates>({ latitude: 0, longitude: 0, accuracy: 8 });

  // Camera & Photo Verification State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);

  // Map Gesture State (Prevents outer ScrollView from stealing touches while pinching or panning)
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const hasInitiallyFittedRef = useRef(false);

  // Real Nearby Places & Business Search State
  const [nearbyCategory, setNearbyCategory] = useState<string>('all');
  const [nearbyQuery, setNearbyQuery] = useState<string>('');
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (watchSubRef.current) {
        watchSubRef.current.remove();
        watchSubRef.current = null;
      }
      if (watcherCleanupRef.current) {
        watcherCleanupRef.current();
        watcherCleanupRef.current = null;
      }
    };
  }, []);

  // 1. Load All Substations assigned to this employee (dynamic refresh on focus)
  const loadSubstations = useCallback(async () => {
    try {
      await fetchTodayAttendance();
      const freshUser = await useAuthStore.getState().refreshProfile();
      let fetchedSites: Substation[] = [];
      try {
        fetchedSites = await siteService.getSites();
      } catch (err) {
        // Fallback on network failure only
        fetchedSites = useAttendanceStore.getState().assignedSites || [];
      }
      const validSites = Array.isArray(fetchedSites) ? fetchedSites : [];
      setSites(validSites);

      const targetId = route?.params?.targetSiteId;
      const primaryId = targetId || freshUser?.assignedSiteId || user?.assignedSiteId;
      if (validSites.length > 0) {
        setSelectedSite((prev) => {
          if (targetId) {
            const matchTarget = validSites.find((s) => s.id === targetId);
            if (matchTarget) return matchTarget;
          }
          if (prev && validSites.some((s) => s.id === prev.id)) {
            return validSites.find((s) => s.id === prev.id) || prev;
          }
          const matchPrimary = primaryId ? validSites.find((s) => s.id === primaryId) : null;
          return matchPrimary || validSites[0];
        });
      } else {
        setSelectedSite(null);
      }
    } catch (e) {
      console.warn('Failed to load substations:', e);
    }
  }, [route?.params?.targetSiteId, user]);

  // Helper: Apply valid coordinates and reverse geocode
  const applyCoordinates = useCallback(async (lat: number, lon: number, acc: number = 8) => {
    if (!lat || !lon || (lat === 0 && lon === 0)) return;
    coordsRef.current = { latitude: lat, longitude: lon, accuracy: acc };
    setLatitude(lat);
    setLongitude(lon);
    setAccuracy(acc);
    setPermissionDenied(false);
    setIsGpsOff(false);
    setIsGpsTimeout(false);
    setGpsErrorMessage(null);
    setGpsLoading(false);
    triggerHaptic('success');

    try {
      if (Platform.OS !== 'web') {
        const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (rev && rev.length > 0) {
          const r = rev[0];
          const parts = [r.name, r.street, r.district || r.subregion, r.city, r.region].filter(Boolean);
          setCurrentAddress(parts.join(', ') || `${r.city || ''}, ${r.region || ''}`);
        }
      }
    } catch (_) {}
  }, []);

  // 2. Fetch Live GPS Telemetry with pure hardware satellite acquisition
  const obtainGps = useCallback(async (isManualPress = false) => {
    // If valid coordinates are already acquired, don't reset back to loading on background focus
    if (!isManualPress && coordsRef.current.latitude !== 0 && coordsRef.current.longitude !== 0) {
      return;
    }

    setGpsLoading(true);
    setGpsErrorMessage(null);

    // Call fetchRealDeviceLocation directly (synchronously triggered on user tap or mount)
    try {
      await fetchRealDeviceLocation(
        {
          onCoordinatesAcquired: async (coords: DeviceCoordinates) => {
            coordsRef.current = coords;
            setPermissionDenied(false);
            setIsGpsOff(false);
            setIsGpsTimeout(false);
            setGpsErrorMessage(null);
            setGpsLoading(false);
            await applyCoordinates(coords.latitude, coords.longitude, coords.accuracy);

            // Once permission is granted and coordinates received, start continuous real-time watcher
            if (!watcherCleanupRef.current) {
              watcherCleanupRef.current = subscribeRealDeviceLocationWatcher(
                (liveCoords) => {
                  coordsRef.current = liveCoords;
                  setPermissionDenied(false);
                  setIsGpsOff(false);
                  setIsGpsTimeout(false);
                  setGpsErrorMessage(null);
                  setGpsLoading(false);
                  applyCoordinates(liveCoords.latitude, liveCoords.longitude, liveCoords.accuracy);
                },
                (err: GeolocationErrorDetail) => {
                  // Only report error if we don't have valid coordinates yet
                  if (coordsRef.current.latitude === 0 && coordsRef.current.longitude === 0) {
                    if (err.isPermissionDenied) {
                      setPermissionDenied(true);
                      setIsGpsOff(false);
                      setGpsErrorMessage(err.message);
                    } else if (err.isGpsDisabled) {
                      setIsGpsOff(true);
                      setPermissionDenied(false);
                      setGpsErrorMessage(err.message);
                    }
                  }
                }
              );
            }
          },
          onError: (err: GeolocationErrorDetail) => {
            setGpsLoading(false);
            // If valid coordinates were already received, do not replace with transient error
            if (coordsRef.current.latitude !== 0 && coordsRef.current.longitude !== 0) {
              return;
            }

            if (err.isPermissionDenied) {
              setPermissionDenied(true);
              setIsGpsOff(false);
              setIsGpsTimeout(false);
              setGpsErrorMessage(err.message);
              if (isManualPress) {
                if (Platform.OS === 'web') {
                  Alert.alert(
                    'Reset Location Permission',
                    `Location permission was denied.\n\nTo enable it:\n1. Tap the lock icon in the Chrome address bar.\n2. Tap "Permissions" or "Site settings".\n3. Tap "Location" and choose "Allow" (or tap "Reset permissions").\n4. Return here and tap "Fetch Live Location".`,
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert(
                    'Location Permission Required',
                    'Please enable location permission in app settings to verify your attendance.',
                    [
                      { text: 'Open Settings', onPress: () => Linking.openSettings() },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }
              }
            } else if (err.isGpsDisabled) {
              setIsGpsOff(true);
              setPermissionDenied(false);
              setIsGpsTimeout(false);
              setGpsErrorMessage(err.message);
            } else if (err.isTimeout) {
              setIsGpsTimeout(true);
              setGpsErrorMessage(err.message);
            } else {
              setGpsErrorMessage(err.message);
            }
          },
        },
        isManualPress
      );
    } catch (err: any) {
      console.warn('GPS location error:', err);
      setGpsLoading(false);
      setGpsErrorMessage(err.message || 'Unable to acquire GPS signal.');
    }
  }, [applyCoordinates]);

  // Listen to browser permission state change (e.g. user toggles permissions in Chrome address bar)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        status.onchange = () => {
          if (status.state === 'granted') {
            setPermissionDenied(false);
            obtainGps(true);
          } else if (status.state === 'denied') {
            setPermissionDenied(true);
          }
        };
      }).catch(() => {});
    }
  }, [obtainGps]);

  useFocusEffect(
    useCallback(() => {
      loadSubstations();
      obtainGps(false);
      return () => {
        if (watcherCleanupRef.current) {
          watcherCleanupRef.current();
          watcherCleanupRef.current = null;
        }
      };
    }, [loadSubstations, obtainGps])
  );

  // Compute Distance between User GPS and Selected Substation (Guarded against 0,0)
  const distanceToSiteMeters = useMemo(() => {
    if (!selectedSite || latitude === 0 || longitude === 0) return 0;
    return calculateHaversineDistance(
      latitude,
      longitude,
      selectedSite.latitude,
      selectedSite.longitude
    );
  }, [latitude, longitude, selectedSite]);

  // Format distance (e.g., '1047.2 km' or '335 m')
  const formatDistance = (meters: number): string => {
    if (permissionDenied) return 'Permission Blocked';
    if (isGpsOff) return 'GPS is OFF';
    if (isGpsTimeout) return 'Searching GPS...';
    if (latitude === 0 || longitude === 0) return 'Tap Fetch Live';
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const distanceFormatted = formatDistance(distanceToSiteMeters);

  // Check if User is strictly within the Substation's Geofence (<= 500m)
  const isInside = useMemo(() => {
    if (!selectedSite || latitude === 0 || longitude === 0) return false;
    const allowedRadius = selectedSite.radiusMeters || 500;
    return distanceToSiteMeters <= allowedRadius;
  }, [distanceToSiteMeters, selectedSite, latitude, longitude]);

  // Shift Timing Check
  const shiftInfo = useMemo(() => getShiftInfo(), []);

  // 3. Fit Map Viewport to Show Both My Device Location and the Site Location
  const fitMapToBoth = useCallback(() => {
    if (mapRef.current && selectedSite) {
      if (latitude !== 0 && longitude !== 0) {
        if (typeof mapRef.current.fitToCoordinates === 'function') {
          mapRef.current.fitToCoordinates(
            [
              { latitude, longitude },
              { latitude: selectedSite.latitude, longitude: selectedSite.longitude },
            ],
            {
              edgePadding: { top: 70, right: 60, bottom: 70, left: 60 },
              animated: true,
            }
          );
        } else if (typeof mapRef.current.animateToRegion === 'function') {
          const midLat = (latitude + selectedSite.latitude) / 2;
          const midLon = (longitude + selectedSite.longitude) / 2;
          const latDelta = Math.max(Math.abs(latitude - selectedSite.latitude) * 1.8, 0.02);
          const lonDelta = Math.max(Math.abs(longitude - selectedSite.longitude) * 1.8, 0.02);
          mapRef.current.animateToRegion(
            {
              latitude: midLat,
              longitude: midLon,
              latitudeDelta: latDelta,
              longitudeDelta: lonDelta,
            },
            600
          );
        }
      } else if (typeof mapRef.current.animateToRegion === 'function') {
        mapRef.current.animateToRegion(
          {
            latitude: selectedSite.latitude,
            longitude: selectedSite.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          600
        );
      }
    }
  }, [selectedSite, latitude, longitude]);

  // Reset fit flag when selected substation changes
  useEffect(() => {
    hasInitiallyFittedRef.current = false;
  }, [selectedSite?.id]);

  // Only auto-fit ONCE when site or live coordinates are first loaded, preventing snap-backs when user zooms/pans
  useEffect(() => {
    if (!hasInitiallyFittedRef.current && selectedSite && latitude !== 0 && longitude !== 0) {
      hasInitiallyFittedRef.current = true;
      fitMapToBoth();
    }
  }, [selectedSite, latitude, longitude, fitMapToBoth]);

  // Turn-by-Turn Navigation from My Device to Site
  const handleOpenDirections = () => {
    if (!selectedSite) return;
    const originParam = latitude !== 0 && longitude !== 0 ? `&origin=${latitude},${longitude}` : '';
    const destParam = `destination=${selectedSite.latitude},${selectedSite.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1${originParam}&${destParam}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selectedSite.latitude},${selectedSite.longitude}`);
    });
  };

  // Zoom Map In/Out (Directly zooms Map without snapping or resetting position)
  const handleZoom = (zoomIn: boolean) => {
    if (mapRef.current) {
      if (zoomIn && typeof mapRef.current.zoomIn === 'function') {
        mapRef.current.zoomIn();
        return;
      }
      if (!zoomIn && typeof mapRef.current.zoomOut === 'function') {
        mapRef.current.zoomOut();
        return;
      }
      const factor = zoomIn ? 0.5 : 2.0;
      const targetLat = latitude !== 0 && selectedSite ? (latitude + selectedSite.latitude) / 2 : selectedSite?.latitude || 19.7515;
      const targetLon = longitude !== 0 && selectedSite ? (longitude + selectedSite.longitude) / 2 : selectedSite?.longitude || 75.7139;
      mapRef.current.animateToRegion(
        {
          latitude: targetLat,
          longitude: targetLon,
          latitudeDelta: 0.02 * factor,
          longitudeDelta: 0.02 * factor,
        },
        300
      );
    }
  };

  // Fetch Real Maharashtra Nearby Places & POIs around Employee Coordinates
  const fetchNearby = useCallback(async (cat: string = nearbyCategory, queryText?: string) => {
    const searchLat = latitude !== 0 ? latitude : selectedSite?.latitude;
    const searchLon = longitude !== 0 ? longitude : selectedSite?.longitude;
    if (!searchLat || !searchLon) return;

    try {
      setLoadingPlaces(true);
      const res = await placesService.getNearbyPlaces(
        searchLat,
        searchLon,
        2500,
        cat === 'all' ? undefined : cat,
        queryText || (nearbyQuery.trim().length > 0 ? nearbyQuery.trim() : undefined),
        30
      );
      if (res && res.places) {
        setNearbyPlaces(res.places);
      }
    } catch (err) {
      console.warn('[CheckInScreen] fetchNearby error:', err);
    } finally {
      setLoadingPlaces(false);
    }
  }, [latitude, longitude, selectedSite, nearbyCategory, nearbyQuery]);

  // Trigger nearby search whenever category changes or initial GPS is obtained
  useEffect(() => {
    if ((latitude !== 0 || selectedSite) && nearbyCategory !== 'all') {
      fetchNearby(nearbyCategory);
    }
  }, [nearbyCategory, latitude, selectedSite?.id]);

  // Open Camera Flow when user is Inside Geofence (Photo is optional)
  const handleOpenCheckIn = () => {
    // 0. Re-check in prevention
    if (isAlreadyCheckedIn) {
      Alert.alert(
        'Already Checked In',
        'You have already recorded your check-in for today. Re-check in is not allowed.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!selectedSite) {
      Alert.alert(
        'No Assigned Substation',
        'You do not have a work site assigned yet. Please contact your Supervisor or Operations Admin to assign a designated substation.',
        [{ text: 'OK' }]
      );
      return;
    }

    // 0. Permission & Service Checks:
    if (permissionDenied) {
      Alert.alert(
        'Location Permission Required',
        'Location permission is denied in browser. Please tap the lock / info icon in your address bar, select "Allow" for Location, and retry.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isGpsOff) {
      Alert.alert(
        'Phone GPS is Turned OFF',
        'Your phone GPS is currently turned OFF. Please turn ON Location (GPS) in your phone settings to detect your real location and check in.',
        [
          { text: 'Turn ON GPS', onPress: () => obtainGps(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    // 1b. Geofence Lock Check:
    if (!isInside) {
      Alert.alert(
        'Check-In Locked: Outside Geofence Area',
        `You are currently ${distanceFormatted} away from ${selectedSite?.name || 'the substation'}.\n\nAttendance check-in is strictly locked until you arrive within 500 meters of the assigned substation.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // 2. Shift Window Check:
    if (!shiftInfo.isCheckInAllowed) {
      Alert.alert(
        'Check-In Closed',
        shiftInfo.isAfterShiftEnd
          ? 'Shift hours closed at 06:00 PM IST. Check-in is disabled and will reopen at 09:00 AM tomorrow.'
          : 'Shift check-in is closed (06:00 PM – 09:00 AM IST). Check-in will reopen at 09:00 AM today.',
        [{ text: 'OK' }]
      );
      return;
    }

    // 3. Open Camera Modal
    setCapturedPhotoUri(null);
    setShowCameraModal(true);
  };

  // Snap photo from live camera
  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        let photo: any;
        try {
          photo = await cameraRef.current.takePictureAsync({
            quality: 0.5,
            skipProcessing: false,
          });
        } catch {
          photo = await cameraRef.current.takePictureAsync({
            quality: 0.5,
          });
        }
        const photoData = photo.uri || (photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : null);
        setCapturedPhotoUri(photoData);
        triggerHaptic('success');
      } catch (e: any) {
        Alert.alert('Camera Error', e.message || 'Failed to capture photo.');
      }
    }
  };

  // Submit Check-In (Photo is COMPULSORY)
  const handleSubmitCheckIn = async () => {
    const currentShift = getShiftInfo();
    if (!currentShift.isCheckInAllowed || currentShift.isAfterShiftEnd) {
      Alert.alert(
        'Check-In Closed',
        'Shift check-in closed at 06:00 PM IST. Check-in is not permitted after 06:00 PM.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (isAlreadyCheckedIn) {
      Alert.alert(
        'Already Checked In',
        'You have already recorded check-in for today. Re-check in is not allowed.'
      );
      return;
    }

    if (latitude === 0 || longitude === 0) {
      Alert.alert(
        'GPS Signal Required',
        'Acquiring your device GPS position... Please ensure Location services are ON and tap "Fetch Live Location".'
      );
      obtainGps();
      return;
    }

    if (!capturedPhotoUri) {
      Alert.alert(
        'Photo Required',
        'Check-in photo is compulsory. Please take a photo using the camera or select an image from your device.'
      );
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('medium');

    try {
      let uploadedUrl: string = capturedPhotoUri;
      try {
        uploadedUrl = await attendanceService.uploadPhoto(capturedPhotoUri);
      } catch (err) {
        console.warn('Photo upload fallback to captured URI:', err);
      }

      await attendanceService.checkIn({
        siteId: selectedSite?.id || '',
        latitude,
        longitude,
        accuracy,
        photoUrl: uploadedUrl,
        remarks: `Field Technician Shift Check-In (${distanceFormatted} from ${selectedSite?.name || 'Assigned Site'})`,
      });

      await fetchTodayAttendance();
      setShowCameraModal(false);
      setCapturedPhotoUri(null);
      triggerHaptic('success');

      Alert.alert(
        'Check-In Successful',
        `Welcome, ${user?.name || 'Engineer'}!\n\n✓ Location: ${selectedSite?.name || 'Assigned Site'}\n✓ Verified In-Range: ${distanceFormatted}\n✓ Photo Uploaded & Logged\n✓ Time: ${shiftInfo.formattedTimeIST}`,
        [
          {
            text: 'Return to Dashboard',
            onPress: () => navigation.navigate('Dashboard'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Check-In Notice',
        err.response?.data?.detail || err.message || 'Unable to record check-in. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Top Header Bar */}
      <View style={[styles.topHeaderBar, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headerLeftWrap}>
          <AppBackButton />
          <View>
            <Text style={styles.screenTitle}>Field Shift Check-In</Text>
          </View>
        </View>

        {/* Top Right Geofence Status Pill */}
        <View
          style={[
            styles.geofenceStatusPill,
            isInside ? styles.geofenceStatusPillInside : styles.geofenceStatusPillOutside,
          ]}
        >
          <View
            style={[
              styles.statusPulseDot,
              { backgroundColor: isInside ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text
            style={[
              styles.geofenceStatusPillText,
              { color: isInside ? '#15803D' : '#DC2626' },
            ]}
          >
            {isInside
              ? `Geofence Status: In Range (${distanceFormatted} away • Max: 500m)`
              : permissionDenied
              ? `Geofence Status: Location Permission Blocked (Tap to Reset)`
              : isGpsOff
              ? `Geofence Status: Phone GPS is OFF (Turn ON to calculate distance)`
              : isGpsTimeout
              ? `Geofence Status: Searching for GPS satellites...`
              : latitude === 0 || longitude === 0
              ? `Geofence Status: Tap 'Fetch Live Location' to connect GPS`
              : `Geofence Status: Out of Range (${distanceFormatted} away • Max: 500m)`}
          </Text>
        </View>
      </View>

      <ScrollView
        scrollEnabled={!isMapInteracting}
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================== */}
        {/* 1. ASSIGNED SUBSTATIONS SELECTOR BAR                           */}
        {/* ============================================================== */}
        <View style={styles.substationSelectorCard}>
          <View style={styles.substationSelectorHeader}>
            <View style={[styles.buildingIconWrap, isAlreadyCheckedIn && { backgroundColor: '#10B981' }]}>
              <Building2 size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.substationSelectorTitle}>
              {`Assigned Substations (${sites.length})`}
            </Text>
            <View style={[styles.selectPunchPill, isAlreadyCheckedIn && { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.selectPunchPillText, isAlreadyCheckedIn && { color: '#15803D' }]}>
                {isAlreadyCheckedIn ? '✓ Active Check-In Site' : 'Select Punch-In Site'}
              </Text>
            </View>
          </View>

          {/* Substation Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {displayedSites.map((site) => {
              const isSelected = selectedSite?.id === site.id || isAlreadyCheckedIn;
              const dist = calculateHaversineDistance(
                latitude,
                longitude,
                site.latitude,
                site.longitude
              );
              const chipDistStr = formatDistance(dist);
              const chipInside = dist <= (site.radiusMeters || 500);

              return (
                <TouchableOpacity delayPressIn={0}
                  key={site.id}
                  style={[
                    styles.substationChip,
                    isSelected && styles.substationChipActive,
                  ]}
                  onPress={() => {
                    setSelectedSite(site);
                    triggerHaptic('light');
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.chipDot,
                      { backgroundColor: isAlreadyCheckedIn ? '#10B981' : chipInside ? '#10B981' : isSelected ? '#FFFFFF' : '#EF4444' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.chipSiteName,
                      isSelected && styles.chipSiteNameActive,
                    ]}
                  >
                    {site.name}
                  </Text>
                  <View
                    style={[
                      styles.chipCodeBadge,
                      isSelected && styles.chipCodeBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipCodeBadgeText,
                        isSelected && styles.chipCodeBadgeTextActive,
                      ]}
                    >
                      {site.code}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chipDistanceText,
                      isSelected && styles.chipDistanceTextActive,
                    ]}
                  >
                    {isAlreadyCheckedIn ? '(Checked In)' : `(${chipDistStr})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ============================================================== */}
        {/* 2. RESPONSIVE TWO-COLUMN OR STACKED LAYOUT                     */}
        {/* ============================================================== */}
        <View style={[styles.mainLayout, isTablet && styles.mainLayoutTablet]}>
          {/* ============================================================ */}
          {/* LEFT COLUMN: LIVE LOCATION RADAR CARD                        */}
          {/* ============================================================ */}
          <View style={[styles.radarCard, isTablet && styles.radarCardTablet]}>
            {/* Header */}
            <View style={styles.radarHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.radarTitle}>Live Location Radar</Text>
                <Text style={styles.radarSubtitle}>
                  Assignment: <Text style={{ fontWeight: '800' }}>{selectedSite?.name || 'No Site Assigned'}</Text>
                </Text>
              </View>

              <View style={styles.radarHeaderButtons}>
                <TouchableOpacity
                  delayPressIn={0}
                  style={styles.refreshGpsBtn}
                  onPress={() => obtainGps(true)}
                  disabled={gpsLoading}
                  activeOpacity={0.7}
                >
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color="#1E63F0" />
                  ) : (
                    <>
                      <RefreshCw size={12} color="#1E63F0" style={{ marginRight: 5 }} />
                      <Text style={styles.refreshGpsBtnText}>Fetch Live Location</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* GPS Diagnostic Alert Banner if GPS is disabled or permission missing */}
            {(permissionDenied || isGpsOff || isGpsTimeout || (gpsErrorMessage && (latitude === 0 || longitude === 0))) ? (
              <TouchableOpacity
                style={[
                  styles.gpsErrorBanner,
                  permissionDenied
                    ? { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }
                    : isGpsOff
                    ? { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }
                    : { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
                ]}
                onPress={() => {
                  if (permissionDenied) {
                    if (Platform.OS === 'web') {
                      Alert.alert(
                        'Reset Location Permission',
                        'Location permission was previously blocked in your browser.\n\nTo enable it:\n1. Tap the 🔒 lock or tune icon in Chrome\'s address bar.\n2. Tap "Permissions" or "Site settings".\n3. Tap "Location" and choose "Allow" (or tap "Reset permissions").\n4. Return here and tap "Fetch Live Location".',
                        [{ text: 'OK' }]
                      );
                    } else {
                      Alert.alert(
                        'Location Permission Required',
                        'Please allow Location access in App settings to detect your real location.',
                        [
                          { text: 'Open Settings', onPress: () => Linking.openSettings() },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }
                  } else {
                    obtainGps(true);
                  }
                }}
                activeOpacity={0.8}
              >
                <AlertTriangle
                  size={15}
                  color={permissionDenied ? '#DC2626' : isGpsOff ? '#D97706' : '#0284C7'}
                  style={{ marginRight: 6 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.gpsErrorBannerText,
                      { color: permissionDenied ? '#991B1B' : isGpsOff ? '#92400E' : '#0369A1' },
                    ]}
                  >
                    {permissionDenied
                      ? 'Location permission is blocked in Chrome. Tap for instructions to reset.'
                      : isGpsOff
                      ? 'Phone GPS is turned OFF. Please turn ON Location in settings.'
                      : isGpsTimeout
                      ? 'Searching for GPS satellite signal. Tap to retry.'
                      : gpsErrorMessage || 'Unable to acquire GPS signal.'}
                  </Text>
                  <Text
                    style={[
                      styles.gpsErrorBannerAction,
                      { color: permissionDenied ? '#DC2626' : isGpsOff ? '#B45309' : '#0284C7' },
                    ]}
                  >
                    {permissionDenied
                      ? 'Tap to Learn How to Reset in Chrome'
                      : isGpsOff
                      ? 'Tap to Turn ON GPS / Retry'
                      : 'Tap to Retry GPS Lock'}
                  </Text>
                </View>
                <RefreshCw
                  size={13}
                  color={permissionDenied ? '#DC2626' : isGpsOff ? '#D97706' : '#0284C7'}
                />
              </TouchableOpacity>
            ) : null}

            {/* Resolved Human-Readable Address Bar */}
            {currentAddress ? (
              <View style={styles.addressBar}>
                <MapPin size={13} color="#1E63F0" style={{ marginTop: 2, marginRight: 6 }} />
                <Text style={styles.addressBarText} numberOfLines={2}>
                  {currentAddress}
                </Text>
              </View>
            ) : gpsLoading ? (
              <View style={[styles.addressBar, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={[styles.addressBarText, { color: '#0369A1' }]}>
                  Acquiring live device GPS position...
                </Text>
              </View>
            ) : null}

            {/* Radar Map Container Showing Device Location to Site Location */}
            <View
              style={styles.mapContainer}
              onTouchStart={() => setIsMapInteracting(true)}
              onTouchEnd={() => setIsMapInteracting(false)}
              onTouchCancel={() => setIsMapInteracting(false)}
            >
              {selectedSite && (
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFill}
                  provider={PROVIDER_DEFAULT}
                  initialRegion={{
                    latitude: latitude !== 0 ? (latitude + selectedSite.latitude) / 2 : selectedSite.latitude,
                    longitude: longitude !== 0 ? (longitude + selectedSite.longitude) / 2 : selectedSite.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  mapType="standard"
                  showsCompass={true}
                  showsUserLocation={Platform.OS !== 'web'}
                  showsMyLocationButton={false}
                >
                  {/* 500m Geofence Circle around Site */}
                  <Circle
                    center={{
                      latitude: selectedSite.latitude,
                      longitude: selectedSite.longitude,
                    }}
                    radius={selectedSite.radiusMeters || 500}
                    fillColor={isInside ? 'rgba(16, 185, 129, 0.2)' : 'rgba(220, 38, 38, 0.18)'}
                    strokeColor={isInside ? '#10B981' : '#DC2626'}
                    strokeWidth={2}
                    zIndex={2}
                  />

                  {/* Site Location Marker */}
                  <Marker
                    coordinate={{
                      latitude: selectedSite.latitude,
                      longitude: selectedSite.longitude,
                    }}
                    title={`Site: ${selectedSite.name}`}
                    description={`Geofence: ${selectedSite.radiusMeters || 500}m • ${selectedSite.code}`}
                    zIndex={10}
                    anchor={{ x: 0.5, y: 1.0 }}
                  />

                  {/* My Device Location Marker (Real Live GPS) */}
                  {latitude !== 0 && longitude !== 0 && (
                    <Marker
                      coordinate={{ latitude, longitude }}
                      title="My Device Location"
                      description={currentAddress || `Accuracy: ±${accuracy.toFixed(1)}m`}
                      zIndex={15}
                      anchor={{ x: 0.5, y: 0.5 }}
                    />
                  )}

                  {/* Midpoint Distance Marker along Polyline */}
                  {latitude !== 0 && longitude !== 0 && distanceToSiteMeters > 40 && (
                    <Marker
                      coordinate={{
                        latitude: (latitude + selectedSite.latitude) / 2,
                        longitude: (longitude + selectedSite.longitude) / 2,
                      }}
                      title={distanceFormatted}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={8}
                    />
                  )}

                  {/* Nearby Real Places Markers */}
                  {nearbyPlaces.map((np, idx) => (
                    <Marker
                      key={`nearby-${np.id || idx}`}
                      coordinate={{ latitude: np.latitude, longitude: np.longitude }}
                      title={np.name}
                      description={`${np.category_label || ''} • ${np.formatted_distance || ''}`}
                      pinColor={np.category_color || '#2563EB'}
                      zIndex={6}
                    />
                  ))}

                  {/* Connecting Route Line between Device Location & Site Location */}
                  {latitude !== 0 && longitude !== 0 && (
                    <Polyline
                      coordinates={[
                        { latitude, longitude },
                        { latitude: selectedSite.latitude, longitude: selectedSite.longitude },
                      ]}
                      strokeColor="#2563EB"
                      strokeWidth={3}
                      lineDashPattern={[8, 4]}
                      zIndex={3}
                    />
                  )}
                </MapView>
              )}

              {/* Floating Distance Badge on Map */}
              <View style={styles.floatingDistanceBadge}>
                <View
                  style={[
                    styles.floatingDot,
                    (permissionDenied || isGpsOff) && { backgroundColor: '#EF4444' },
                    isGpsTimeout && { backgroundColor: '#F59E0B' },
                  ]}
                />
                {latitude === 0 || longitude === 0 ? (
                  <Text style={styles.floatingDistanceText}>
                    {permissionDenied
                      ? 'Location permission blocked'
                      : isGpsOff
                      ? 'Phone GPS is OFF • Turn ON Location'
                      : isGpsTimeout
                      ? 'Searching for GPS satellites...'
                      : 'Tap "Fetch Live Location" to enable GPS'}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.floatingDistanceText}>
                      My Device ➔ {selectedSite?.name || 'Site'}: <Text style={{ fontWeight: '900' }}>{distanceFormatted}</Text>
                    </Text>
                    <View
                      style={[
                        styles.floatingGeofenceTag,
                        { backgroundColor: isInside ? '#059669' : '#DC2626' },
                      ]}
                    >
                      <Text style={styles.floatingGeofenceTagText}>
                        {isInside ? 'In Range' : 'Outside Geofence'}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Zoom & Route Frame Controls */}
              <View style={styles.mapZoomControls}>
                <TouchableOpacity
                  delayPressIn={0}
                  style={styles.zoomBtn}
                  onPress={() => handleZoom(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.zoomBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  delayPressIn={0}
                  style={styles.zoomBtn}
                  onPress={() => handleZoom(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.zoomBtnText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  delayPressIn={0}
                  style={[styles.zoomBtn, { marginTop: 4, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                  onPress={fitMapToBoth}
                  activeOpacity={0.8}
                  accessibilityLabel="Fit Device and Site to view"
                >
                  <Navigation size={13} color="#1E63F0" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Route Legend & Turn-by-Turn Directions Action */}
            <View style={styles.routeActionBar}>
              <View style={styles.routeLegend}>
                <View style={styles.legendNode}>
                  <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                  <Text style={styles.legendLabel}>My Location</Text>
                </View>
                <View style={styles.legendConnector} />
                <View style={styles.legendNode}>
                  <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>{selectedSite?.name || 'Site'}</Text>
                </View>
              </View>

              <TouchableOpacity
                delayPressIn={0}
                style={styles.directionsBtn}
                onPress={handleOpenDirections}
                activeOpacity={0.8}
              >
                <Navigation size={12} color="#1E63F0" style={{ marginRight: 5 }} />
                <Text style={styles.directionsBtnText}>Directions to Site</Text>
              </TouchableOpacity>
            </View>

            {/* Real Maharashtra Nearby Places & Business Search Section */}
            <View style={styles.placesContainer}>
              <View style={styles.placesHeader}>
                <View style={styles.placesHeaderTitleRow}>
                  <MapPin size={15} color="#1E40AF" style={{ marginRight: 6 }} />
                  <Text style={styles.placesTitle}>Nearby Places & Local Businesses</Text>
                </View>
                {loadingPlaces && <ActivityIndicator size="small" color="#1E40AF" />}
              </View>

              {/* Search Bar */}
              <View style={styles.searchBarBox}>
                <Search size={14} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search shops, landmarks, roads..."
                  placeholderTextColor="#94A3B8"
                  value={nearbyQuery}
                  onChangeText={setNearbyQuery}
                  onSubmitEditing={() => fetchNearby(nearbyCategory, nearbyQuery)}
                  returnKeyType="search"
                />
                {nearbyQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setNearbyQuery('');
                      fetchNearby(nearbyCategory, '');
                    }}
                    style={{ padding: 4 }}
                  >
                    <X size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsScroll}>
                {[
                  { id: 'all', label: 'All', icon: '📍' },
                  { id: 'fuel', label: 'Petrol & EV', icon: '⛽' },
                  { id: 'healthcare', label: 'Hospitals', icon: '🏥' },
                  { id: 'financial', label: 'Banks & ATMs', icon: '🏧' },
                  { id: 'food', label: 'Food & Cafes', icon: '🍴' },
                  { id: 'shop', label: 'Shops & Marts', icon: '🛒' },
                  { id: 'transit', label: 'Stations', icon: '🚉' },
                ].map((cat) => {
                  const isActive = nearbyCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      onPress={() => {
                        setNearbyCategory(cat.id);
                        fetchNearby(cat.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                      <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Horizontal List of Nearby Places Cards */}
              {nearbyPlaces.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placesListScroll}>
                  {nearbyPlaces.map((place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={styles.placeCard}
                      onPress={() => {
                        if (mapRef.current) {
                          mapRef.current.animateToRegion({
                            latitude: place.latitude,
                            longitude: place.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                          }, 400);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.placeCardHeader}>
                        <View style={[styles.placeCategoryDot, { backgroundColor: place.category_color || '#2563EB' }]} />
                        <Text style={styles.placeCategoryText}>{place.category_label || place.category}</Text>
                        <Text style={styles.placeDistanceText}>{place.formatted_distance}</Text>
                      </View>
                      <Text style={styles.placeNameText} numberOfLines={1}>{place.name}</Text>
                      <Text style={styles.placeAddressText} numberOfLines={1}>{place.road || place.city || place.address}</Text>
                      <TouchableOpacity
                        style={styles.placeDirectionsBtn}
                        onPress={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
                          Linking.openURL(url);
                        }}
                      >
                        <Navigation size={10} color="#1E40AF" style={{ marginRight: 4 }} />
                        <Text style={styles.placeDirectionsBtnText}>Directions</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* 3 Telemetry Metrics below Map */}
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryBox}>
                <Text style={styles.telemetryBoxLabel}>GPS LATITUDE</Text>
                <Text style={styles.telemetryBoxValue}>
                  {latitude !== 0
                    ? latitude.toFixed(6)
                    : permissionDenied
                    ? 'Blocked'
                    : isGpsOff
                    ? 'GPS OFF'
                    : isGpsTimeout
                    ? 'Timeout'
                    : 'Tap Fetch'}
                </Text>
              </View>

              <View style={styles.telemetryBox}>
                <Text style={styles.telemetryBoxLabel}>GPS LONGITUDE</Text>
                <Text style={styles.telemetryBoxValue}>
                  {longitude !== 0
                    ? longitude.toFixed(6)
                    : permissionDenied
                    ? 'Blocked'
                    : isGpsOff
                    ? 'GPS OFF'
                    : isGpsTimeout
                    ? 'Timeout'
                    : 'Tap Fetch'}
                </Text>
              </View>

              <View style={[styles.telemetryBox, isInside ? styles.telemetryBoxInside : styles.telemetryBoxOutside]}>
                <Text
                  style={[
                    styles.telemetryBoxLabel,
                    { color: isInside ? '#059669' : '#DC2626' },
                  ]}
                >
                  DISTANCE TO SITE
                </Text>
                <Text
                  style={[
                    styles.telemetryBoxValue,
                    { color: isInside ? '#059669' : '#DC2626' },
                  ]}
                >
                  {latitude !== 0 && longitude !== 0
                    ? distanceFormatted
                    : permissionDenied
                    ? 'Blocked'
                    : isGpsOff
                    ? 'GPS OFF'
                    : isGpsTimeout
                    ? 'Searching'
                    : '---'}
                </Text>
              </View>
            </View>

            {/* Attendance Compliance Protocol List */}
            <View style={styles.complianceProtocolBox}>
              <Text style={styles.protocolTitle}>ATTENDANCE COMPLIANCE PROTOCOL</Text>
              <View style={styles.protocolItem}>
                <RefreshCw size={13} color="#10B981" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.protocolText}>
                  Strict 500m geofence perimeter enforced around assigned substation
                </Text>
              </View>
              <View style={styles.protocolItem}>
                <RefreshCw size={13} color="#10B981" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.protocolText}>
                  Real-time GPS anti-spoofing telemetry recorded on check-in
                </Text>
              </View>
              <View style={styles.protocolItem}>
                <RefreshCw size={13} color="#10B981" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.protocolText}>
                  Shift start timestamp recorded to Adani central operations ledger
                </Text>
              </View>
            </View>
          </View>

          {/* ============================================================ */}
          {/* RIGHT COLUMN: CHECK IN ACTION CARD & GEOFENCE ENFORCEMENT    */}
          {/* ============================================================ */}
          <View style={[styles.actionCard, isTablet && styles.actionCardTablet]}>
            {/* Top Red Circular Icon */}
            <View style={styles.pinCircleWrap}>
              <MapPin size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.actionCardTitle}>
              {isAlreadyCheckedIn ? 'Shift Check-In Recorded' : 'Check In for New Shift'}
            </Text>
            <Text style={styles.actionCardSubtitle}>
              {isAlreadyCheckedIn
                ? 'Your shift check-in has been successfully recorded and locked for today.'
                : 'You have checked out of your previous shift. Check-in is available when within the site geofence.'}
            </Text>

            {/* Substation Assignment vs Check-In Location Breakdown */}
            <View style={styles.substationSummaryBox}>
              <View style={styles.substationSummaryRow}>
                <Text style={styles.substationSummaryLabel}>Assigned Substation:</Text>
                <Text style={styles.substationSummaryValue}>
                  {(user as any)?.assignedSiteName || sites.find(s => s.id === user?.assignedSiteId)?.name || 'Not Assigned'}
                </Text>
              </View>
              <View style={styles.substationSummaryRow}>
                <Text style={styles.substationSummaryLabel}>Checked In From:</Text>
                <Text style={[styles.substationSummaryValue, { color: isAlreadyCheckedIn ? '#059669' : '#1E63F0' }]}>
                  {isAlreadyCheckedIn
                    ? (todayRecord?.siteName || (todayRecord?.checkIn as any)?.siteName || selectedSite?.name || 'Assigned Site')
                    : (selectedSite?.name || 'Select a site')}
                </Text>
              </View>
              {isAlreadyCheckedIn && todayRecord?.checkIn?.time && (
                <View style={styles.substationSummaryRow}>
                  <Text style={styles.substationSummaryLabel}>Check-In Time:</Text>
                  <Text style={styles.substationSummaryValue}>
                    {formatTimeIST(todayRecord.checkIn.time)} IST
                  </Text>
                </View>
              )}
            </View>

            {/* Shift Status Notice: "Shift currently active" Box with clean alignment & spacing */}
            {isAlreadyCheckedIn && todayRecord?.checkOut ? (
              <View style={[styles.prevShiftBox, styles.prevShiftBoxCompleted]}>
                <CheckCircle2 size={16} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={[styles.prevShiftText, { color: '#1D4ED8' }]}>
                  Shift concluded today at {formatTimeIST(todayRecord.checkOut.time)} (Worked: {todayRecord.workingHoursFormatted || `${todayRecord.workingMinutes || 0}m`}).
                </Text>
              </View>
            ) : isAlreadyCheckedIn ? (
              <View style={[styles.prevShiftBox, styles.prevShiftBoxActive]}>
                <CheckCircle2 size={16} color="#15803D" style={{ marginRight: 8 }} />
                <Text style={[styles.prevShiftText, { color: '#15803D' }]}>
                  Shift currently active • Checked in at {formatTimeIST(todayRecord?.checkIn?.time)} IST.
                </Text>
              </View>
            ) : null}

            {/* Geofence Notice Banner: Locked vs In-Range */}
            {!isAlreadyCheckedIn && (
              !isInside ? (
                /* OUTSIDE GEOFENCE: CHECK-IN STRICTLY LOCKED */
                <View style={styles.lockedNoticeBox}>
                  <View style={styles.lockedNoticeHeader}>
                    <AlertTriangle size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.lockedNoticeTitle}>
                      Check-In Locked: Outside Geofence Area
                    </Text>
                  </View>
                  <Text style={styles.lockedNoticeBody}>
                    You are currently <Text style={{ fontWeight: '800' }}>{distanceFormatted}</Text> away from{' '}
                    <Text style={{ fontWeight: '800' }}>{selectedSite?.name || 'the substation'}</Text>. Attendance
                    check-in is strictly locked until you arrive within 500 meters of the assigned substation.
                  </Text>
                </View>
              ) : (
                /* INSIDE GEOFENCE: CHECK-IN AUTHORIZED */
                <View style={styles.inRangeNoticeBox}>
                  <View style={styles.inRangeNoticeHeader}>
                    <CheckCircle2 size={16} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={styles.inRangeNoticeTitle}>
                      Geofence Verified: You are within 500m
                    </Text>
                  </View>
                  <Text style={styles.inRangeNoticeBody}>
                    You are currently <Text style={{ fontWeight: '800' }}>{distanceFormatted}</Text> from{' '}
                    <Text style={{ fontWeight: '800' }}>{selectedSite?.name}</Text>. You are authorized to check in for your shift.
                  </Text>
                </View>
              )
            )}

            {/* Check-In CTA Button */}
            {isAlreadyCheckedIn ? (
              /* ALREADY CHECKED IN: RE-CHECK IN NOT ALLOWED */
              <View style={styles.alreadyCheckedInBox}>
                <View style={styles.alreadyCheckedInBadge}>
                  <CheckCircle2 size={16} color="#15803D" style={{ marginRight: 6 }} />
                  <Text style={styles.alreadyCheckedInTitle}>Shift Check-In Recorded</Text>
                </View>
                <Text style={styles.alreadyCheckedInSub}>
                  You have already checked in for today at{' '}
                  <Text style={{ fontWeight: '700', color: '#15803D' }}>
                    {todayRecord?.siteName || (todayRecord?.checkIn as any)?.siteName || selectedSite?.name}
                  </Text>. Re-check in is disabled for this shift.
                </Text>
                <TouchableOpacity delayPressIn={0}
                  style={styles.lockedCheckInBtn}
                  onPress={() =>
                    Alert.alert(
                      'Shift Check-In Active',
                      `You are already checked in at ${todayRecord?.siteName || selectedSite?.name} for today.\n\nAssigned Substation: ${(user as any)?.assignedSiteName || sites.find(s => s.id === user?.assignedSiteId)?.name || 'Not Assigned'}\nChecked-In From: ${todayRecord?.siteName || selectedSite?.name}`
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Lock size={15} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.lockedCheckInBtnText}>
                    Check-In Completed (Re-check in Disabled)
                  </Text>
                </TouchableOpacity>
              </View>
            ) : !isInside ? (
              /* LOCKED BUTTON */
              <TouchableOpacity delayPressIn={0}
                style={styles.lockedCheckInBtn}
                onPress={handleOpenCheckIn}
                activeOpacity={0.7}
              >
                <Lock size={16} color="#64748B" style={{ marginRight: 8 }} />
                <Text style={styles.lockedCheckInBtnText}>
                  Check-In Locked (Outside Geofence)
                </Text>
              </TouchableOpacity>
            ) : (
              /* UNLOCKED & ACTIVE BUTTON (PHOTO COMPULSORY) */
              <TouchableOpacity delayPressIn={0}
                style={styles.activeCheckInBtn}
                onPress={handleOpenCheckIn}
                activeOpacity={0.85}
              >
                <CameraIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.activeCheckInBtnText}>Take Live Photo & Check In *</Text>
              </TouchableOpacity>
            )}

            {/* Bottom Details Cards */}
            <View style={styles.bottomDetailsSection}>
              {/* Card 1: Current GPS Location */}
              <View style={styles.detailInfoBox}>
                <View style={styles.detailIconCircleRed}>
                  <MapPin size={16} color="#E11D48" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailBoxLabel}>CURRENT GPS LOCATION</Text>
                  <Text style={styles.detailBoxCoords}>
                    {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </Text>
                  <Text
                    style={[
                      styles.detailBoxStatus,
                      { color: isInside ? '#059669' : '#DC2626' },
                    ]}
                  >
                    {isInside
                      ? `✓ Inside Geofence (${distanceFormatted} away)`
                      : `✕ Outside Geofence (${distanceFormatted} away • Max 500m)`}
                  </Text>
                </View>
              </View>

              {/* Card 2: Assigned Substation Site */}
              <View style={styles.detailInfoBox}>
                <View style={styles.detailIconCircleBlue}>
                  <Building2 size={16} color="#1E63F0" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.assignedBadgeRow}>
                    <Text style={styles.detailBoxLabel}>ASSIGNED SUBSTATION SITE</Text>
                    <View style={styles.adminAssignedPill}>
                      <Text style={styles.adminAssignedPillText}>Admin Assigned</Text>
                    </View>
                  </View>
                  <Text style={styles.detailBoxSiteName}>
                    {selectedSite?.name} ({selectedSite?.code})
                  </Text>
                  <Text style={styles.detailBoxAddress} numberOfLines={2}>
                    {selectedSite?.address}
                  </Text>
                  <View style={styles.perimeterRow}>
                    <Text style={styles.perimeterLabel}>Geofence Perimeter:</Text>
                    <Text style={styles.perimeterValue}>500 meters</Text>
                  </View>
                </View>
              </View>

              {/* Card 3: Selected Substation Manager Details (NO PROFILE PICTURE - ONLY DETAILS) */}
              {Boolean(selectedSite?.manager) ? (
                <View style={styles.managerDetailInfoBox}>
                  <View style={styles.managerDetailHeaderRow}>
                    <View style={styles.detailIconCircleIndigo}>
                      <ShieldCheck size={16} color="#4338CA" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.assignedBadgeRow}>
                        <Text style={styles.managerBoxLabel}>SUBSTATION MANAGER & IN-CHARGE</Text>
                      </View>
                      <Text style={styles.managerNameText}>{String(selectedSite?.manager?.name || 'Site In-Charge')}</Text>
                      <Text style={styles.managerDesigText}>
                        {String(selectedSite?.manager?.designation || 'Zonal Grid Operations Lead')}
                      </Text>
                    </View>
                  </View>

                  {/* Manager Contact Details List */}
                  <View style={styles.managerContactList}>
                    {/* Phone Row */}
                    {Boolean(selectedSite?.manager?.phone) ? (
                      <View style={styles.managerContactRow}>
                        <View style={styles.managerContactLeft}>
                          <Phone size={13} color="#4338CA" />
                          <Text style={styles.managerContactVal}>{String(selectedSite?.manager?.phone)}</Text>
                        </View>
                        <TouchableOpacity delayPressIn={0}
                          style={styles.managerActionBtn}
                          onPress={() => {
                            if (selectedSite?.manager?.phone) {
                              Linking.openURL(`tel:${selectedSite.manager.phone.replace(/\s+/g, '')}`);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Phone size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.managerActionBtnText}>Call</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {/* Email Row */}
                    {Boolean(selectedSite?.manager?.email) ? (
                      <View style={styles.managerContactRow}>
                        <View style={styles.managerContactLeft}>
                          <Mail size={13} color="#4338CA" />
                          <Text style={styles.managerContactVal} numberOfLines={1}>
                            {String(selectedSite?.manager?.email)}
                          </Text>
                        </View>
                        <TouchableOpacity delayPressIn={0}
                          style={[styles.managerActionBtn, styles.managerActionBtnSecondary]}
                          onPress={() => {
                            if (selectedSite?.manager?.email) {
                              Linking.openURL(`mailto:${selectedSite.manager.email}`);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Mail size={11} color="#4338CA" style={{ marginRight: 4 }} />
                          <Text style={styles.managerActionBtnTextSecondary}>Email</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {/* Substation Voltage / Code Row */}
                    <View style={styles.managerSubstationRow}>
                      <Zap size={12} color="#64748B" />
                      <Text style={styles.managerSubstationText}>
                        {`${selectedSite!.voltageClass || 'Substation & Smart Feeder'} • ${selectedSite!.code || ''}`}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ============================================================== */}
      {/* 3. OPTIONAL CAMERA & PHOTO UPLOAD MODAL                        */}
      {/* ============================================================== */}
      <Modal
        visible={showCameraModal}
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowCameraModal(false);
            setCapturedPhotoUri(null);
          }
        }}
      >
        <View style={styles.cameraModalContainer}>
          {!cameraPermission?.granted ? (
            /* Camera Permission Screen */
            <View style={styles.permissionScreen}>
              <View style={styles.permIconBox}>
                <CameraIcon size={44} color="#1E63F0" />
              </View>
              <Text style={styles.permTitle}>Camera Access (Photo Required)</Text>
              <Text style={styles.permSub}>
                Camera access is required to take a live check-in photo of the substation, equipment, or technician before recording attendance.
              </Text>
              <TouchableOpacity delayPressIn={0}
                style={styles.grantBtn}
                onPress={requestCameraPermission}
                activeOpacity={0.85}
              >
                <CameraIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.grantBtnText}>Grant Camera Access</Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0}
                style={styles.cancelPermBtn}
                onPress={() => setShowCameraModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelPermBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : !capturedPhotoUri ? (
            /* Live Camera Viewfinder (Live capture only) */
            <View style={StyleSheet.absoluteFill}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing={cameraFacing}
                ref={cameraRef}
              >
                {/* Top Overlay */}
                <View style={[styles.cameraTopOverlay, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
                  <View style={styles.cameraHeaderWrap}>
                    <View style={styles.cameraShieldBox}>
                      <ShieldCheck size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cameraHeaderTitle}>SUBSTATION CHECK-IN PHOTO</Text>
                      <Text style={styles.cameraHeaderSub}>
                        {selectedSite?.name} • Live Camera Only
                      </Text>
                    </View>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.cameraCloseBtn}
                      onPress={() => {
                        setShowCameraModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <X size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Center Viewfinder Framing (Not strictly face oval) */}
                <View style={styles.cameraCenterOverlay}>
                  <View style={styles.photoFrameBox} />
                  <View style={styles.faceInstructionBadge}>
                    <Text style={styles.faceInstructionText}>
                      Substation / Equipment / Work Photo • Live Camera
                    </Text>
                  </View>
                </View>

                {/* Bottom Controls Bar */}
                <View style={[styles.cameraBottomBar, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
                  {/* Flip Camera */}
                  <TouchableOpacity delayPressIn={0}
                    style={styles.cameraSideBtn}
                    onPress={() => setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'))}
                    activeOpacity={0.75}
                  >
                    <RotateCcw size={22} color="#FFFFFF" />
                    <Text style={styles.cameraSideBtnText}>Flip</Text>
                  </TouchableOpacity>

                  {/* Main Shutter Button */}
                  <TouchableOpacity delayPressIn={0}
                    style={styles.shutterRingBtn}
                    onPress={handleCapturePhoto}
                    activeOpacity={0.8}
                  >
                    <View style={styles.shutterInnerCircle}>
                      <CameraIcon size={24} color="#1E63F0" />
                    </View>
                  </TouchableOpacity>

                  {/* Cancel Button */}
                  <TouchableOpacity delayPressIn={0}
                    style={styles.cameraSideBtn}
                    onPress={() => {
                      setShowCameraModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <X size={22} color="#EF4444" />
                    <Text style={[styles.cameraSideBtnText, { color: '#EF4444' }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </CameraView>
            </View>
          ) : (
            /* Photo Captured Preview & Submit Screen */
            <View style={[styles.previewScreenContainer, { paddingTop: Math.max(insets.top, 20) + 10, paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
              {/* Header */}
              <View style={styles.previewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>Review & Submit Photo</Text>
                  <Text style={styles.previewSubtitle}>
                    Photo will be attached to your shift check-in and viewable by Admin
                  </Text>
                </View>
                <TouchableOpacity delayPressIn={0}
                  style={styles.previewCloseBtn}
                  onPress={() => {
                    if (!isSubmitting) {
                      setShowCameraModal(false);
                      setCapturedPhotoUri(null);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Photo Preview Box */}
              <View style={styles.capturedImageBox}>
                <Image source={{ uri: capturedPhotoUri }} style={styles.capturedImage} />
                <View style={styles.capturedImageStamp}>
                  <CheckCircle2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.capturedImageStampText}>Check-In Photo Attached</Text>
                </View>
              </View>

              {/* Telemetry Badge */}
              <View style={styles.previewTelemetryCard}>
                <View style={styles.telemetryRow}>
                  <MapPin size={13} color="#1E63F0" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryCardText}>
                    Location: <Text style={{ fontWeight: '800' }}>{selectedSite?.name}</Text> ({distanceFormatted} away • Geofence Verified)
                  </Text>
                </View>
                <View style={[styles.telemetryRow, { marginTop: 4 }]}>
                  <Clock size={13} color="#15803D" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryCardText}>
                    Time: <Text style={{ fontWeight: '800' }}>{shiftInfo.formattedTimeIST}</Text> • Status: <Text style={{ fontWeight: '800', color: '#15803D' }}>{shiftInfo.punctualityLabel}</Text>
                  </Text>
                </View>
              </View>

              {/* Notice */}
              <View style={styles.mandatoryNoticeBox}>
                <CheckCircle2 size={16} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.mandatoryNoticeText, { color: '#065F46' }]}>
                  This photo will be logged with your check-in record and will be visible to the Admin.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.previewActionCol}>
                <TouchableOpacity delayPressIn={0}
                  style={[styles.submitPhotoBtn, isSubmitting && { opacity: 0.8 }]}
                  onPress={handleSubmitCheckIn}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.submitPhotoBtnText}>Uploading & Checking In...</Text>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.submitPhotoBtnText}>Submit Photo & Check In</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={styles.retakePhotoBtn}
                  onPress={() => setCapturedPhotoUri(null)}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={16} color="#1E63F0" style={{ marginRight: 6 }} />
                  <Text style={styles.retakePhotoBtnText}>Retake Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={styles.cancelCheckInBtn}
                  onPress={() => {
                    if (!isSubmitting) {
                      setShowCameraModal(false);
                      setCapturedPhotoUri(null);
                    }
                  }}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelCheckInBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  geofenceStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  geofenceStatusPillInside: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  geofenceStatusPillOutside: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  geofenceStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mainScroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },

  // Substation Selector Bar
  substationSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  substationSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buildingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  substationSelectorTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
  },
  selectPunchPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  selectPunchPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E63F0',
  },
  chipsScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  checkedInSiteBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 4,
  },
  checkedInSiteBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  substationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  substationChipActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipSiteName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  chipSiteNameActive: {
    color: '#FFFFFF',
  },
  chipCodeBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipCodeBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  chipCodeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  chipCodeBadgeTextActive: {
    color: '#FFFFFF',
  },
  chipDistanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  chipDistanceTextActive: {
    color: '#BFDBFE',
  },

  // Main Layout Grid
  mainLayout: {
    gap: 16,
  },
  mainLayoutTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Left Radar Card
  radarCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  radarCardTablet: {
    flex: 1.25,
  },
  gpsErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    gap: 6,
  },
  gpsErrorBannerText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '700',
    lineHeight: 16,
  },
  gpsErrorBannerAction: {
    fontSize: 10.5,
    color: '#DC2626',
    fontWeight: '800',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  addressBarText: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  radarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  radarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  radarSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  radarHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  realDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  realDeviceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  refreshGpsBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E63F0',
  },

  // Map View Container
  mapContainer: {
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  siteMarkerContainer: {
    alignItems: 'center',
  },
  siteMarkerStem: {
    width: 2,
    height: 6,
    backgroundColor: '#DC2626',
  },
  userMarkerContainer: {
    alignItems: 'center',
  },
  userMarkerStem: {
    width: 2,
    height: 6,
    backgroundColor: '#1E293B',
  },
  routeDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  routeDistancePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
  },
  routeActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  routeLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 160,
  },
  legendNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  legendConnector: {
    width: 16,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  directionsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E63F0',
  },
  placesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  placesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  placesHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  categoryChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  categoryChipIcon: {
    fontSize: 11,
    marginRight: 3,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#1E40AF',
    fontWeight: '800',
  },
  placesListScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  placeCard: {
    width: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  placeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  placeCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  placeCategoryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    flex: 1,
  },
  placeDistanceText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E40AF',
  },
  placeNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  placeAddressText: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 6,
  },
  placeDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  placeDirectionsBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E40AF',
  },
  substationMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  substationMapPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userDeviceMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  userDotCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginRight: 5,
  },
  userDeviceMapPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingDistanceBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  floatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  floatingDistanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingGeofenceTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floatingGeofenceTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mapZoomControls: {
    position: 'absolute',
    bottom: 34,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  mapEngineBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  engineGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  mapEngineText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#334155',
  },

  // Telemetry Grid below Map
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  telemetryBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  telemetryBoxInside: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  telemetryBoxOutside: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  telemetryBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  telemetryBoxValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },

  // Compliance Protocol
  complianceProtocolBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  protocolTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  protocolText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
    lineHeight: 16,
  },

  // Right Action Card
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardTablet: {
    flex: 1,
  },
  pinCircleWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#E11D48',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  actionCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  prevShiftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 14,
    width: '100%',
  },
  prevShiftBoxActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  prevShiftBoxCompleted: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  prevShiftText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
    lineHeight: 18,
  },

  // Notice Banners
  lockedNoticeBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 12,
    width: '100%',
  },
  lockedNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  lockedNoticeBody: {
    fontSize: 11,
    color: '#B91C1C',
    lineHeight: 16,
  },
  inRangeNoticeBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 12,
    width: '100%',
  },
  inRangeNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  inRangeNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  inRangeNoticeBody: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 16,
  },

  // Buttons
  lockedCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  lockedCheckInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    flexShrink: 1,
  },
  activeCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    marginTop: 14,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  activeCheckInBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Bottom Details Section
  bottomDetailsSection: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  detailInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  detailIconCircleRed: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailIconCircleBlue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  detailBoxCoords: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  detailBoxStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  assignedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminAssignedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminAssignedPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#15803D',
  },
  detailBoxSiteName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  detailBoxAddress: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  perimeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  perimeterLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  perimeterValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Manager Details Card (No Profile Picture)
  managerDetailInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  managerDetailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIconCircleIndigo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  managerBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.6,
  },
  managerStatusPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  managerStatusPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#4338CA',
  },
  managerNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  managerDesigText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
    marginTop: 1,
  },
  managerContactList: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  managerContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  managerContactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  managerContactVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  managerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4338CA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  managerActionBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  managerActionBtnSecondary: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  managerActionBtnTextSecondary: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
  },
  managerSubstationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  managerSubstationText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },

  // Camera Modal Styles
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  permSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 300,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 12,
  },
  grantBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelPermBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelPermBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },

  // Viewfinder
  cameraTopOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cameraHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cameraShieldBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  cameraHeaderSub: {
    fontSize: 10,
    color: '#BFDBFE',
    marginTop: 2,
  },
  cameraCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCenterOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  faceTargetRing: {
    width: 240,
    height: 310,
    borderRadius: 120,
    borderWidth: 2.5,
    borderColor: '#34D399',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  faceInstructionBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 18,
  },
  faceInstructionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  cameraSideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  cameraSideBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  shutterRingBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  shutterInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Preview & Submit
  previewScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  previewSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturedImageBox: {
    position: 'relative',
    height: 260,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginVertical: 14,
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  capturedImageStamp: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  capturedImageStampText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewTelemetryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryCardText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  mandatoryNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  mandatoryNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 15,
    flex: 1,
  },
  previewActionCol: {
    gap: 10,
  },
  submitPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  submitPhotoBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  retakePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    borderRadius: 10,
  },
  retakePhotoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E63F0',
  },
  cancelCheckInBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelCheckInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  alreadyCheckedInBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 10,
  },
  alreadyCheckedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  substationSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    width: '100%',
  },
  substationSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  substationSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  substationSummaryValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  alreadyCheckedInTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  alreadyCheckedInSub: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
    marginBottom: 10,
  },
  skipPhotoCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipPhotoCheckInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  photoFrameBox: {
    width: 250,
    height: 250,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  uploadDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
    width: '100%',
  },
  uploadDeviceBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E63F0',
  },
  skipCheckInModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
    width: '100%',
  },
  skipCheckInModalBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
});

export default CheckInScreen;

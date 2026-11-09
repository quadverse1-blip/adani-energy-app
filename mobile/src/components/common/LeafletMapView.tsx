import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from './AppMapView';
import { FleetTechnician, Substation } from '../../types';
import { Building } from 'lucide-react-native';

interface LeafletMapViewProps {
  style?: any;
  substations: Substation[];
  technicians: FleetTechnician[];
  selectedTech: FleetTechnician | null;
  onSelectTech?: (tech: FleetTechnician) => void;
  center?: { latitude: number; longitude: number; zoom?: number };
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  style,
  substations,
  technicians,
  selectedTech,
  onSelectTech,
  center = { latitude: 19.7515, longitude: 75.7139 },
}) => {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (selectedTech?.latitude && selectedTech?.longitude && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedTech.latitude,
          longitude: selectedTech.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [selectedTech]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude: center.latitude || 12.9626,
          longitude: center.longitude || 77.5936,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        mapType="standard"
        showsCompass={true}
      >

        {/* Substation Geofence Circle & Pin */}
        {substations.map((s) => (
          <React.Fragment key={s.id}>
            <Circle
              center={{ latitude: s.latitude, longitude: s.longitude }}
              radius={s.radiusMeters || 500}
              fillColor="rgba(220, 38, 38, 0.15)"
              strokeColor="#DC2626"
              strokeWidth={2}
              zIndex={2}
            />
            <Marker
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              title={s.name}
              description={s.code}
              pinColor="#DC2626"
              zIndex={10}
            >
              <View style={styles.substationPill}>
                <Building size={12} color="#FFFFFF" />
                <Text style={styles.substationText}>{s.name}</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Technician Markers */}
        {technicians
          .filter((t) => t.hasGps && t.latitude !== null && t.longitude !== null)
          .map((tech) => {
            const isSelected = selectedTech?.id === tech.id;
            return (
              <Marker
                key={tech.id}
                coordinate={{ latitude: tech.latitude!, longitude: tech.longitude! }}
                title={tech.name}
                description={`${tech.employeeId} • ${tech.assignedSiteName}`}
                onPress={() => onSelectTech && onSelectTech(tech)}
                zIndex={isSelected ? 50 : 20}
              >
                <View
                  style={[
                    styles.techMarkerPill,
                    isSelected && styles.techMarkerPillSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.techDot,
                      tech.markerColor === 'amber' && styles.techDotAmber,
                    ]}
                  />
                  <Text style={styles.techMarkerText}>{tech.name}</Text>
                </View>
              </Marker>
            );
          })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  substationPill: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#DC2626',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  substationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  techMarkerPill: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
  },
  techMarkerPillSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#60A5FA',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  techDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  techDotAmber: {
    backgroundColor: '#F59E0B',
  },
  techMarkerText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
});

export default LeafletMapView;

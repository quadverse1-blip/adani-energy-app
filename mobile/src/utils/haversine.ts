/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

export function isInsideGeofence(
  deviceLat: number,
  deviceLon: number,
  siteLat: number,
  siteLon: number,
  radiusMeters: number
): { inside: boolean; distance: number } {
  const distance = calculateHaversineDistance(deviceLat, deviceLon, siteLat, siteLon);
  return {
    inside: distance <= radiusMeters,
    distance,
  };
}

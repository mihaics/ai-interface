const VALHALLA_URL = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de';

interface RouteResult {
  distance_km: number;
  duration_minutes: number;
  geometry: Array<[number, number]>;
  instructions: string[];
}

export async function calculateRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  mode: 'auto' | 'bicycle' | 'pedestrian' = 'auto',
): Promise<RouteResult> {
  const body = {
    locations: [
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    ],
    costing: mode,
    directions_options: { units: 'kilometers' },
  };

  const res = await fetch(`${VALHALLA_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;

  const leg = data.trip?.legs?.[0];
  if (!leg) throw new Error('No route found');

  const geometry = decodePolyline(leg.shape);
  const instructions = (leg.maneuvers || []).map((m: any) => m.instruction);

  return {
    distance_km: Math.round((data.trip.summary.length || 0) * 100) / 100,
    duration_minutes: Math.round((data.trip.summary.time || 0) / 60 * 10) / 10,
    geometry,
    instructions,
  };
}

/** Decode Valhalla's encoded polyline (precision 6). */
function decodePolyline(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let index = 0, lat = 0, lon = 0;

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e6, lon / 1e6]);
  }
  return coords;
}

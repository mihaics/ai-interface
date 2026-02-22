const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
  type: string;
}

export async function geocode(query: string): Promise<GeocodingResult[]> {
  const url = new URL('/search', NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ai-interface/1.0' },
  });
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string; type: string }>;

  return data.map(r => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    display_name: r.display_name,
    type: r.type,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = new URL('/reverse', NOMINATIM_URL);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lon.toString());
  url.searchParams.set('format', 'json');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ai-interface/1.0' },
  });
  const data = await res.json() as { display_name: string };
  return data.display_name;
}

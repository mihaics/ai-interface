const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface POIResult {
  id: number;
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export async function searchPOIs(
  poiType: string,
  lat: number,
  lon: number,
  radiusMeters: number = 1000,
): Promise<POIResult[]> {
  const query = `[out:json][timeout:10];
    node["amenity"="${poiType}"](around:${radiusMeters},${lat},${lon});
    out body;`;

  for (const baseUrl of OVERPASS_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json() as { elements: Array<{ id: number; lat: number; lon: number; tags: Record<string, string> }> };

      return data.elements.map(el => ({
        id: el.id,
        name: el.tags?.name || 'Unnamed',
        lat: el.lat,
        lon: el.lon,
        tags: el.tags || {},
      }));
    } catch {
      continue;
    }
  }

  return [];
}

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const MAX_RESULTS = 80;
const KEEP_TAGS = new Set([
  'name', 'name:en', 'population', 'ele', 'capital', 'place', 'amenity',
  'tourism', 'natural', 'cuisine', 'opening_hours', 'website',
]);

interface OSMResult {
  id: number;
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export async function searchOSM(
  key: string,
  value: string,
  areaName?: string,
  lat?: number,
  lon?: number,
  radiusMeters: number = 5000,
): Promise<OSMResult[]> {
  let query = '';
  if (areaName) {
    query = `[out:json][timeout:25];
      area["name"="${areaName}"]->.searchArea;
      (
        node["${key}"="${value}"](area.searchArea);
        way["${key}"="${value}"](area.searchArea);
      );
      out center;`;
  } else if (lat !== undefined && lon !== undefined) {
    query = `[out:json][timeout:25];
      (
        node["${key}"="${value}"](around:${radiusMeters},${lat},${lon});
        way["${key}"="${value}"](around:${radiusMeters},${lat},${lon});
      );
      out center;`;
  } else {
    throw new Error('Either areaName or lat/lon must be provided.');
  }

  for (const baseUrl of OVERPASS_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) continue;
      
      const data = await res.json() as { 
        elements: Array<{ 
          id: number; 
          lat?: number; 
          lon?: number; 
          center?: { lat: number; lon: number };
          tags: Record<string, string> 
        }> 
      };

      return data.elements.slice(0, MAX_RESULTS).map(el => {
        const filtered: Record<string, string> = {};
        for (const [k, v] of Object.entries(el.tags || {})) {
          if (KEEP_TAGS.has(k)) filtered[k] = v;
        }
        return {
          id: el.id,
          name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed',
          lat: el.lat ?? el.center?.lat ?? 0,
          lon: el.lon ?? el.center?.lon ?? 0,
          tags: filtered,
        };
      });
    } catch {
      continue;
    }
  }

  return [];
}

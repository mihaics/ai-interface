import type Anthropic from '@anthropic-ai/sdk';

/** Tool definitions for Claude's tool_use feature. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'geocode',
    description: 'Resolve a place name to geographic coordinates. Returns lat/lon and display name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Place name to search for (e.g., "Amsterdam", "Eiffel Tower")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_pois',
    description: 'Search for points of interest near a location. Returns names, coordinates, and tags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        poi_type: { type: 'string', description: 'OSM amenity type (e.g., "cafe", "restaurant", "hospital", "hotel")' },
        lat: { type: 'number', description: 'Center latitude' },
        lon: { type: 'number', description: 'Center longitude' },
        radius: { type: 'number', description: 'Search radius in meters (default 1000)' },
      },
      required: ['poi_type', 'lat', 'lon'],
    },
  },
  {
    name: 'calculate_route',
    description: 'Calculate a route between two points. Returns distance, duration, and geometry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from_lat: { type: 'number' },
        from_lon: { type: 'number' },
        to_lat: { type: 'number' },
        to_lon: { type: 'number' },
        mode: { type: 'string', enum: ['auto', 'bicycle', 'pedestrian'], description: 'Travel mode (default auto)' },
      },
      required: ['from_lat', 'from_lon', 'to_lat', 'to_lon'],
    },
  },
  {
    name: 'render_component',
    description: 'Render an interactive UI component in the user\'s workspace. The HTML must be self-contained with inline CSS/JS. Use Leaflet CDN for maps, Chart.js CDN for charts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        html: { type: 'string', description: 'Complete self-contained HTML document for the component' },
        component_type: { type: 'string', description: 'Type identifier (e.g., "map_view", "data_table", "chart")' },
        intent_schema: {
          type: 'object',
          description: 'Map of intent names to their payload field schemas. Example: {"marker_click": {"lat": {"type": "number"}, "lon": {"type": "number"}}}',
        },
      },
      required: ['html', 'component_type'],
    },
  },
  {
    name: 'show_notification',
    description: 'Show a toast notification to the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Notification text' },
        type: { type: 'string', enum: ['info', 'success', 'warning', 'error'], description: 'Notification type' },
      },
      required: ['message', 'type'],
    },
  },
  {
    name: 'remove_component',
    description: 'Remove a UI component from the workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        component_id: { type: 'string', description: 'ID of the component to remove' },
      },
      required: ['component_id'],
    },
  },
];

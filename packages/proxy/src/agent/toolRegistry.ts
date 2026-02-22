import type OpenAI from 'openai';

export const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'geocode',
      description: 'Resolve place name to lat/lon coordinates.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Place name' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_pois',
      description: 'Find points of interest near coordinates.',
      parameters: {
        type: 'object',
        properties: {
          poi_type: { type: 'string', description: 'OSM amenity type (cafe, restaurant, hospital)' },
          lat: { type: 'number' },
          lon: { type: 'number' },
          radius: { type: 'number', description: 'Meters (default 1000)' },
        },
        required: ['poi_type', 'lat', 'lon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_route',
      description: 'Route between two points.',
      parameters: {
        type: 'object',
        properties: {
          from_lat: { type: 'number' },
          from_lon: { type: 'number' },
          to_lat: { type: 'number' },
          to_lon: { type: 'number' },
          mode: { type: 'string', enum: ['auto', 'bicycle', 'pedestrian'] },
        },
        required: ['from_lat', 'from_lon', 'to_lat', 'to_lon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_component',
      description: 'Render self-contained HTML/JS UI in workspace. Use Leaflet CDN for maps.',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'Self-contained HTML' },
          component_type: { type: 'string', description: 'e.g. map_view, chart, data_table' },
        },
        required: ['html', 'component_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_notification',
      description: 'Show toast notification.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
        },
        required: ['message', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_component',
      description: 'Remove a UI component.',
      parameters: {
        type: 'object',
        properties: {
          component_id: { type: 'string' },
        },
        required: ['component_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web via SearXNG. Returns titles, URLs, snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          category: { type: 'string', enum: ['general', 'news', 'images', 'science', 'files'], description: 'Search category (default general)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_page',
      description: 'Fetch a web page and extract readable content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description: 'Execute Python or JavaScript code. Results shown in browser via Pyodide (Python) or direct eval (JS).',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code to execute' },
          language: { type: 'string', enum: ['python', 'javascript'], description: 'Language (default python)' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a user-uploaded file from the session.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename to read' },
        },
        required: ['filename'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a file to the session, making it downloadable.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename to create' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['filename', 'content'],
      },
    },
  },
];

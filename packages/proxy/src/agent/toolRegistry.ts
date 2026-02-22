import type OpenAI from 'openai';

export const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'geocode',
      description: 'Resolve a place name to lat/lon coordinates using Nominatim. Use before search_pois or calculate_route.',
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
      description: 'Find points of interest near coordinates using Overpass API. Use after geocode to get the lat/lon.',
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
      description: 'Calculate a route between two points using Valhalla. Returns distance, duration, and geometry. Modes: auto, bicycle, pedestrian.',
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
      description: 'Render interactive HTML/JS/CSS in a sandboxed iframe. Use CSS design system variables (--bg-base, --accent, etc.). Import map available: three, chart.js/auto, d3, mermaid, marked, lodash, canvas-confetti. Use <script type="module"> for ESM. For Leaflet maps, use classic <script> from unpkg CDN.',
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
      description: 'Search the web via SearXNG. Returns titles, URLs, snippets. Use "general" for broad queries, "news" for current events, "science" for academic/research, "images" for visual content, "files" for downloadable files.',
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
      description: 'Fetch a web page and display it in a clean reader view. The reader view window is auto-rendered — do NOT also call render_component for the same content. You receive a text summary as the tool result.',
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
      description: 'Run Python (Pyodide) or JavaScript with visible output. Use for calculations, data processing, algorithms, and analysis. Python: pandas, numpy, matplotlib, scipy, scikit-learn auto-load from imports. Matplotlib figures render as inline SVG. Each call creates one visible code+output window.',
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
      description: 'Read a user-uploaded file from the session. Returns file content and MIME type. Use after list_session_files to know what is available.',
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
      description: 'Write a file to the session directory, making it downloadable by the user. Returns download URL.',
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
  {
    type: 'function',
    function: {
      name: 'list_session_files',
      description: 'List all files uploaded in the current session. Call this before data analysis to discover what files are available. Returns filename and size for each file.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_component',
      description: 'Send a data update to an existing UI component without full re-render. The component must have a window.addEventListener("message") handler for ui_update events. Params: component_id, action name, payload object.',
      parameters: {
        type: 'object',
        properties: {
          component_id: { type: 'string', description: 'ID of the component to update' },
          action: { type: 'string', description: 'Update action name the component listens for' },
          payload: { type: 'object', description: 'Data payload to send to the component' },
        },
        required: ['component_id', 'action', 'payload'],
      },
    },
  },
];

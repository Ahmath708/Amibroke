// Manual mock for AsyncStorage so Jest can load modules that import it
// (services/supabaseClient.ts, analytics.ts, offlineCache.ts). Auto-applied by
// Jest for this node_modules package without an explicit jest.mock() call.
let store = {};
module.exports = {
  __esModule: true,
  default: {
    getItem: jest.fn((k) => Promise.resolve(k in store ? store[k] : null)),
    setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
    removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
    clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
    multiGet: jest.fn((keys) => Promise.resolve(keys.map((k) => [k, k in store ? store[k] : null]))),
    multiSet: jest.fn((pairs) => { pairs.forEach(([k, v]) => { store[k] = v; }); return Promise.resolve(); }),
    multiRemove: jest.fn((keys) => { keys.forEach((k) => { delete store[k]; }); return Promise.resolve(); }),
  },
};

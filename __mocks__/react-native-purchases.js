// Manual mock for the native RevenueCat SDK so Jest can load any module that
// imports it (e.g. services/purchases.ts via services/subscriptions.ts) without
// hitting the un-transpilable native ESM. Tests that need specific behavior can
// still jest.mock('react-native-purchases', factory) to override.
const noop = () => {};
module.exports = {
  __esModule: true,
  default: {
    setLogLevel: noop,
    configure: noop,
    logIn: async () => ({}),
    logOut: async () => ({}),
    getOfferings: async () => ({ current: null }),
    purchasePackage: async () => ({}),
    restorePurchases: async () => ({}),
    getCustomerInfo: async () => ({ entitlements: { active: {} } }),
    showManageSubscriptions: async () => {},
    addCustomerInfoUpdateListener: noop,
    removeCustomerInfoUpdateListener: noop,
  },
  LOG_LEVEL: { VERBOSE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 },
};

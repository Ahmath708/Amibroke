/**
 * Expo config plugin: wire the checked-in StoreKit configuration file into the
 * generated Xcode scheme so RevenueCat / StoreKit local testing works after a
 * prebuild (ios/ is gitignored and regenerated, so this must be re-applied).
 *
 * This is BEST-EFFORT and fully defensive — any failure is swallowed so it can
 * never break `expo prebuild`. If it doesn't take effect, set it manually in
 * Xcode: Edit Scheme → Run → Options → StoreKit Configuration → select
 * storekit/AmIBroke.products.storekit (see REVENUECAT_SETUP.md).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Path from a .xcscheme (ios/<App>.xcodeproj/xcshareddata/xcschemes/) to the
// repo-root storekit file.
const STOREKIT_REF = '../../../../storekit/AmIBroke.products.storekit';

function findSchemes(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.xcscheme')) out.push(full);
    }
  };
  try { walk(dir); } catch { /* ignore */ }
  return out;
}

const withStoreKitConfig = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      try {
        const refXml =
          '\n      <StoreKitConfigurationFileReference\n' +
          `         identifier = "${STOREKIT_REF}">\n` +
          '      </StoreKitConfigurationFileReference>';
        for (const scheme of findSchemes(cfg.modRequest.platformProjectRoot)) {
          let xml = fs.readFileSync(scheme, 'utf8');
          if (xml.includes('StoreKitConfigurationFileReference')) continue; // already wired
          if (!xml.includes('</LaunchAction>')) continue;
          xml = xml.replace('</LaunchAction>', `${refXml}\n   </LaunchAction>`);
          fs.writeFileSync(scheme, xml);
        }
      } catch (e) {
        console.warn('[withStoreKitConfig] skipped — set StoreKit config manually in Xcode:', e && e.message);
      }
      return cfg;
    },
  ]);

module.exports = withStoreKitConfig;

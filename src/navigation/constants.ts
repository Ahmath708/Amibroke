// Vertical clearance a scrollable tab screen must reserve at the bottom so its
// content isn't hidden behind the floating tab bar. The bar is position:absolute
// and floats (detached from the screen edges, Cash-App style), so this covers the
// capsule height + the gap below it; screens add insets.bottom on top.
export const TAB_BAR_HEIGHT = 86;

// Internal geometry of the floating capsule (see IOSTabBar in AppNavigator).
export const TAB_ROW_HEIGHT = 64; // capsule content height
export const TAB_FLOAT_MARGIN = 4; // gap between the capsule bottom and the safe area

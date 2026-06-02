import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, AnalysisHistoryItem } from '@/types';
import { Colors, Spacing } from '@/theme/colors';
import { getAnalysesPage, getAnalysisById } from '@/services/claudeApi';
import { useAuth } from '@/context/AuthContext';
import AnalysisRow from '@/components/AnalysisRow';
import ScreenBackground from '@/components/ScreenBackground';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

const PAGE_SIZE = 20;

/** The full, keyset-paginated archive of every analysis (created_at DESC), reached
 *  from History → "View All". Same infinite-scroll pattern as the community feed. */
export default function AllAnalysesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rowLoading, setRowLoading] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (reset: boolean) => {
    if (!user || loadingRef.current) return;
    if (!reset && !hasMore) return;
    loadingRef.current = true;
    if (!reset) setLoadingMore(true);
    const page = await getAnalysesPage({ userId: user.id, cursor: reset ? null : cursor, limit: PAGE_SIZE });
    setItems((prev) => {
      if (reset) return page.items;
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
    });
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setLoading(false);
    setLoadingMore(false);
    loadingRef.current = false;
  }, [user, cursor, hasMore]);

  useEffect(() => {
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleRowPress = async (id: string) => {
    if (rowLoading) return;
    setRowLoading(id);
    try {
      const analysis = await getAnalysisById(id);
      if (analysis) navigation.navigate('Results', { analysis, userInput: '' });
    } catch {
      // ignore
    } finally {
      setRowLoading(null);
    }
  };

  const renderItem = ({ item, index }: { item: AnalysisHistoryItem; index: number }) => {
    const older = items[index + 1]; // list is DESC, so the next item is the previous analysis
    const delta = older ? item.score - older.score : undefined;
    return (
      <AnalysisRow
        item={item}
        delta={delta}
        loading={rowLoading === item.id}
        disabled={!!rowLoading}
        onPress={() => handleRowPress(item.id)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="history" />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        onEndReached={() => loadPage(false)}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        ListEmptyComponent={
          loading ? (
            <LoadingState style={{ paddingTop: 60 }} />
          ) : (
            <EmptyState emoji="📋" title="No analyses yet" body="Run your first analysis to start your history." />
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 60 },
});

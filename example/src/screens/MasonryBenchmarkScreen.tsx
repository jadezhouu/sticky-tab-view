import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MasonryList, type TItemBase } from '@jadezhou/sticky-tab-view';

import {
  createMasonryBenchmarkItems,
  type MasonryBenchmarkItem,
} from '../demo-data/masonry-benchmark';

type BenchmarkConfig = {
  itemCount: number;
  columnCount: number;
  reuseTypeCount: number;
};

const DEFAULT_CONFIG: BenchmarkConfig = {
  itemCount: 100,
  columnCount: 2,
  reuseTypeCount: 3,
};
const BENCHMARK_SEED = 20260827;
const PAGE_SIZE = 50;

type BenchmarkListItem = MasonryBenchmarkItem & TItemBase;

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function MasonryBenchmarkControls({
  config,
  onChange,
}: {
  config: BenchmarkConfig;
  onChange: (config: BenchmarkConfig) => void;
}) {
  const update = (partial: Partial<BenchmarkConfig>) => onChange({ ...config, ...partial });

  return (
    <View style={styles.controls}>
      <Text style={styles.title}>Masonry performance benchmark</Text>
      <Text style={styles.description}>Fixed seed {BENCHMARK_SEED}; record each scenario three times on device.</Text>
      <View style={styles.row}>
        {[100, 500, 1000].map((itemCount) => (
          <Choice key={itemCount} active={config.itemCount === itemCount} label={`${itemCount} items`} onPress={() => update({ itemCount })} />
        ))}
      </View>
      <View style={styles.row}>
        {[1, 2, 3].map((columnCount) => (
          <Choice key={columnCount} active={config.columnCount === columnCount} label={`${columnCount} column${columnCount === 1 ? '' : 's'}`} onPress={() => update({ columnCount })} />
        ))}
      </View>
      <View style={styles.row}>
        {[1, 3].map((reuseTypeCount) => (
          <Choice key={reuseTypeCount} active={config.reuseTypeCount === reuseTypeCount} label={`${reuseTypeCount} reuse type${reuseTypeCount === 1 ? '' : 's'}`} onPress={() => update({ reuseTypeCount })} />
        ))}
      </View>
    </View>
  );
}

export function MasonryBenchmarkScreen() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const items = useMemo(
    () => createMasonryBenchmarkItems({
      count: config.itemCount,
      reuseTypeCount: config.reuseTypeCount,
      seed: BENCHMARK_SEED,
    }),
    [config],
  );
  const onFetch = useCallback(async (page: number) => {
    const start = page * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    return { items: pageItems, hasMore: start + PAGE_SIZE < items.length };
  }, [items]);
  const renderItem = useCallback((item: BenchmarkListItem) => (
    <View style={[styles.card, { height: item.height }]}>
      <Text style={styles.cardText}>{item.id}</Text>
      <Text style={styles.cardMeta}>{item.reuseType} · {item.height}px</Text>
    </View>
  ), []);

  return (
    <View style={styles.screen}>
      <MasonryBenchmarkControls config={config} onChange={setConfig} />
      <MasonryList<BenchmarkListItem>
        key={`${config.itemCount}-${config.columnCount}-${config.reuseTypeCount}`}
        columnForSection={() => config.columnCount}
        gap={8}
        heightForItem={(item) => item.height}
        horizontalPadding={12}
        onFetch={onFetch}
        renderItem={renderItem}
        showsVerticalScrollIndicator
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f3f7' },
  controls: { backgroundColor: '#fff', gap: 8, padding: 12 },
  title: { color: '#1a1a2e', fontSize: 18, fontWeight: '700' },
  description: { color: '#666', fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderColor: '#d6d8df', borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  choiceActive: { backgroundColor: '#002fa7', borderColor: '#002fa7' },
  choiceText: { color: '#35405f', fontSize: 12, fontWeight: '600' },
  choiceTextActive: { color: '#fff' },
  card: { alignItems: 'center', backgroundColor: '#d9e4ff', borderRadius: 10, justifyContent: 'center', padding: 8 },
  cardText: { color: '#1a1a2e', fontSize: 12, fontWeight: '700' },
  cardMeta: { color: '#536080', fontSize: 11, marginTop: 4 },
});

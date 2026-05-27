import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { colors, spacing } from '../../src/theme';

interface SummaryRow {
  location: string;
  hitCount: number;
}

function toLocalYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDates() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return { start: toLocalYMD(weekAgo), end: toLocalYMD(today) };
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && ref.current) {
      const el = ref.current as HTMLInputElement;
      el.type = 'date';
      el.value = value;
      el.style.fontSize = '12px';
      el.style.padding = '2px 4px';
      el.style.border = '1px solid #ccc';
      el.style.borderRadius = '4px';
      el.style.width = '87px';
      el.style.color = '#444444';
      const handler = (e: Event) => onChange((e.target as HTMLInputElement).value);
      el.addEventListener('change', handler);
      return () => el.removeEventListener('change', handler);
    }
  }, [value, onChange]);

  if (Platform.OS === 'web') {
    return React.createElement('input', { ref });
  }
  return null;
}

function PageSelect({ value, onChange, pages }: { value: string; onChange: (v: string) => void; pages: string[] }) {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && ref.current) {
      const el = ref.current as HTMLSelectElement;
      el.value = value;
      el.style.fontSize = '12px';
      el.style.padding = '2px 4px';
      el.style.border = '1px solid #ccc';
      el.style.borderRadius = '4px';
      el.style.color = '#444444';
      const handler = (e: Event) => onChange((e.target as HTMLSelectElement).value);
      el.addEventListener('change', handler);
      return () => el.removeEventListener('change', handler);
    }
  }, [value, onChange, pages]);

  if (Platform.OS === 'web') {
    return React.createElement('select', { ref },
      React.createElement('option', { value: '' }, 'All pages'),
      ...pages.map(p => React.createElement('option', { key: p, value: p }, p)),
    );
  }
  return null;
}

const COL_WIDTHS = {
  location: 300,
  hitCount: 100,
};

export default function PageHitsScreen() {
  const defaults = defaultDates();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const fetchData = useCallback(async (sd: string, ed: string, page: string) => {
    try {
      setError('');
      const pageParam = page ? `&page=${encodeURIComponent(page)}` : '';
      const res = await api.get<{ summary: SummaryRow[] }>(
        `/api/admin/page-hits?startDate=${sd}&endDate=${ed}${pageParam}`
      );
      setRows(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load page hits');
    }
  }, []);

  useEffect(() => {
    api.get<{ pages: string[] }>('/api/admin/page-hits/pages')
      .then(res => setPages(res.pages))
      .catch(() => {});
    fetchData(defaults.start, defaults.end, '').finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(startDate, endDate, selectedPage);
    setRefreshing(false);
  }, [fetchData, startDate, endDate, selectedPage]);

  const handleGo = () => {
    fetchData(startDate, endDate, selectedPage);
  };

  const totalHits = rows.reduce((sum, r) => sum + r.hitCount, 0);

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeader />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader />
      <View style={styles.toolbar}>
        <Text style={styles.title}>Page Hits</Text>
        <DateInput value={startDate} onChange={setStartDate} />
        <DateInput value={endDate} onChange={setEndDate} />
        <PageSelect value={selectedPage} onChange={setSelectedPage} pages={pages} />
        <Pressable onPress={handleGo} style={styles.goButton}>
          <Text style={styles.goButtonText}>Go</Text>
        </Pressable>
        <Text style={styles.countText}>{totalHits} hit{totalHits !== 1 ? 's' : ''}, {rows.length} location{rows.length !== 1 ? 's' : ''}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.replace('/settings')} style={styles.backButton} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.tableContainer}>
        <ScrollView horizontal style={styles.scrollHorizontal} contentContainerStyle={styles.scrollHorizontalContent}>
          <View>
            <View style={styles.headerRow}>
              <View style={[styles.headerCell, { width: COL_WIDTHS.location }]}>
                <Text style={styles.headerText}>Location</Text>
              </View>
              <View style={[styles.headerCell, { width: COL_WIDTHS.hitCount }]}>
                <Text style={styles.headerText}>Hits</Text>
              </View>
            </View>

            <ScrollView
              style={styles.scrollOuter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {rows.map((row, i) => (
                <View key={row.location} style={[styles.dataRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                  <Text style={[styles.cell, { width: COL_WIDTHS.location }]} numberOfLines={1}>
                    {row.location}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.hitCount, textAlign: 'right' }]} numberOfLines={1}>
                    {row.hitCount}
                  </Text>
                </View>
              ))}

              {rows.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No page hits in the selected date range.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const gridFont = Platform.OS === 'web'
  ? { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
  : {};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  goButton: {
    backgroundColor: colors.green,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  goButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  countText: {
    fontSize: 12,
    color: colors.textSecondary,
    ...gridFont,
  },
  backButton: {
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#444444',
    fontSize: 14,
  },
  errorBox: {
    margin: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  tableContainer: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  scrollOuter: {
    flex: 1,
  },
  scrollHorizontal: {
    flex: 1,
  },
  scrollHorizontalContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.purple,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  headerCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    ...gridFont,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  rowEven: {
    backgroundColor: colors.white,
  },
  rowOdd: {
    backgroundColor: '#faf8fc',
  },
  cell: {
    fontSize: 12,
    color: colors.textPrimary,
    paddingHorizontal: 4,
    ...gridFont,
  },
  emptyRow: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: '#444444',
    fontSize: 13,
  },
});

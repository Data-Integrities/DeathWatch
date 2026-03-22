import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { colors, spacing } from '../../src/theme';

interface ErrorRow {
  id: number;
  loginId: string | null;
  userName: string;
  email: string;
  errorMessage: string;
  page: string;
  userAgent: string;
  createdAt: string;
}

type SortKey = 'dateTime' | 'name' | 'page' | 'error';
type SortDir = 'asc' | 'desc';

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

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yy}/${mm}/${dd} ${hh}:${min}`;
}

function sortRows(rows: ErrorRow[], sortKey: SortKey, sortDir: SortDir): ErrorRow[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'dateTime':
        return a.createdAt.localeCompare(b.createdAt) * dir;
      case 'name':
        return a.userName.localeCompare(b.userName) * dir;
      case 'page':
        return a.page.localeCompare(b.page) * dir;
      case 'error':
        return a.errorMessage.localeCompare(b.errorMessage) * dir;
    }
  });
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

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'text',
      value,
      placeholder: 'Search',
      onChange: (e: any) => onChange(e.target.value),
      style: {
        fontSize: '12px',
        padding: '2px 4px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        width: '80px',
        color: '#444444',
      },
    });
  }
  return null;
}

const COL_WIDTHS = {
  dateTime: 120,
  name: 130,
  page: 140,
};

export default function ErrorsScreen() {
  const defaults = defaultDates();
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [search, setSearch] = useState('');

  const fetchErrors = useCallback(async (sd: string, ed: string) => {
    try {
      setError('');
      const res = await api.get<{ errors: ErrorRow[] }>(
        `/api/admin/errors?startDate=${sd}&endDate=${ed}`
      );
      setRows(res.errors);
    } catch (err: any) {
      setError(err.message || 'Failed to load errors');
    }
  }, []);

  useEffect(() => {
    fetchErrors(defaults.start, defaults.end).finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchErrors(startDate, endDate);
    setRefreshing(false);
  }, [fetchErrors, startDate, endDate]);

  const handleGo = () => {
    fetchErrors(startDate, endDate);
  };

  const filtered = search
    ? rows.filter(r => {
        const q = search.toLowerCase();
        return r.userName.toLowerCase().includes(q)
          || r.errorMessage.toLowerCase().includes(q)
          || r.page.toLowerCase().includes(q)
          || r.email.toLowerCase().includes(q);
      })
    : rows;
  const sorted = sortRows(filtered, sortKey, sortDir);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'dateTime' ? 'desc' : 'asc');
    }
  };

  const headerCell = (label: string, key: SortKey, width?: number) => (
    <Pressable onPress={() => handleSort(key)} style={[styles.headerCell, width ? { width } : styles.flexCell]}>
      <Text style={styles.headerText}>{label}</Text>
    </Pressable>
  );

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
        <Text style={styles.title}>Error Log</Text>
        <DateInput value={startDate} onChange={setStartDate} />
        <DateInput value={endDate} onChange={setEndDate} />
        <Pressable onPress={handleGo} style={styles.goButton}>
          <Text style={styles.goButtonText}>Go</Text>
        </Pressable>
        <SearchInput value={search} onChange={setSearch} />
        <Text style={styles.countText}>{filtered.length} error{filtered.length !== 1 ? 's' : ''}</Text>
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
              {headerCell('Date/Time', 'dateTime', COL_WIDTHS.dateTime)}
              {headerCell('User', 'name', COL_WIDTHS.name)}
              {headerCell('Page', 'page', COL_WIDTHS.page)}
              {headerCell('Error', 'error')}
            </View>

            <ScrollView
              style={styles.scrollOuter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {sorted.map((row, i) => (
                <View key={row.id} style={[styles.dataRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                  <Text style={[styles.cell, { width: COL_WIDTHS.dateTime }]} numberOfLines={1}>
                    {formatDateTime(row.createdAt)}
                  </Text>
                  <Pressable
                    style={{ width: COL_WIDTHS.name }}
                    ref={(ref: any) => { if (Platform.OS === 'web' && ref) ref.title = row.email; }}
                  >
                    <Text style={[styles.cell]} numberOfLines={1}>{row.userName}</Text>
                  </Pressable>
                  <Text style={[styles.cell, { width: COL_WIDTHS.page }]} numberOfLines={1}>
                    {row.page}
                  </Text>
                  <Text style={[styles.cell, styles.flexCell]} numberOfLines={2}>
                    {row.errorMessage}
                  </Text>
                </View>
              ))}

              {sorted.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No errors in the selected date range.</Text>
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
  flexCell: {
    flex: 1,
    minWidth: 200,
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

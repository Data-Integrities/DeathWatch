import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { colors, spacing } from '../../src/theme';

interface ActivityRow {
  location: string;
  name: string;
  lastName: string;
  firstName: string;
  dateTime: string;
  action: string;
  detail: string;
}

type SortKey = 'location' | 'name' | 'dateTime' | 'action' | 'detail';
type SortDir = 'asc' | 'desc';

function toLocalYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDates() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return { start: toLocalYMD(yesterday), end: toLocalYMD(today) };
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

function sortRows(rows: ActivityRow[], sortKey: SortKey, sortDir: SortDir): ActivityRow[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'location':
        return a.location.localeCompare(b.location) * dir;
      case 'name': {
        const last = a.lastName.localeCompare(b.lastName) * dir;
        if (last !== 0) return last;
        return a.firstName.localeCompare(b.firstName) * dir;
      }
      case 'dateTime':
        return a.dateTime.localeCompare(b.dateTime) * dir;
      case 'action':
        return a.action.localeCompare(b.action) * dir;
      case 'detail':
        return a.detail.localeCompare(b.detail) * dir;
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
  location: 80,
  name: 110,
  dateTime: 95,
  action: 75,
};

export default function ActivityScreen() {
  const defaults = defaultDates();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [search, setSearch] = useState('');

  const fetchActivity = useCallback(async (sd: string, ed: string) => {
    try {
      setError('');
      const res = await api.get<{ activity: ActivityRow[] }>(
        `/api/admin/activity?startDate=${sd}&endDate=${ed}`
      );
      setRows(res.activity);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity');
    }
  }, []);

  useEffect(() => {
    fetchActivity(defaults.start, defaults.end).finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchActivity(startDate, endDate);
    setRefreshing(false);
  }, [fetchActivity, startDate, endDate]);

  const handleGo = () => {
    fetchActivity(startDate, endDate);
  };

  const filtered = search
    ? rows.filter(r => {
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q)
          || r.location.toLowerCase().includes(q)
          || r.action.toLowerCase().includes(q)
          || r.detail.toLowerCase().includes(q);
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

  const headerCell = (label: string, key: SortKey, width: number) => (
    <Pressable onPress={() => handleSort(key)} style={[styles.headerCell, { width }]}>
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
        <Text style={styles.title}>User Activity</Text>
        <DateInput value={startDate} onChange={setStartDate} />
        <DateInput value={endDate} onChange={setEndDate} />
        <Pressable onPress={handleGo} style={styles.goButton}>
          <Text style={styles.goButtonText}>Go</Text>
        </Pressable>
        <SearchInput value={search} onChange={setSearch} />
        <Button title="Back" variant="ghost" onPress={() => router.replace('/settings')} style={styles.backButton} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.tableContainer}>
        <ScrollView horizontal style={styles.scrollHorizontal}>
          <View>
            {/* Frozen header row */}
            <View style={styles.headerRow}>
              {headerCell('Location', 'location', COL_WIDTHS.location)}
              {headerCell('Name', 'name', COL_WIDTHS.name)}
              {headerCell('Date/Time', 'dateTime', COL_WIDTHS.dateTime)}
              {headerCell('Operation', 'action', COL_WIDTHS.action)}
              <Pressable onPress={() => handleSort('detail')} style={[styles.headerCell, styles.flexCell]}>
                <Text style={styles.headerText}>Fingerprint</Text>
              </Pressable>
            </View>

            {/* Scrollable data rows */}
            <ScrollView
              style={styles.scrollOuter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {sorted.map((row, i) => (
                <View key={i} style={[styles.dataRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                  <Text style={[styles.cell, { width: COL_WIDTHS.location }]} numberOfLines={1}>{row.location}</Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.name }]} numberOfLines={1}>{row.name}</Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.dateTime }]} numberOfLines={1}>{formatDateTime(row.dateTime)}</Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.action }]} numberOfLines={1}>{row.action}</Text>
                  <Text style={[styles.cell, styles.flexCell]} numberOfLines={1}>{row.detail}</Text>
                </View>
              ))}

              {sorted.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No activity in the selected date range.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const monoFont = Platform.OS === 'web'
  ? { fontFamily: "'Roboto Condensed', 'Arial Narrow', sans-serif" }
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
  backButton: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 0,
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
    alignSelf: 'center',
  },
  scrollOuter: {
    flex: 1,
  },
  scrollHorizontal: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.purple,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  headerText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    ...monoFont,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowEven: {
    backgroundColor: colors.white,
  },
  rowOdd: {
    backgroundColor: '#faf8fc',
  },
  cell: {
    fontSize: 11,
    color: colors.textPrimary,
    paddingHorizontal: 4,
    ...monoFont,
  },
  flexCell: {
    flex: 1,
    minWidth: 120,
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

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { colors, spacing } from '../../src/theme';

interface UserRow {
  firstName: string;
  lastName: string;
  location: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  signInCount: number;
  searchesCount: number;
  matchesCount: number;
  searchesDeletedCount: number;
  rightPersonCount: number;
  wrongPersonCount: number;
  searchEditCount: number;
}

type SortKey = 'name' | 'location' | 'email' | 'admin' | 'createdAt' | 'si' | 'se' | 'ma' | 'sd' | 'rp' | 'wp' | 'sedit';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

function getNumericValue(row: UserRow, key: SortKey): number {
  switch (key) {
    case 'si': return row.signInCount;
    case 'se': return row.searchesCount;
    case 'ma': return row.matchesCount;
    case 'sd': return row.searchesDeletedCount;
    case 'rp': return row.rightPersonCount;
    case 'wp': return row.wrongPersonCount;
    case 'sedit': return row.searchEditCount;
    default: return 0;
  }
}

function sortRows(rows: UserRow[], sortKey: SortKey, sortDir: SortDir): UserRow[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'name': {
        const last = a.lastName.localeCompare(b.lastName) * dir;
        if (last !== 0) return last;
        return a.firstName.localeCompare(b.firstName) * dir;
      }
      case 'location':
        return a.location.localeCompare(b.location) * dir;
      case 'email':
        return a.email.localeCompare(b.email) * dir;
      case 'admin': {
        const av = a.isAdmin ? 1 : 0;
        const bv = b.isAdmin ? 1 : 0;
        return (av - bv) * dir;
      }
      case 'createdAt':
        return a.createdAt.localeCompare(b.createdAt) * dir;
      default:
        return (getNumericValue(a, sortKey) - getNumericValue(b, sortKey)) * dir;
    }
  });
}

const COL_WIDTHS = {
  name: 140,
  location: 120,
  email: 190,
  admin: 40,
  created: 75,
  si: 32,
  se: 32,
  ma: 32,
  sd: 32,
  rp: 32,
  wp: 32,
  sedit: 32,
};

export default function UsersScreen() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setError('');
      const res = await api.get<{ users: UserRow[] }>('/api/admin/users');
      setRows(res.users);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const sorted = sortRows(rows, sortKey, sortDir);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const headerCell = (label: string, key: SortKey, width: number, center?: boolean, title?: string) => (
    <Pressable
      onPress={() => handleSort(key)}
      style={[styles.headerCell, { width }, center && styles.centerCell]}
      ref={(ref: any) => { if (Platform.OS === 'web' && ref && title) ref.title = title; }}
    >
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
        <Text style={styles.title}>Users</Text>
        <Button title="Back" variant="ghost" onPress={() => router.replace('/settings')} />
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
              {headerCell('Name', 'name', COL_WIDTHS.name)}
              {headerCell('Location', 'location', COL_WIDTHS.location, false, 'IP defined at account creation')}
              {headerCell('Email', 'email', COL_WIDTHS.email)}
              {headerCell('Adm', 'admin', COL_WIDTHS.admin, true, 'Administrator')}
              {headerCell('Created', 'createdAt', COL_WIDTHS.created)}
              {headerCell('Si', 'si', COL_WIDTHS.si, true, 'Sign In count')}
              {headerCell('Se', 'se', COL_WIDTHS.se, true, 'Searches count')}
              {headerCell('Ob', 'ma', COL_WIDTHS.ma, true, 'Obituaries found count')}
              {headerCell('sd', 'sd', COL_WIDTHS.sd, true, 'Searches Deleted count')}
              {headerCell('rp', 'rp', COL_WIDTHS.rp, true, 'Right Person count')}
              {headerCell('wp', 'wp', COL_WIDTHS.wp, true, 'Wrong Person count')}
              {headerCell('se', 'sedit', COL_WIDTHS.sedit, true, 'Search Edit count')}
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
                  <Text style={[styles.cell, { width: COL_WIDTHS.name }]} numberOfLines={1}>
                    {row.lastName}, {row.firstName}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.location }]} numberOfLines={1}>
                    {row.location}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.email }]} numberOfLines={1}>
                    {row.email}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.admin }]} numberOfLines={1}>
                    {row.isAdmin ? 'Y' : ''}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.created }]} numberOfLines={1}>
                    {formatDate(row.createdAt)}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.si }]} numberOfLines={1}>
                    {row.signInCount}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.se }]} numberOfLines={1}>
                    {row.searchesCount}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.ma }]} numberOfLines={1}>
                    {row.matchesCount}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.sd }]} numberOfLines={1}>
                    {row.searchesDeletedCount}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.rp }]} numberOfLines={1}>
                    {row.rightPersonCount}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.wp }]} numberOfLines={1}>
                    {row.wrongPersonCount}
                  </Text>
                  <Text style={[styles.cell, styles.centerText, { width: COL_WIDTHS.sedit }]} numberOfLines={1}>
                    {row.searchEditCount}
                  </Text>
                </View>
              ))}

              {sorted.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No users found.</Text>
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
  centerCell: {
    alignItems: 'center',
  },
  headerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    ...gridFont,
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
    fontSize: 12,
    color: colors.textPrimary,
    paddingHorizontal: 4,
    ...gridFont,
  },
  centerText: {
    textAlign: 'center',
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

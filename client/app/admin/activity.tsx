import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl, Modal } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { colors, spacing, shadows, borderRadius } from '../../src/theme';

interface ActivityRow {
  loginId: string;
  location: string;
  ip: string;
  name: string;
  lastName: string;
  firstName: string;
  dateTime: string;
  action: string;
  detail: string;
}

interface UserRow {
  id: string;
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
  subscriptionActive: boolean;
  planCode: string | null;
  lastSignIn: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  smsOptIn: boolean;
  trialSearchesUsed: number;
  planStartDate: string | null;
  planRenewalDate: string | null;
}

const TIER_OPTIONS = [
  { code: null, label: 'None' },
  { code: 'PLAN_10', label: '10' },
  { code: 'PLAN_25', label: '25' },
  { code: 'PLAN_50', label: '50' },
  { code: 'PLAN_100', label: '100' },
] as const;

function tierDisplayLabel(code: string | null): string {
  if (!code) return 'None';
  const opt = TIER_OPTIONS.find(o => o.code === code);
  return opt ? `Plan ${opt.label}` : code;
}

type SortKey = 'location' | 'ip' | 'name' | 'dateTime' | 'action' | 'detail';
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

function formatDateTime(iso: string | null): string {
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
      case 'ip':
        return a.ip.localeCompare(b.ip) * dir;
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
  location: 110,
  ip: 110,
  name: 140,
  dateTime: 120,
  action: 95,
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

  // User detail modal
  const [usersMap, setUsersMap] = useState<Map<string, UserRow>>(new Map());
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [editTier, setEditTier] = useState<string | null>(null);
  const [tierConfirming, setTierConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get<{ users: UserRow[] }>('/api/admin/users');
      const map = new Map<string, UserRow>();
      res.users.forEach(u => map.set(u.id, u));
      setUsersMap(map);
    } catch {}
  }, []);

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
    Promise.all([fetchActivity(defaults.start, defaults.end), fetchUsers()]).finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchActivity(startDate, endDate);
    setRefreshing(false);
  }, [fetchActivity, startDate, endDate]);

  const handleGo = () => {
    fetchActivity(startDate, endDate);
  };

  const openDetail = (loginId: string) => {
    const user = usersMap.get(loginId);
    if (!user) return;
    setDetailUser(user);
    setEditTier(user.planCode);
    setTierConfirming(false);
  };

  const handleTierChange = (newCode: string | null) => {
    if (!detailUser || newCode === (detailUser.planCode || null)) return;
    setEditTier(newCode);
    setTierConfirming(true);
  };

  const handleConfirmTier = async () => {
    if (!detailUser) return;
    setSaving(true);
    try {
      const isActivating = editTier !== null;
      await api.patch(`/api/admin/users/${detailUser.id}/subscription`, {
        planCode: editTier,
        subscriptionActive: isActivating,
      });
      await fetchUsers();
      setTierConfirming(false);
      const res = await api.get<{ users: UserRow[] }>('/api/admin/users');
      const updated = res.users.find(u => u.id === detailUser.id);
      if (updated) {
        setDetailUser(updated);
        setEditTier(updated.planCode);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update tier');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTier = () => {
    if (detailUser) setEditTier(detailUser.planCode);
    setTierConfirming(false);
  };

  const infoRow = (label: string, value: string | null | undefined) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '--'}</Text>
    </View>
  );

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
        <Button title="Users" variant="ghost" onPress={() => router.replace('/admin/users')} style={styles.backButton} />
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
            {/* Frozen header row */}
            <View style={styles.headerRow}>
              {headerCell('Location', 'location', COL_WIDTHS.location)}
              {headerCell('IP', 'ip', COL_WIDTHS.ip)}
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
                  <Text style={[styles.cell, { width: COL_WIDTHS.ip }]} numberOfLines={1}>{row.ip}</Text>
                  <Pressable style={{ width: COL_WIDTHS.name }} onPress={() => openDetail(row.loginId)}>
                    <Text style={[styles.cell, styles.nameLink]} numberOfLines={1}>{row.name}</Text>
                  </Pressable>
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

      {/* User detail modal */}
      {detailUser ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDetailUser(null)}>
          <Pressable style={styles.overlay} onPress={() => setDetailUser(null)}>
            <Pressable style={styles.detailDialog} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.detailTitle}>
                {detailUser.firstName} {detailUser.lastName}
              </Text>

              <Text style={styles.sectionLabel}>Account</Text>
              {infoRow('Email', detailUser.email)}
              {infoRow('Email Verified', detailUser.emailVerified ? 'Yes' : 'No')}
              {infoRow('Phone', detailUser.phoneNumber)}
              {infoRow('SMS Opt-In', detailUser.smsOptIn ? 'Yes' : 'No')}
              {infoRow('Admin', detailUser.isAdmin ? 'Yes' : 'No')}
              {infoRow('Location', detailUser.location)}
              {infoRow('Created', formatDateTime(detailUser.createdAt))}
              {infoRow('Last Sign In', formatDateTime(detailUser.lastSignIn))}

              <Text style={styles.sectionLabel}>Billing</Text>
              {infoRow('Subscription', detailUser.subscriptionActive ? 'Active' : 'Inactive')}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tier</Text>
                <View style={{ flex: 1 }}>
                  {Platform.OS === 'web' ? (
                    <select
                      value={editTier || ''}
                      onChange={(e: any) => handleTierChange(e.target.value || null)}
                      style={{
                        fontSize: 13,
                        padding: '2px 4px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        color: '#444444',
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      } as any}
                    >
                      <option value="">None</option>
                      <option value="PLAN_10">Plan 10 ($20/yr)</option>
                      <option value="PLAN_25">Plan 25 ($39/yr)</option>
                      <option value="PLAN_50">Plan 50 ($69/yr)</option>
                      <option value="PLAN_100">Plan 100 ($119/yr)</option>
                    </select>
                  ) : (
                    <Text style={styles.infoValue}>{tierDisplayLabel(detailUser.planCode)}</Text>
                  )}
                </View>
              </View>
              {tierConfirming ? (
                <View style={styles.tierConfirmRow}>
                  <Text style={styles.tierConfirmText}>
                    Change to {tierDisplayLabel(editTier)}?
                  </Text>
                  <View style={styles.tierConfirmButtons}>
                    <Pressable onPress={handleConfirmTier} style={styles.tierYesBtn}>
                      <Text style={styles.tierYesBtnText}>{saving ? '...' : 'Yes'}</Text>
                    </Pressable>
                    <Pressable onPress={handleCancelTier} style={styles.tierNoBtn}>
                      <Text style={styles.tierNoBtnText}>No</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {infoRow('Plan Start', detailUser.planStartDate || '--')}
              {infoRow('Plan Renewal', detailUser.planRenewalDate || '--')}
              {infoRow('Trial Searches Used', String(detailUser.trialSearchesUsed))}

              <Text style={styles.sectionLabel}>Activity</Text>
              {infoRow('Sign Ins', String(detailUser.signInCount))}
              {infoRow('Searches', String(detailUser.searchesCount))}
              {infoRow('Obituaries Found', String(detailUser.matchesCount))}
              {infoRow('Right Person', String(detailUser.rightPersonCount))}
              {infoRow('Wrong Person', String(detailUser.wrongPersonCount))}
              {infoRow('Searches Deleted', String(detailUser.searchesDeletedCount))}
              {infoRow('Search Edits', String(detailUser.searchEditCount))}

              <View style={styles.detailClose}>
                <Button title="Close" variant="secondary" onPress={() => setDetailUser(null)} style={styles.backButton} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
    textAlign: 'center',
    ...gridFont,
  },
  nameLink: {
    color: colors.purple,
    textDecorationLine: 'underline',
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

  // User detail modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  detailDialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 420,
    width: '100%',
    maxHeight: '80%',
    ...shadows.modal,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.purple,
    marginTop: spacing.sm,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    width: 130,
    ...gridFont,
  },
  infoValue: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
    ...gridFont,
  },
  detailClose: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  tierConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: spacing.sm,
  },
  tierConfirmText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
    flex: 1,
  },
  tierConfirmButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  tierYesBtn: {
    backgroundColor: colors.green,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  tierYesBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  tierNoBtn: {
    backgroundColor: colors.error,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  tierNoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});

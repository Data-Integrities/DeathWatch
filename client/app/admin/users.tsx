import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl, Modal } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, shadows, borderRadius } from '../../src/theme';

const TIER_OPTIONS = [
  { code: null, label: 'None' },
  { code: 'PLAN_10', label: '10' },
  { code: 'PLAN_25', label: '25' },
  { code: 'PLAN_50', label: '50' },
  { code: 'PLAN_100', label: '100' },
] as const;

function tierLabel(code: string | null): string {
  if (!code) return '--';
  return code.replace('PLAN_', '');
}

function tierDisplayLabel(code: string | null): string {
  if (!code) return 'None';
  const opt = TIER_OPTIONS.find(o => o.code === code);
  return opt ? `Plan ${opt.label}` : code;
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

type SortKey = 'name' | 'location' | 'email' | 'admin' | 'createdAt' | 'tier' | 'lastSi' | 'tr' | 'si' | 'se' | 'ma' | 'sd' | 'rp' | 'wp' | 'sedit';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
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

function getNumericValue(row: UserRow, key: SortKey): number {
  switch (key) {
    case 'tr': return row.trialSearchesUsed;
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
      case 'tier': {
        const ap = a.planCode || '';
        const bp = b.planCode || '';
        return ap.localeCompare(bp) * dir;
      }
      case 'lastSi':
        return (a.lastSignIn || '').localeCompare(b.lastSignIn || '') * dir;
      default:
        return (getNumericValue(a, sortKey) - getNumericValue(b, sortKey)) * dir;
    }
  });
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
  imp: 28,
  name: 140,
  location: 120,
  email: 190,
  admin: 40,
  tier: 48,
  created: 75,
  lastSi: 75,
  tr: 28,
  si: 32,
  se: 32,
  ma: 32,
  sd: 32,
  rp: 32,
  wp: 32,
  sedit: 32,
};

export default function UsersScreen() {
  const { startImpersonating } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  // User detail modal
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [editTier, setEditTier] = useState<string | null>(null);
  const [tierConfirming, setTierConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingTrials, setResettingTrials] = useState(false);

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

  const filtered = search
    ? rows.filter(r => {
        const q = search.toLowerCase();
        return r.firstName.toLowerCase().includes(q)
          || r.lastName.toLowerCase().includes(q)
          || r.email.toLowerCase().includes(q)
          || r.location.toLowerCase().includes(q);
      })
    : rows;
  const sorted = sortRows(filtered, sortKey, sortDir);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' || key === 'lastSi' ? 'desc' : 'asc');
    }
  };

  const openDetail = (row: UserRow) => {
    setDetailUser(row);
    setEditTier(row.planCode);
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
      // Update the detail modal with fresh data
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

  const handleResetTrials = async () => {
    if (!detailUser) return;
    setResettingTrials(true);
    try {
      await api.post(`/api/admin/users/${detailUser.id}/reset-trials`);
      await fetchUsers();
      const res = await api.get<{ users: UserRow[] }>('/api/admin/users');
      const updated = res.users.find(u => u.id === detailUser.id);
      if (updated) setDetailUser(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to reset trials');
    } finally {
      setResettingTrials(false);
    }
  };

  const handleImpersonate = async (row: UserRow) => {
    try {
      await startImpersonating(row.id);
      router.replace('/matches');
    } catch (err: any) {
      setError(err.message || 'Failed to impersonate user');
    }
  };

  const headerCell = (label: string, key: SortKey, width: number, title?: string) => (
    <Pressable
      onPress={() => handleSort(key)}
      style={[styles.headerCell, { width }]}
      ref={(ref: any) => { if (Platform.OS === 'web' && ref && title) ref.title = title; }}
    >
      <Text style={styles.headerText}>{label}</Text>
    </Pressable>
  );

  const infoRow = (label: string, value: string | null | undefined) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '--'}</Text>
    </View>
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
        <SearchInput value={search} onChange={setSearch} />
        <Button title="Activity" variant="ghost" onPress={() => router.replace('/admin/activity')} style={styles.backButton} />
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
            {/* Header row */}
            <View style={styles.headerRow}>
              <Pressable
                style={[styles.headerCell, { width: COL_WIDTHS.imp }]}
                ref={(ref: any) => { if (Platform.OS === 'web' && ref) ref.title = 'Impersonate'; }}
              >
                <Text style={styles.headerText}>Be</Text>
              </Pressable>
              {headerCell('Name', 'name', COL_WIDTHS.name)}
              {headerCell('Location', 'location', COL_WIDTHS.location, 'IP defined at account creation')}
              {headerCell('Email', 'email', COL_WIDTHS.email)}
              {headerCell('Adm', 'admin', COL_WIDTHS.admin, 'Administrator')}
              {headerCell('Tier', 'tier', COL_WIDTHS.tier, 'Subscription tier')}
              {headerCell('Created', 'createdAt', COL_WIDTHS.created)}
              {headerCell('Last Si', 'lastSi', COL_WIDTHS.lastSi, 'Last Sign In')}
              {headerCell('Tr', 'tr', COL_WIDTHS.tr, 'Trial searches used')}
              {headerCell('Si', 'si', COL_WIDTHS.si, 'Sign In count')}
              {headerCell('Se', 'se', COL_WIDTHS.se, 'Searches count')}
              {headerCell('Ob', 'ma', COL_WIDTHS.ma, 'Obituaries found count')}
              {headerCell('sd', 'sd', COL_WIDTHS.sd, 'Searches Deleted count')}
              {headerCell('rp', 'rp', COL_WIDTHS.rp, 'Right Person count')}
              {headerCell('wp', 'wp', COL_WIDTHS.wp, 'Wrong Person count')}
              {headerCell('se', 'sedit', COL_WIDTHS.sedit, 'Search Edit count')}
            </View>

            {/* Data rows */}
            <ScrollView
              style={styles.scrollOuter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {sorted.map((row, i) => (
                <View key={row.id} style={[styles.dataRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                  <View style={[styles.cellView, { width: COL_WIDTHS.imp }]}>
                    <Pressable
                      onPress={() => handleImpersonate(row)}
                      ref={(ref: any) => { if (Platform.OS === 'web' && ref) ref.title = `Impersonate ${row.firstName} ${row.lastName}`; }}
                      style={styles.impButton}
                    >
                      <FontAwesome name="sign-in" size={12} color={colors.purple} />
                    </Pressable>
                  </View>
                  <Pressable style={{ width: COL_WIDTHS.name }} onPress={() => openDetail(row)}>
                    <Text style={[styles.cell, styles.nameLink]} numberOfLines={1}>
                      {row.lastName}, {row.firstName}
                    </Text>
                  </Pressable>
                  <Text style={[styles.cell, { width: COL_WIDTHS.location }]} numberOfLines={1}>
                    {row.location}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.email }]} numberOfLines={1}>
                    {row.email}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.admin }]} numberOfLines={1}>
                    {row.isAdmin ? 'Y' : ''}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.tier }]} numberOfLines={1}>
                    {tierLabel(row.planCode)}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.created }]} numberOfLines={1}>
                    {formatDate(row.createdAt)}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.lastSi }]} numberOfLines={1}>
                    {formatDate(row.lastSignIn)}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.tr }]} numberOfLines={1}>
                    {row.trialSearchesUsed}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.si }]} numberOfLines={1}>
                    {row.signInCount}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.se }]} numberOfLines={1}>
                    {row.searchesCount}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.ma }]} numberOfLines={1}>
                    {row.matchesCount}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.sd }]} numberOfLines={1}>
                    {row.searchesDeletedCount}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.rp }]} numberOfLines={1}>
                    {row.rightPersonCount}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.wp }]} numberOfLines={1}>
                    {row.wrongPersonCount}
                  </Text>
                  <Text style={[styles.cell, { width: COL_WIDTHS.sedit }]} numberOfLines={1}>
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
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Trial Searches</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.infoValue}>{detailUser.trialSearchesUsed}</Text>
                  {detailUser.trialSearchesUsed > 0 && (
                    <Pressable onPress={handleResetTrials} style={styles.resetBtn}>
                      <Text style={styles.resetBtnText}>{resettingTrials ? '...' : 'Reset to 0'}</Text>
                    </Pressable>
                  )}
                </View>
              </View>

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
  cellView: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyRow: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: '#444444',
    fontSize: 13,
  },

  // Confirm modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 380,
    width: '100%',
    ...shadows.modal,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  dialogBody: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  dialogBtn: {
    minWidth: 100,
    flexGrow: 1,
  },
  backButton: {
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  impButton: {
    padding: 2,
  },

  // User detail modal
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
  resetBtn: {
    backgroundColor: colors.purple,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
});

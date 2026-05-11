import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { Toast } from '../../src/components/Toast';
import { colors, spacing } from '../../src/theme';

interface StaffMember {
  id: number;
  name: string;
  phoneNumber: string;
  isOnCall: boolean;
}

interface FatalErrorRow {
  id: number;
  source: string;
  errorCode: string | null;
  message: string;
  staffName: string | null;
  smsSent: boolean;
  rateLimited: boolean;
  createdAt: string;
}

type SortKey = 'dateTime' | 'source' | 'error' | 'staff' | 'sms';
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

function sortRows(rows: FatalErrorRow[], sortKey: SortKey, sortDir: SortDir): FatalErrorRow[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'dateTime':
        return a.createdAt.localeCompare(b.createdAt) * dir;
      case 'source':
        return a.source.localeCompare(b.source) * dir;
      case 'error':
        return a.message.localeCompare(b.message) * dir;
      case 'staff':
        return (a.staffName || '').localeCompare(b.staffName || '') * dir;
      case 'sms':
        return (Number(a.smsSent) - Number(b.smsSent)) * dir;
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

const COL_WIDTHS = {
  dateTime: 110,
  source: 80,
  staff: 100,
  sms: 50,
};

export default function OnCallScreen() {
  const defaults = defaultDates();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [errors, setErrors] = useState<FatalErrorRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [toast, setToast] = useState('');

  // Add/edit staff
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get<{ staff: StaffMember[] }>('/api/admin/support-staff');
      setStaff(res.staff);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff');
    }
  }, []);

  const fetchErrors = useCallback(async (sd: string, ed: string) => {
    try {
      const res = await api.get<{ errors: FatalErrorRow[] }>(
        `/api/admin/fatal-errors?startDate=${sd}&endDate=${ed}`
      );
      setErrors(res.errors);
    } catch (err: any) {
      setError(err.message || 'Failed to load fatal errors');
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStaff(), fetchErrors(defaults.start, defaults.end)])
      .finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStaff(), fetchErrors(startDate, endDate)]);
    setRefreshing(false);
  }, [fetchStaff, fetchErrors, startDate, endDate]);

  const handleSetOnCall = async (id: number) => {
    try {
      await api.post(`/api/admin/support-staff/${id}/on-call`);
      await fetchStaff();
      setToast('Support Chief updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormName('');
    setFormPhone('');
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (s: StaffMember) => {
    setEditingId(s.id);
    setFormName(s.name);
    setFormPhone(s.phoneNumber);
    setFormError('');
    setShowForm(true);
  };

  const handleSaveStaff = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('Name is required.'); return; }
    if (!formPhone.trim()) { setFormError('Phone number is required.'); return; }
    setFormLoading(true);
    try {
      if (editingId) {
        await api.patch(`/api/admin/support-staff/${editingId}`, { name: formName.trim(), phoneNumber: formPhone.trim() });
      } else {
        await api.post('/api/admin/support-staff', { name: formName.trim(), phoneNumber: formPhone.trim() });
      }
      setShowForm(false);
      await fetchStaff();
      setToast(editingId ? 'Staff member updated' : 'Staff member added');
    } catch (err: any) {
      setFormError(err.message || 'Failed to save.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/admin/support-staff/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchStaff();
      setToast('Staff member removed');
    } catch (err: any) {
      setDeleteTarget(null);
      setError(err.message);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'dateTime' ? 'desc' : 'asc');
    }
  };

  const sorted = sortRows(errors, sortKey, sortDir);

  const headerCell = (label: string, key: SortKey, width?: number) => (
    <Pressable onPress={() => handleSort(key)} style={[styles.headerCell, width ? { width } : styles.flexCell]}>
      <Text style={styles.headerText}>{label}</Text>
    </Pressable>
  );

  const chief = staff.find(s => s.isOnCall);

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
      <Toast message={toast} visible={!!toast} onDone={() => setToast('')} />

      <View style={styles.toolbar}>
        <Text style={styles.title}>Support Chief on Call</Text>
        <Button title="Back" variant="secondary" onPress={() => router.replace('/settings')} style={styles.backButton} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Staff Roster */}
      <View style={styles.staffSection}>
        <View style={styles.staffHeader}>
          <Text style={styles.sectionTitle}>Staff Roster</Text>
          <Button title="Add Staff" variant="secondary" onPress={openAddForm} style={styles.addButton} />
        </View>

        {staff.map(s => (
          <View key={s.id} style={[styles.staffRow, s.isOnCall && styles.staffRowOnCall]}>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>{s.name}</Text>
              <Text style={styles.staffPhone}>{s.phoneNumber}</Text>
            </View>
            <View style={styles.staffActions}>
              {s.isOnCall ? (
                <Text style={styles.onCallBadge}>On Call</Text>
              ) : (
                <Pressable onPress={() => handleSetOnCall(s.id)}>
                  <Text style={styles.setOnCallLink}>Set On Call</Text>
                </Pressable>
              )}
              <Pressable onPress={() => openEditForm(s)}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
              {!s.isOnCall && (
                <Pressable onPress={() => setDeleteTarget(s)}>
                  <Text style={styles.deleteLink}>Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}

        {staff.length === 0 && (
          <Text style={styles.emptyText}>No staff members.  Add someone to receive fatal error alerts.</Text>
        )}
      </View>

      {/* Add/Edit Form Dialog */}
      <ConfirmDialog
        visible={showForm}
        title={editingId ? 'Edit Staff Member' : 'Add Staff Member'}
        body={
          <View>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <TextField
              label="Name"
              labelWidth={70}
              value={formName}
              onChangeText={setFormName}
              autoCapitalize="words"
            />
            <TextField
              label="Phone"
              labelWidth={70}
              value={formPhone}
              onChangeText={(v) => setFormPhone(v.replace(/[^0-9+\-() ]/g, ''))}
              keyboardType="phone-pad"
              placeholder="e.g. (904) 477-0311"
            />
          </View>
        }
        confirmLabel={formLoading ? 'Saving...' : 'Save'}
        onConfirm={handleSaveStaff}
        onCancel={() => setShowForm(false)}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Remove staff member"
        body={`Are you sure you want to remove ${deleteTarget?.name}?`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={handleDeleteStaff}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Fatal Error Log */}
      <View style={styles.errorLogSection}>
        <View style={styles.errorLogToolbar}>
          <Text style={styles.sectionTitle}>Fatal Errors</Text>
          <DateInput value={startDate} onChange={setStartDate} />
          <DateInput value={endDate} onChange={setEndDate} />
          <Pressable onPress={() => fetchErrors(startDate, endDate)} style={styles.goButton}>
            <Text style={styles.goButtonText}>Go</Text>
          </Pressable>
          <Text style={styles.countText}>{errors.length} error{errors.length !== 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.tableContainer}>
          <ScrollView horizontal style={styles.scrollHorizontal} contentContainerStyle={styles.scrollHorizontalContent}>
            <View>
              <View style={styles.headerRow}>
                {headerCell('Date/Time', 'dateTime', COL_WIDTHS.dateTime)}
                {headerCell('Source', 'source', COL_WIDTHS.source)}
                {headerCell('Error', 'error')}
                {headerCell('Chief', 'staff', COL_WIDTHS.staff)}
                {headerCell('SMS', 'sms', COL_WIDTHS.sms)}
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
                    <Text style={[styles.cell, { width: COL_WIDTHS.source }]} numberOfLines={1}>
                      {row.source}{row.errorCode ? ` ${row.errorCode}` : ''}
                    </Text>
                    <Text style={[styles.cell, styles.flexCell]} numberOfLines={2}>
                      {row.message}
                    </Text>
                    <Text style={[styles.cell, { width: COL_WIDTHS.staff }]} numberOfLines={1}>
                      {row.staffName || '-'}
                    </Text>
                    <Text style={[styles.cell, { width: COL_WIDTHS.sms, textAlign: 'center' }]} numberOfLines={1}>
                      {row.rateLimited ? 'RL' : row.smsSent ? 'Yes' : 'No'}
                    </Text>
                  </View>
                ))}

                {sorted.length === 0 && (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyText}>No fatal errors in the selected date range.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
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
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },

  // Staff section
  staffSection: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#444444',
  },
  addButton: {
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 6,
    marginBottom: 4,
  },
  staffRowOnCall: {
    backgroundColor: '#F0FFF0',
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
    ...gridFont,
  },
  staffPhone: {
    fontSize: 13,
    color: '#444444',
    ...gridFont,
  },
  staffActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  onCallBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.green,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    ...gridFont,
  },
  setOnCallLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.purple,
    ...gridFont,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.green,
    ...gridFont,
  },
  deleteLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
    ...gridFont,
  },
  formError: {
    fontSize: 13,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },

  // Error log section
  errorLogSection: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  errorLogToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
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

  // Table
  tableContainer: {
    flex: 1,
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

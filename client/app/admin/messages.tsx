import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Toast } from '../../src/components/Toast';
import { colors, spacing, borderRadius } from '../../src/theme';

interface MessageRow {
  id: string;
  loginId: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  body: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  ticketId: string;
}

type SortKey = 'status' | 'createdAt' | 'name' | 'email' | 'subject';
type SortDir = 'asc' | 'desc';

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

function sortRows(rows: MessageRow[], sortKey: SortKey, sortDir: SortDir): MessageRow[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'status':
        return a.status.localeCompare(b.status) * dir;
      case 'createdAt':
        return a.createdAt.localeCompare(b.createdAt) * dir;
      case 'name': {
        const last = a.lastName.localeCompare(b.lastName) * dir;
        if (last !== 0) return last;
        return a.firstName.localeCompare(b.firstName) * dir;
      }
      case 'email':
        return a.email.localeCompare(b.email) * dir;
      case 'subject':
        return a.subject.localeCompare(b.subject) * dir;
    }
  });
}

const COL_WIDTHS = {
  status: 55,
  ticket: 75,
  createdAt: 72,
  name: 100,
  email: 150,
};

export default function MessagesScreen() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [toast, setToast] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      setError('');
      const res = await api.get<{ messages: MessageRow[] }>('/api/admin/messages');
      setRows(res.messages);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    }
  }, []);

  useEffect(() => {
    fetchMessages().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  }, [fetchMessages]);

  const handleExpand = async (row: MessageRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      setReplyText('');
      return;
    }
    setExpandedId(row.id);
    setReplyText('');
    if (row.status === 'unread') {
      try {
        await api.patch(`/api/admin/messages/${row.id}/read`);
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'read' } : r));
      } catch {}
    }
  };

  const handleReply = async (messageId: string) => {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      await api.post(`/api/admin/messages/${messageId}/reply`, { replyText: replyText.trim() });
      setRows(prev => prev.map(r => r.id === messageId ? { ...r, status: 'replied', adminReply: replyText.trim(), repliedAt: new Date().toISOString() } : r));
      setReplyText('');
      setToast('Reply sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const awaitingCount = rows.filter(r => r.status !== 'replied').length;
  const sorted = sortRows(rows, sortKey, sortDir);

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
      <Toast message={toast} visible={!!toast} onDone={() => setToast('')} />
      <View style={styles.toolbar}>
        <Text style={styles.title}>Messages</Text>
        <Button title="Back" variant="ghost" onPress={() => router.replace('/settings')} style={styles.backButton} />
      </View>

      {awaitingCount > 0 && (
        <View style={styles.awaitingBanner}>
          <Text style={styles.awaitingText}>{awaitingCount} {awaitingCount === 1 ? 'message' : 'messages'} awaiting response</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.tableContainer}>
        <ScrollView horizontal style={styles.scrollHorizontal}>
          <View>
            <View style={styles.headerRow}>
              {headerCell('Status', 'status', COL_WIDTHS.status)}
              <View style={[styles.headerCell, { width: COL_WIDTHS.ticket }]}>
                <Text style={styles.headerText}>Ticket</Text>
              </View>
              {headerCell('Date', 'createdAt', COL_WIDTHS.createdAt)}
              {headerCell('Name', 'name', COL_WIDTHS.name)}
              {headerCell('Email', 'email', COL_WIDTHS.email)}
              <Pressable onPress={() => handleSort('subject')} style={[styles.headerCell, styles.flexCell]}>
                <Text style={styles.headerText}>Subject</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollOuter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {sorted.map((row, i) => (
                <View key={row.id}>
                  <Pressable onPress={() => handleExpand(row)}>
                    <View style={[styles.dataRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd, row.status !== 'replied' && styles.rowNeedsResponse]}>
                      <Text style={[styles.cell, { width: COL_WIDTHS.status }, row.status === 'unread' && styles.boldCell]} numberOfLines={1}>{row.status}</Text>
                      <Text style={[styles.cell, { width: COL_WIDTHS.ticket }]} numberOfLines={1}>#{row.ticketId}</Text>
                      <Text style={[styles.cell, { width: COL_WIDTHS.createdAt }]} numberOfLines={1}>{formatDateTime(row.createdAt)}</Text>
                      <Text style={[styles.cell, { width: COL_WIDTHS.name }]} numberOfLines={1}>{row.firstName} {row.lastName}</Text>
                      <Text style={[styles.cell, { width: COL_WIDTHS.email }]} numberOfLines={1}>{row.email}</Text>
                      <Text style={[styles.cell, styles.flexCell]} numberOfLines={1}>{row.subject || '(no subject)'}</Text>
                    </View>
                  </Pressable>

                  {expandedId === row.id && (
                    <View style={styles.expandedPanel}>
                      <Text style={styles.expandedLabel}>Message:</Text>
                      <Text style={styles.expandedBody}>{row.body}</Text>

                      {row.status === 'replied' && row.adminReply ? (
                        <View style={styles.replyBlock}>
                          <Text style={styles.expandedLabel}>Reply:</Text>
                          <Text style={styles.expandedBody}>{row.adminReply}</Text>
                          <Text style={styles.replyTimestamp}>{formatDateTime(row.repliedAt || '')}</Text>
                        </View>
                      ) : (
                        <View style={styles.replyForm}>
                          <TextInput
                            style={styles.replyInput}
                            value={replyText}
                            onChangeText={setReplyText}
                            multiline
                            textAlignVertical="top"
                            placeholder="Type your reply..."
                            placeholderTextColor={colors.textMuted}
                          />
                          <Button
                            title="Send Reply"
                            onPress={() => handleReply(row.id)}
                            disabled={!replyText.trim()}
                            loading={replyLoading}
                            style={styles.replyButton}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}

              {sorted.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No messages.</Text>
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
  boldCell: {
    fontWeight: '700',
  },
  flexCell: {
    flex: 1,
    minWidth: 120,
  },
  expandedPanel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#f0ecf5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#444444',
    marginBottom: 4,
  },
  expandedBody: {
    fontSize: 13,
    color: '#444444',
    lineHeight: 20,
  },
  replyBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  replyTimestamp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  replyForm: {
    marginTop: spacing.sm,
  },
  replyInput: {
    minHeight: 80,
    fontSize: 14,
    color: '#444444',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  replyButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  awaitingBanner: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  awaitingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  rowNeedsResponse: {
    backgroundColor: '#FFF8E1',
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

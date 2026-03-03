import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { AppHeader } from '../../../src/components/AppHeader';
import { MatchCard } from '../../../src/components/MatchCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { Button } from '../../../src/components/Button';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { Card } from '../../../src/components/Card';
import { colors, fontSize, spacing } from '../../../src/theme';
import type { MatchResult, SearchQuery } from '../../../src/types';

export default function SearchMatchesScreen() {
  const { searchId } = useLocalSearchParams<{ searchId: string }>();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteResultId, setDeleteResultId] = useState<string | null>(null);
  const [rightPersonId, setRightPersonId] = useState<string | null>(null);
  const [wrongPersonId, setWrongPersonId] = useState<string | null>(null);

  const activeResults = useMemo(() => results.filter(r => r.status !== 'rejected'), [results]);
  const dismissedResults = useMemo(() => results.filter(r => r.status === 'rejected'), [results]);

  const loadResults = useCallback(async () => {
    try {
      const [matchRes, searchRes] = await Promise.all([
        api.get<{ results: MatchResult[] }>(`/api/matches/${searchId}`),
        api.get<{ search: SearchQuery }>(`/api/searches/${searchId}`),
      ]);
      setResults(matchRes.results);
      setSearch(searchRes.search);

      // Mark all as read
      api.post(`/api/matches/${searchId}/mark-read`).catch(() => {});

      // Auto-skip to detail if exactly 1 active result
      const active = matchRes.results.filter(r => r.status !== 'rejected');
      if (active.length === 1) {
        router.replace(`/matches/${searchId}/${active[0].id}` as any);
        return;
      }
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchId]);

  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [loadResults])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadResults();
  }, [loadResults]);

  const handleDelete = useCallback(async () => {
    setDeleteConfirm(false);
    try {
      await api.delete(`/api/searches/${searchId}`);
      router.replace('/matches');
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [searchId]);

  const handleRestore = useCallback(async (resultId: string) => {
    setRestoringId(resultId);
    try {
      await api.post(`/api/matches/${searchId}/${resultId}/restore`);
      // Optimistically update local state
      setResults(prev => prev.map(r =>
        r.id === resultId ? { ...r, status: 'pending' as const } : r
      ));
    } catch (err) {
      console.error('Failed to restore result:', err);
    } finally {
      setRestoringId(null);
    }
  }, [searchId]);

  const handleDeleteResult = useCallback(async () => {
    if (!deleteResultId) return;
    const id = deleteResultId;
    setDeleteResultId(null);
    try {
      await api.delete(`/api/matches/${searchId}/${id}`);
      setResults(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete result:', err);
    }
  }, [searchId, deleteResultId]);

  const handleRightPerson = useCallback(async () => {
    if (!rightPersonId) return;
    const id = rightPersonId;
    setRightPersonId(null);
    try {
      await api.post(`/api/matches/${searchId}/${id}/confirm`);
      router.replace('/matches');
    } catch (err) {
      console.error('Failed to confirm:', err);
    }
  }, [searchId, rightPersonId]);

  const handleWrongPerson = useCallback(async () => {
    if (!wrongPersonId) return;
    const id = wrongPersonId;
    setWrongPersonId(null);
    try {
      await api.post(`/api/matches/${searchId}/${id}/reject`);
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'rejected' as const } : r
      ));
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  }, [searchId, wrongPersonId]);

  if (loading) {
    return <LoadingOverlay visible message="Loading results..." />;
  }

  if (results.length === 0) {
    const displayName = search ? [search.nameFirst, search.nameLast].filter(Boolean).join(' ') : '';
    const details: { label: string; value: string }[] = [];
    if (search?.nameNickname) details.push({ label: 'Nickname', value: search.nameNickname });
    if (search?.nameMiddle) details.push({ label: 'Middle', value: search.nameMiddle });
    if (search?.ageApx) details.push({ label: 'Age', value: `around ${search.ageApx}` });
    if (search?.city) details.push({ label: 'City', value: search.city });
    if (search?.state) details.push({ label: 'State', value: search.state });
    if (search?.keyWords) details.push({ label: 'Keywords', value: search.keyWords });

    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.emptyContent}>
          <Card>
            <Text style={styles.emptyTitle}>No matches found for {displayName}</Text>
            {details.length > 0 && (
              <View style={styles.detailsList}>
                {details.map((d, i) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{d.label}</Text>
                    <Text style={styles.detailValue}>{d.value}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.emptySubtitle}>We'll keep searching.  You'll be notified when new matches are found.</Text>
          </Card>
          <View style={styles.emptyButtons}>
            <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.emptyButton} />
            <Button title="Edit Search" variant="secondary" onPress={() => router.push(`/search/${searchId}`)} style={styles.emptyButton} />
            <Button title="Delete" variant="danger" onPress={() => setDeleteConfirm(true)} style={styles.emptyButton} />
          </View>
        </View>
        <ConfirmDialog
          visible={deleteConfirm}
          title="Delete Search"
          body={`Are you sure you want to delete ${displayName}? This will stop monitoring for this person.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <FlatList
        data={activeResults}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{activeResults.length === 1 ? '1 Obituary' : `${activeResults.length} Obituaries`} found</Text>
            {search && (
              <Text style={styles.searchReminder}>
                {[search.nameFirst, search.nameLast].filter(Boolean).join(' ')}
                {search.city || search.state ? ` - ${[search.city, search.state].filter(Boolean).join(', ')}` : ''}
                {search.ageApx ? `, age around ${search.ageApx}` : ''}
              </Text>
            )}
            <View style={styles.headerButtons}>
              <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.headerButton} />
              <Button title="Home" variant="secondary" onPress={() => router.replace('/matches')} style={styles.headerButton} />
            </View>
            {activeResults.length > 0 && (
              <Text style={styles.headerHint}>Please choose Right or Wrong Person.</Text>
            )}
            {activeResults.length === 0 && (
              <Text style={styles.noResultsText}>No obituaries found today, but we'll search again tomorrow.</Text>
            )}
          </View>
        }
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        renderItem={({ item }) => (
          <MatchCard
            result={item}
            href={`/matches/${searchId}/${item.id}`}
            onMoreInfo={() => router.push(`/matches/${searchId}/${item.id}` as any)}
            onRight={() => setRightPersonId(item.id)}
            onWrong={() => setWrongPersonId(item.id)}
          />
        )}
        ListFooterComponent={dismissedResults.length > 0 ? (
          <View style={styles.dismissedSection}>
            <Text style={styles.dismissedHeader}>Dismissed Results</Text>
            <Text style={styles.dismissedSubtext}>
              These were marked "Wrong Person."  Tap Restore to bring one back.  Dismissed results are removed after seven days.
            </Text>
            {dismissedResults.map(item => (
              <MatchCard
                key={item.id}
                result={item}
                dismissed
                onRestore={() => handleRestore(item.id)}
              />
            ))}
          </View>
        ) : null}
      />
      <ConfirmDialog
        visible={!!deleteResultId}
        title="Delete Obituary"
        body={`Delete this obituary result for ${(() => { const r = results.find(r => r.id === deleteResultId); return r?.nameFull || [r?.nameFirst, r?.nameLast].filter(Boolean).join(' ') || 'this person'; })()}?  This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteResult}
        onCancel={() => setDeleteResultId(null)}
      />
      <ConfirmDialog
        visible={!!rightPersonId}
        title="Confirm: Right Person"
        body={`Confirm this is the right person?  Searching for ${(() => { const r = results.find(r => r.id === rightPersonId); return r?.nameFull || [r?.nameFirst, r?.nameLast].filter(Boolean).join(' ') || 'this person'; })()} will stop.`}
        confirmLabel="Yes, This Is Them"
        confirmVariant="primary"
        onConfirm={handleRightPerson}
        onCancel={() => setRightPersonId(null)}
      />
      <ConfirmDialog
        visible={!!wrongPersonId}
        title="Wrong Person"
        body="Mark as wrong person?  Result will be hidden, but you can undo later."
        confirmLabel="Yes, Wrong Person"
        confirmVariant="danger"
        onConfirm={handleWrongPerson}
        onCancel={() => setWrongPersonId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  list: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  searchReminder: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    alignSelf: 'flex-start',
  },
  noResultsText: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: spacing.md,
    lineHeight: 26,
  },
  headerHint: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
    marginTop: spacing.sm,
  },
  dismissedSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  dismissedHeader: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  dismissedSubtext: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginBottom: spacing.md,
  },
  emptyContent: {
    padding: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  detailsList: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    width: 90,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emptyButton: {
    alignSelf: 'flex-start',
  },
});

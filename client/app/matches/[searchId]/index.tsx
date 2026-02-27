import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

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
            <Text style={styles.title}>Obit Matches</Text>
            <View style={styles.headerButtons}>
              <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.headerButton} />
              <Button title="Home" variant="secondary" onPress={() => router.replace('/matches')} style={styles.headerButton} />
              <Text style={styles.headerHint}>Tap name to open.</Text>
            </View>
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
          />
        )}
        ListFooterComponent={dismissedResults.length > 0 ? (
          <View style={styles.dismissedSection}>
            <Text style={styles.dismissedHeader}>Dismissed Results</Text>
            <Text style={styles.dismissedSubtext}>
              These results were marked "Wrong Person." Tap Restore to bring one back.
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
    marginBottom: spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    alignSelf: 'flex-start',
  },
  headerHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    alignSelf: 'center',
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
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dismissedSubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
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

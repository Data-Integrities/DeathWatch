import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { AppHeader } from '../../../src/components/AppHeader';
import { MatchCard } from '../../../src/components/MatchCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { Button } from '../../../src/components/Button';
import { colors, fontSize, spacing } from '../../../src/theme';
import type { MatchResult, SearchQuery } from '../../../src/types';

export default function SearchMatchesScreen() {
  const { searchId } = useLocalSearchParams<{ searchId: string }>();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
    const details: string[] = [];
    if (search?.nameNickname) details.push(`Nickname: ${search.nameNickname}`);
    if (search?.nameMiddle) details.push(`Middle: ${search.nameMiddle}`);
    if (search?.ageApx) details.push(`Age: ${search.ageApx}`);
    if (search?.city) details.push(`City: ${search.city}`);
    if (search?.state) details.push(`State: ${search.state}`);
    if (search?.keyWords) details.push(`Keywords: ${search.keyWords}`);

    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.emptyContent}>
          <Text style={styles.emptyTitle}>No matches found for {displayName}</Text>
          {details.length > 0 && (
            <View style={styles.detailsList}>
              {details.map((d, i) => (
                <Text key={i} style={styles.detailItem}>{d}</Text>
              ))}
            </View>
          )}
          <Text style={styles.emptySubtitle}>We'll keep searching. You'll be notified when new matches are found.</Text>
          <View style={styles.emptyButtons}>
            <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.emptyButton} />
            <Button title="Edit Search" variant="secondary" onPress={() => router.push(`/search/${searchId}`)} style={styles.emptyButton} />
          </View>
        </View>
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
    backgroundColor: '#f8faf9',
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
  detailItem: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyButton: {
    alignSelf: 'flex-start',
  },
});

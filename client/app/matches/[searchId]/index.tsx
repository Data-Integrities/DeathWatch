import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { MatchCard } from '../../../src/components/MatchCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { Button } from '../../../src/components/Button';
import { colors, fontSize, spacing } from '../../../src/theme';
import type { MatchResult } from '../../../src/types';

export default function SearchMatchesScreen() {
  const { searchId } = useLocalSearchParams<{ searchId: string }>();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const activeResults = useMemo(() => results.filter(r => r.status !== 'rejected'), [results]);
  const dismissedResults = useMemo(() => results.filter(r => r.status === 'rejected'), [results]);

  const loadResults = useCallback(async () => {
    try {
      const res = await api.get<{ results: MatchResult[] }>(`/api/matches/${searchId}`);
      setResults(res.results);

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
    return (
      <View style={styles.container}>
        <EmptyState
          title="No matches found"
          subtitle="We'll keep searching. You'll be notified when new matches are found."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activeResults}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        ListHeaderComponent={
          <View style={styles.headerButtons}>
            <Button
              title="Home"
              variant="ghost"
              onPress={() => router.replace('/matches')}
              style={styles.headerButton}
            />
            <Button
              title="Back"
              variant="ghost"
              onPress={() => router.back()}
              style={styles.headerButton}
            />
          </View>
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
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerButtons: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerButton: {
    // no extra styling needed
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
});

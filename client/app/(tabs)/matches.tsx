import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, RefreshControl, Pressable, Modal } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/services/api/client';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import type { MatchSummary, SearchQuery } from '../../src/types';

export default function HomeScreen() {
  const [summaries, setSummaries] = useState<MatchSummary[]>([]);
  const [searches, setSearches] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [matchRes, searchRes] = await Promise.all([
        api.get<{ summaries: MatchSummary[] }>('/api/matches'),
        api.get<{ searches: SearchQuery[] }>('/api/searches'),
      ]);
      setSummaries(matchRes.summaries);
      setSearches(searchRes.searches);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  const hasSearches = searches.length > 0;
  const matchesWithResults = summaries.filter(s => s.matchCntTotal > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
      >
        {/* Intro card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is an obituary notification service.
          </Text>
          <Text style={styles.welcomeText}>
            Add a person to <Text style={styles.boldText}>Searches</Text>, and <Text style={styles.brandText}>ObitNOTE</Text> will <Pressable onPress={() => setDisclaimerVisible(true)} onHoverIn={() => setDisclaimerVisible(true)} accessibilityRole="button" accessibilityLabel="Disclaimer" style={styles.disclaimerLinkWrap}><Text style={styles.disclaimerLink}>alert you later</Text></Pressable> if an obituary for that person is published.
          </Text>
          <Text style={styles.welcomeText}>
            <Text style={styles.brandText}>ObitNOTE</Text> is not for finding old obituaries. For older obituaries, you can use Google.
          </Text>
          <Text style={styles.welcomeText}>
            To begin, click <Text style={styles.boldText}>New Search</Text>.
          </Text>
        </View>

        {/* New Search button */}
        <Button
          title="New Search"
          onPress={() => router.push('/search/new')}
          style={styles.newSearchButton}
        />

        {/* Matches section */}
        {matchesWithResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Matches <Text style={styles.sectionSubtitle}>Searches found</Text></Text>
            {matchesWithResults.map(item => {
              const displayName = [item.nameFirst, item.nameLast].filter(Boolean).join(' ');
              return (
                <Pressable
                  key={item.userQueryId}
                  onPress={() => router.push(`/matches/${item.userQueryId}` as any)}
                  accessibilityRole="link"
                  accessibilityLabel={`${displayName}: ${item.matchCntTotal} matches`}
                  style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
                >
                  <Text style={styles.listName}>{displayName}</Text>
                  <Text style={styles.matchCount}>
                    {item.matchCntTotal} match{item.matchCntTotal !== 1 ? 'es' : ''}
                  </Text>
                  {item.matchCntNew > 0 && <Badge count={item.matchCntNew} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Searches section */}
        {hasSearches && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Searches <Text style={styles.sectionSubtitle}>Obits you're looking for</Text></Text>
            {searches.map(item => {
              const displayName = [item.nameFirst, item.nameLast].filter(Boolean).join(' ');
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/matches/${item.id}` as any)}
                  accessibilityRole="link"
                  accessibilityLabel={displayName}
                  style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
                >
                  <Text style={styles.listName}>{displayName}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Disclaimer modal */}
      <Modal visible={disclaimerVisible} transparent animationType="fade" onRequestClose={() => setDisclaimerVisible(false)}>
        <Pressable style={styles.disclaimerOverlay} onPress={() => setDisclaimerVisible(false)}>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerText}>
              <Text style={styles.brandText}>ObitNOTE</Text> will check your list every day for new obituaries in the <Text style={styles.boldText}>United States</Text>, <Text style={styles.boldText}>Canada</Text>, and <Text style={styles.boldText}>Mexico</Text>.
            </Text>
            <Text style={styles.disclaimerText}>
              We are very accurate, but two things can still happen:
            </Text>
            <Text style={styles.disclaimerText}>
              We might <Text style={styles.boldText}>miss an obituary</Text> sometimes.
            </Text>
            <Text style={styles.disclaimerText}>
              We will try to <Text style={styles.boldText}>email you</Text>, but the email might not reach you (for example, it could be blocked or filtered).
            </Text>
            <Button title="Close" variant="secondary" onPress={() => setDisclaimerVisible(false)} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf9',
  },
  scrollContent: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  welcomeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  welcomeText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  boldText: {
    fontWeight: '700',
  },
  brandText: {
    fontWeight: '700',
    color: colors.brand,
  },
  disclaimerLinkWrap: {
    display: 'inline' as any,
  },
  disclaimerLink: {
    fontWeight: '700',
    color: colors.green,
    fontSize: fontSize.base,
    lineHeight: 26,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  listName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  matchCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.9,
  },
  newSearchButton: {
    marginTop: spacing.lg,
  },
  disclaimerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  disclaimerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 400,
    width: '100%',
    ...shadows.modal,
  },
  disclaimerText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: spacing.md,
  },
});

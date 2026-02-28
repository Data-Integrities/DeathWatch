import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Text, StyleSheet, RefreshControl, Pressable, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Checkbox } from '../../src/components/Checkbox';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import type { MatchSummary, SearchQuery } from '../../src/types';

const TLD_TO_COUNTRY: Record<string, string> = {
  us: 'the US',
  ca: 'Canada',
  uk: 'the UK',
  au: 'Australia',
  nz: 'New Zealand',
};

const DEFAULT_COUNTRIES = ['the US', 'Canada', 'the UK', 'Australia', 'New Zealand'];

function getCountryList(email?: string): string[] {
  const countries = [...DEFAULT_COUNTRIES];
  if (!email) return countries;
  const tld = email.split('@')[1]?.split('.').pop()?.toLowerCase() || '';
  const userCountry = TLD_TO_COUNTRY[tld];
  if (userCountry) {
    const idx = countries.indexOf(userCountry);
    if (idx > 0) {
      countries.splice(idx, 1);
      countries.unshift(userCountry);
    }
  }
  return countries;
}

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const [summaries, setSummaries] = useState<MatchSummary[]>([]);
  const [searches, setSearches] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);
  const [skipConfirmVisible, setSkipConfirmVisible] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteQueryId, setDeleteQueryId] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDeleteResults = useCallback(async () => {
    if (!deleteQueryId) return;
    const id = deleteQueryId;
    setDeleteQueryId(null);
    try {
      await api.delete(`/api/matches/${id}`);
      setSummaries(prev => prev.filter(s => s.userQueryId !== id));
    } catch (err) {
      console.error('Failed to delete results:', err);
    }
  }, [deleteQueryId]);

  if (loading) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  const hasSearches = searches.length > 0;
  const countries = getCountryList(user?.email);
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
        {!user?.skipMatchesInfoCard && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeText}>
              <Text style={styles.brandText}>ObitNOTE</Text> is an <Text style={styles.boldText}>obituary notification service</Text>.
            </Text>
            <Text style={styles.welcomeText}>
              <Text style={styles.boldText}>Add a person</Text> to <Text style={styles.boldText}>New Search</Text>, and <Text style={styles.brandText}>ObitNOTE</Text> will <Pressable onPress={() => setDisclaimerVisible(true)} onHoverIn={() => { hoverTimer.current = setTimeout(() => setDisclaimerVisible(true), 100); }} onHoverOut={() => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } }} accessibilityRole="button" accessibilityLabel="Disclaimer" style={styles.disclaimerLinkWrap}><Text style={styles.disclaimerLink}>alert you</Text></Pressable> later when an obituary for that person is published in {countries.map((country, i) => (<React.Fragment key={country}>{i > 0 && i < countries.length - 1 && ', '}{i === countries.length - 1 && ', and '}{country}</React.Fragment>))}.
            </Text>
            <Text style={styles.welcomeText}>
              <Text style={styles.brandText}>ObitNOTE</Text> is <Text style={styles.boldText}>not for finding old obituaries</Text>.  For older obituaries, you can use Google.
            </Text>
            <Text style={styles.welcomeText}>
              To begin, click <Text style={styles.boldText}>New Search</Text>.
            </Text>
            <View style={styles.skipCheckboxRow}>
              <Checkbox
                checked={false}
                onToggle={() => setSkipConfirmVisible(true)}
                label="Skip this info in the future."
              />
            </View>
          </View>
        )}

        {/* New Search button */}
        <Button
          title="New Search"
          onPress={() => router.push('/search/new')}
          style={styles.newSearchButton}
        />

        {/* Matches section */}
        {matchesWithResults.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Obituaries found  <Text style={styles.sectionSubtitle}>Tap name to view</Text></Text>
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
                  <FontAwesome name="check" size={16} color={colors.green} />
                  <Text style={styles.listName}>{displayName}</Text>
                  <Text style={styles.matchCount}>
                    {item.matchCntTotal} found
                  </Text>
                  {item.matchCntNew > 0 && <Badge count={item.matchCntNew} />}
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); setDeleteQueryId(item.userQueryId); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete results for ${displayName}`}
                    style={styles.deleteIcon}
                  >
                    <FontAwesome name="trash" size={24} color={colors.error} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ) : hasSearches ? (
          <Text style={styles.noMatchesText}>No obituaries currently.</Text>
        ) : null}

        {/* View Searches button */}
        {hasSearches && (
          <Button
            title="View Searches"
            onPress={() => router.push('/searches' as any)}
            variant="primary"
            style={styles.viewSearchesButton}
          />
        )}

      </ScrollView>

      <ConfirmDialog
        visible={skipConfirmVisible}
        title="Info Card Hidden"
        body="You can bring this info back in Settings."
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={async () => {
          setSkipConfirmVisible(false);
          try {
            await api.patch('/api/auth/preferences', { skipMatchesInfoCard: true });
            await refreshUser();
          } catch (err) {
            console.error('Failed to update preference:', err);
          }
        }}
        onCancel={() => setSkipConfirmVisible(false)}
      />

      <ConfirmDialog
        visible={!!deleteQueryId}
        title="Delete Obituaries"
        body="Are you sure you want to delete all obituary results for this person?  This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteResults}
        onCancel={() => setDeleteQueryId(null)}
      />

      {/* Disclaimer modal */}
      <Modal visible={disclaimerVisible} transparent animationType="fade" onRequestClose={() => setDisclaimerVisible(false)}>
        <Pressable style={styles.disclaimerOverlay} onPress={() => setDisclaimerVisible(false)}>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerText}>
              <Text style={styles.brandText}>ObitNOTE</Text> will check your list every day for new obituaries.
            </Text>
            <Text style={styles.disclaimerText}>
              We are accurate, but two things can still happen:
            </Text>
            <Text style={styles.disclaimerText}>
              We might <Text style={styles.boldText}>miss an obituary</Text> sometimes.
            </Text>
            <Text style={styles.disclaimerText}>
              We will try to email you, but the <Text style={styles.boldText}>email might not reach you</Text> (for example, it could be blocked, filtered, or in spam).
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
    backgroundColor: '#f5f0fa',
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
  skipCheckboxRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs - 1,
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
    color: '#444444',
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
  },
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 7,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  listName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.green,
    flex: 1,
  },
  matchCount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#444444',
  },
  deleteIcon: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -5,
    marginLeft: -5,
  },
  noMatchesText: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: spacing.md,
  },
  viewSearchesButton: {
    marginTop: spacing.md,
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

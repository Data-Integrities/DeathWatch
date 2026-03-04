import React, { useState, useCallback, useRef } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl, Pressable, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { Button } from '../../src/components/Button';
import { Checkbox } from '../../src/components/Checkbox';
import { SearchCard } from '../../src/components/SearchCard';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';
import type { SearchQuery } from '../../src/types';

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

function searchGroup(s: SearchQuery): number {
  // 1. Has obituary results (not confirmed)
  if (!s.confirmed && s.matchCntTotal > 0) return 0;
  // 2. No results yet (Performing daily searches...)
  if (!s.confirmed) return 1;
  // 3. Confirmed (Right Person)
  return 2;
}

function alphaCompare(a: SearchQuery, b: SearchQuery): number {
  const lastCmp = (a.nameLast || '').localeCompare(b.nameLast || '');
  if (lastCmp !== 0) return lastCmp;
  return (a.nameFirst || '').localeCompare(b.nameFirst || '');
}

function sortSearches(searches: SearchQuery[]): SearchQuery[] {
  return [...searches].sort((a, b) => {
    const groupDiff = searchGroup(a) - searchGroup(b);
    if (groupDiff !== 0) return groupDiff;
    return alphaCompare(a, b);
  });
}

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const [searches, setSearches] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);
  const [skipConfirmVisible, setSkipConfirmVisible] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<{ searches: SearchQuery[] }>('/api/searches');
      setSearches(sortSearches(res.searches));
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

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await api.delete(`/api/searches/${id}`);
      setSearches(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [deleteTarget]);

  if (loading) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  const hasSearches = searches.length > 0;
  const countries = getCountryList(user?.email);

  const renderHeader = () => (
    <View>
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
      <View style={styles.topButtons}>
        <Button
          title="New Search"
          onPress={() => router.push('/search/new')}
        />
      </View>

      {/* Section title */}
      {hasSearches && (
        <Text style={styles.sectionTitle}>{(() => { const cnt = searches.filter(s => !s.confirmed).length; return cnt === 1 ? '1 Person' : `${cnt} People`; })()} being monitored{'\n'}<Text style={styles.sectionSubtitle}>Tap to open</Text></Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={searches}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.noSearchesText}>No people being monitored yet.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const displayName = [item.nameFirst, item.nameLast].filter(Boolean).join(' ');
          return (
            <SearchCard
              search={item}
              onPress={() => router.push(`/matches/${item.id}` as any)}
              onEdit={!item.confirmed ? () => router.push(`/search/${item.id}`) : undefined}
              onDelete={() => setDeleteTarget({ id: item.id, name: displayName })}
            />
          );
        }}
      />

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
        visible={!!deleteTarget}
        title="Delete Search"
        body={`Delete ${deleteTarget?.name}?  This will stop monitoring for this person.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Disclaimer modal */}
      <Modal visible={disclaimerVisible} transparent animationType="fade" onRequestClose={() => setDisclaimerVisible(false)}>
        <View style={styles.disclaimerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDisclaimerVisible(false)} />
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
        </View>
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
  topButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg - 12,
    marginBottom: spacing.lg,
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
  noSearchesText: {
    fontSize: fontSize.base,
    color: '#444444',
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

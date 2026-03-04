import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Linking, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { AppHeader } from '../../../src/components/AppHeader';
import { Button } from '../../../src/components/Button';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../../src/theme';
import type { MatchResult, SearchQuery } from '../../../src/types';

const MAIN_WIDTH = 600;

function formatDomain(domain: string): string {
  if (!domain) return 'the source website';
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export default function MoreInfoScreen() {
  const { searchId, resultId } = useLocalSearchParams<{ searchId: string; resultId: string }>();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [search, setSearch] = useState<SearchQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [searchId, resultId]);

  const loadData = async () => {
    try {
      const [matchRes, searchRes] = await Promise.all([
        api.get<{ result: MatchResult }>(`/api/matches/${searchId}/${resultId}`),
        api.get<{ search: SearchQuery }>(`/api/searches/${searchId}`),
      ]);
      setResult(matchRes.result);
      setSearch(searchRes.search);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  const openDomain = () => {
    if (!result?.sourceDomain) return;
    const url = `https://${result.sourceDomain}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
  };

  if (loading) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  if (!result) {
    return (
      <View style={styles.outer}>
        <AppHeader />
        <View style={styles.scrollContent}>
          <Text style={styles.messageText}>{error || 'Result not found.'}</Text>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const domainLabel = formatDomain(result.sourceDomain);

  // Build user's search description from their own input
  const searchNameParts = [search?.nameFirst, search?.nameMiddle, search?.nameLast].filter(Boolean);
  const searchName = searchNameParts.length > 0 ? searchNameParts.join(' ') : 'Unknown';
  const nicknameDisplay = search?.nameNickname ? ` "${search.nameNickname}"` : '';
  const fullDisplayName = search?.nameFirst
    ? `${search.nameFirst}${search.nameMiddle ? ' ' + search.nameMiddle : ''}${nicknameDisplay} ${search?.nameLast || ''}`
    : searchName;

  return (
    <View style={[styles.outer, Platform.OS === 'web' && { height: '100vh' as any }]}>
      <AppHeader />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Your Search */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Search</Text>
          <Text style={styles.searchName}>{fullDisplayName.trim()}</Text>
          {search?.ageApx != null && (
            <Text style={styles.searchDetail}>Approximately {search.ageApx} years old</Text>
          )}
          {(search?.city || search?.state) && (
            <Text style={styles.searchDetail}>
              {[search.city, search.state].filter(Boolean).join(', ')}
            </Text>
          )}
          {search?.keyWords && (
            <Text style={styles.searchDetail}>Keywords: {search.keyWords}</Text>
          )}
        </View>

        {/* Source domain */}
        <View style={styles.section}>
          <Text style={styles.sourceText}>
            An obituary might possibly exist.  Tap{' '}
            <Text style={styles.domainLinkInline} onPress={openDomain}>{domainLabel}</Text>
            {' '}to search.
          </Text>
          <Text style={styles.disclaimer}>
            {'\n'}{domainLabel} is not affiliated with ObitNOTE.  ObitNOTE does not guarantee the accuracy of search results.  Use of third-party websites is subject to their own terms and privacy policies.
          </Text>
        </View>

        {/* Back button */}
        <View style={styles.actions}>
          <Button
            title="Back"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#f5f0fa',
    ...(Platform.OS === 'web' ? { display: 'flex' as any, flexDirection: 'column' as any } : {}),
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxWidth: MAIN_WIDTH,
    width: '100%' as any,
    alignSelf: 'center' as const,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.purple,
    marginBottom: spacing.sm,
  },
  searchName: {
    fontSize: fontSize.xl,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  searchDetail: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: 2,
  },
  sourceText: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 24,
  },
  domainLinkInline: {
    fontWeight: '700' as const,
    color: colors.green,
    textDecorationLine: 'underline' as const,
  },
  disclaimer: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  messageText: {
    fontSize: fontSize.base,
    color: '#444444',
    textAlign: 'center' as const,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row' as const,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});

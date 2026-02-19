import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Platform, Pressable, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/services/api/client';
import { Button } from '../../../src/components/Button';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { LoadingOverlay } from '../../../src/components/LoadingOverlay';
import { colors, fontSize, spacing, borderRadius, shadows, minTouchTarget } from '../../../src/theme';
import type { MatchResult } from '../../../src/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

export default function ObitViewerScreen() {
  const { searchId, resultId } = useLocalSearchParams<{ searchId: string; resultId: string }>();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'right' | 'wrong' | null>(null);

  useEffect(() => {
    loadResult();
  }, [searchId, resultId]);

  const loadResult = async () => {
    try {
      const res = await api.get<{ result: MatchResult }>(`/api/matches/${searchId}/${resultId}`);
      setResult(res.result);
    } catch (err) {
      console.error('Failed to load result:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRight = async () => {
    setConfirmDialog(null);
    setActionLoading(true);
    try {
      await api.post(`/api/matches/${searchId}/${resultId}/confirm`);
      router.replace('/matches');
    } catch (err) {
      console.error('Failed to confirm:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmWrong = async () => {
    setConfirmDialog(null);
    setActionLoading(true);
    try {
      await api.post(`/api/matches/${searchId}/${resultId}/reject`);
      router.back();
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const openOriginal = () => {
    if (!result) return;
    if (Platform.OS === 'web') {
      window.open(result.url, '_blank', 'noopener');
    } else {
      Linking.openURL(result.url);
    }
  };

  if (loading || !result) {
    return <LoadingOverlay visible message="Loading obituary..." />;
  }

  const displayName = result.nameFull || [result.nameFirst, result.nameLast].filter(Boolean).join(' ') || 'Unknown';
  const locationParts = [result.city, result.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;
  const domain = extractDomain(result.url);

  return (
    <View style={[styles.container, Platform.OS === 'web' && { height: '100vh' as any }]}>
      {/* Title bar */}
      <View style={styles.titleBar}>
        <Pressable onPress={() => router.replace('/matches')} accessibilityRole="link" accessibilityLabel="Home" style={styles.homeButton}>
          <Text style={styles.homeButtonText}>Home</Text>
        </Pressable>
        <Text style={styles.titleText}>Obit View</Text>
        <View style={styles.homeButton} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Photo */}
        {result.urlImage && (
          <Image
            source={{ uri: result.urlImage }}
            style={styles.photo}
            accessibilityLabel={`Photo of ${displayName}`}
          />
        )}

        {/* Name */}
        <Text style={styles.name}>{displayName}</Text>

        {/* Details row */}
        <View style={styles.detailsRow}>
          {result.ageYears != null && (
            <Text style={styles.detailChip}>Age {result.ageYears}</Text>
          )}
          {location && (
            <Text style={styles.detailChip}>{location}</Text>
          )}
          {result.dod && (
            <Text style={styles.detailChip}>{formatDate(result.dod)}</Text>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Snippet */}
        {result.snippet ? (
          <Text style={styles.snippet}>{result.snippet}</Text>
        ) : (
          <Text style={styles.noSnippet}>No obituary text available.</Text>
        )}

        {/* Funeral / Visitation dates */}
        {(result.dateFuneral || result.dateVisitation) && (
          <View style={styles.datesSection}>
            {result.dateFuneral && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>Funeral</Text>
                <Text style={styles.dateValue}>{formatDate(result.dateFuneral)}</Text>
              </View>
            )}
            {result.dateVisitation && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>Visitation</Text>
                <Text style={styles.dateValue}>{formatDate(result.dateVisitation)}</Text>
              </View>
            )}
          </View>
        )}

        {/* View original link */}
        <Pressable
          onPress={openOriginal}
          accessibilityRole="link"
          accessibilityLabel={`View original obituary on ${domain}`}
          style={({ pressed }) => [styles.viewOriginal, pressed && styles.viewOriginalPressed]}
        >
          <Text style={styles.viewOriginalText}>View on {domain}</Text>
        </Pressable>
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actions}>
        <Button
          title="Back"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.actionButton}
        />
        <Button
          title="Wrong Person"
          variant="danger"
          onPress={() => setConfirmDialog('wrong')}
          loading={actionLoading}
          style={styles.actionButton}
        />
        <Button
          title="Right Person"
          variant="primary"
          onPress={() => setConfirmDialog('right')}
          loading={actionLoading}
          style={styles.actionButton}
        />
      </View>

      <ConfirmDialog
        visible={confirmDialog === 'right'}
        title="Confirm: Right Person"
        body={`Confirm this is the right person? Searching for ${displayName} will stop.`}
        confirmLabel="Yes, This Is Them"
        confirmVariant="primary"
        onConfirm={handleConfirmRight}
        onCancel={() => setConfirmDialog(null)}
      />
      <ConfirmDialog
        visible={confirmDialog === 'wrong'}
        title="Wrong Person"
        body="Mark as wrong person? Result will be hidden, but you can undo later."
        confirmLabel="Yes, Wrong Person"
        confirmVariant="danger"
        onConfirm={handleConfirmWrong}
        onCancel={() => setConfirmDialog(null)}
      />
    </View>
  );
}

const ACTION_BAR_HEIGHT = 88;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' ? { display: 'flex' as any, flexDirection: 'column' as any } : {}),
  },
  titleBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleText: {
    fontSize: fontSize.lg,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    textAlign: 'center' as const,
  },
  homeButton: {
    width: 60,
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  homeButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600' as const,
    color: colors.green,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center' as const,
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignSelf: 'center' as const,
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: colors.divider,
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    textAlign: 'center' as const,
    marginBottom: spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailChip: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    overflow: 'hidden' as const,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: colors.green,
    alignSelf: 'center' as const,
    marginBottom: spacing.lg,
    borderRadius: 1,
  },
  snippet: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 30,
    marginBottom: spacing.lg,
  },
  noSnippet: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: spacing.lg,
  },
  datesSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  dateRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.xs,
  },
  dateLabel: {
    fontSize: fontSize.base,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  dateValue: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  viewOriginal: {
    backgroundColor: colors.purple,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center' as const,
    minHeight: minTouchTarget,
    justifyContent: 'center' as const,
  },
  viewOriginalPressed: {
    opacity: 0.85,
  },
  viewOriginalText: {
    fontSize: fontSize.lg,
    fontWeight: '700' as const,
    color: colors.white,
  },
  actions: {
    flexDirection: 'row' as const,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
    height: ACTION_BAR_HEIGHT,
    alignItems: 'center' as const,
  },
  actionButton: {
    flex: 1,
    minHeight: minTouchTarget,
  },
});

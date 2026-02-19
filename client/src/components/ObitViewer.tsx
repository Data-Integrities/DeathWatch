import React from 'react';
import { View, Text, StyleSheet, Linking, Platform, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { colors, fontSize, spacing, borderRadius, shadows, minTouchTarget } from '../theme';
import { Button } from './Button';
import { Card } from './Card';
import type { MatchResult } from '../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const ACTION_BAR_HEIGHT = 80;

interface ObitViewerProps {
  result: MatchResult;
  onRightPerson: () => void;
  onWrongPerson: () => void;
  onGoBack: () => void;
  loading?: boolean;
}

function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
  } else {
    Linking.openURL(url);
  }
}

export function ObitViewer({ result, onRightPerson, onWrongPerson, onGoBack, loading }: ObitViewerProps) {
  const { height: windowHeight } = useWindowDimensions();
  const displayName = result.nameFull || [result.nameFirst, result.nameLast].filter(Boolean).join(' ') || 'Unknown';
  const locationParts = [result.city, result.state].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

  return (
    <View style={[styles.container, Platform.OS === 'web' ? { height: windowHeight } : undefined]}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: ACTION_BAR_HEIGHT + spacing.md }]}
      >
        <Card style={styles.card}>
          <Text style={styles.name}>{displayName}</Text>

          <View style={styles.detailsGrid}>
            {result.ageYears != null && (
              <DetailRow label="Age" value={result.ageYears.toString()} />
            )}
            {location && (
              <DetailRow label="Location" value={location} />
            )}
            {result.dod && (
              <DetailRow label="Date of Death" value={formatDate(result.dod)} />
            )}
            {result.dateFuneral && (
              <DetailRow label="Funeral" value={formatDate(result.dateFuneral)} />
            )}
            {result.dateVisitation && (
              <DetailRow label="Visitation" value={formatDate(result.dateVisitation)} />
            )}
            {result.source && (
              <DetailRow label="Source" value={result.source} />
            )}
          </View>

          {result.snippet && (
            <Text style={styles.snippet} numberOfLines={6}>{result.snippet}</Text>
          )}

          <Pressable
            onPress={() => openUrl(result.url)}
            accessibilityRole="link"
            accessibilityLabel={`View full obituary for ${displayName}`}
            style={({ pressed }) => [styles.viewObitButton, pressed && styles.viewObitPressed]}
          >
            <Text style={styles.viewObitText}>View Full Obituary</Text>
            <Text style={styles.viewObitUrl} numberOfLines={1}>{result.url}</Text>
          </Pressable>
        </Card>
      </ScrollView>

      <View style={[
        styles.actions,
        Platform.OS === 'web' ? { position: 'fixed' as any, bottom: 0, left: 0, right: 0, zIndex: 50 } : undefined,
      ]}>
        <Button
          title="Back"
          variant="ghost"
          onPress={onGoBack}
          style={styles.actionButton}
          accessibilityLabel="Go back to matches"
        />
        <Button
          title="Wrong Person"
          variant="danger"
          onPress={onWrongPerson}
          loading={loading}
          style={styles.actionButton}
          accessibilityLabel="Mark as wrong person"
        />
        <Button
          title="Right Person"
          variant="primary"
          onPress={onRightPerson}
          loading={loading}
          style={styles.actionButton}
          accessibilityLabel="Confirm this is the right person"
        />
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative' as const,
  },
  scrollArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    padding: spacing.lg,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailsGrid: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 130,
  },
  detailValue: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  snippet: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  viewObitButton: {
    backgroundColor: colors.purple,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  viewObitPressed: {
    opacity: 0.85,
  },
  viewObitText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  viewObitUrl: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: minTouchTarget,
  },
});

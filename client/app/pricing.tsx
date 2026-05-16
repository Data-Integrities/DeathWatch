import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { CopyrightFooter } from '../src/components/CopyrightFooter';
import { DailySearchesDialog } from '../src/components/DailySearchesDialog';
import { PricingTable } from '../src/components/PricingTable';
import { colors, fontSize, spacing, borderRadius } from '../src/theme';

export default function PricingPage() {
  const [searchInfoVisible, setSearchInfoVisible] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.brand}>ObitNote</Text>
          <Text style={styles.tm}>{'™'}</Text>
        </View>
        <Text style={styles.title}>Pricing</Text>
        <Text style={styles.subtitle}>Monitor people you care about.</Text>

        <PricingTable />

        <Text style={styles.description}>
          <Text style={styles.brandInline}>ObitNote</Text> is an obituary monitor and alert service.  Add people's names and <Text style={styles.brandInline}>ObitNote</Text> will send you a text and email when an obituary for any of them is published.  <Pressable onPress={() => setSearchInfoVisible(true)} style={styles.searchInfoLinkWrap}><Text style={styles.searchInfoLink}>Daily obituary searches</Text></Pressable>.
        </Text>

        <Button
          title="Back to Sign In"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
          style={styles.backButton}
        />
      </View>

      <DailySearchesDialog visible={searchInfoVisible} onClose={() => setSearchInfoVisible(false)} />

      <CopyrightFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 460,
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  brand: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.brand,
  },
  tm: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.brand,
    marginTop: 8,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.brand,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  brandInline: {
    fontWeight: '700',
    color: colors.brand,
  },
  searchInfoLinkWrap: {
    display: 'inline' as any,
  },
  searchInfoLink: {
    fontWeight: '700',
    color: colors.green,
    fontSize: fontSize.base,
    lineHeight: 26,
    textDecorationLine: 'underline' as const,
  },
  backButton: {
    marginTop: spacing.sm,
  },
});

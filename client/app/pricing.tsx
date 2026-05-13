import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius } from '../src/theme';

export default function PricingPage() {
  const [searchInfoVisible, setSearchInfoVisible] = useState(false);
  const [proInfoVisible, setProInfoVisible] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.brand}>ObitNote</Text>
          <Text style={styles.tm}>{'\u2122'}</Text>
        </View>
        <Text style={styles.title}>Pricing</Text>
        <Text style={styles.subtitle}>Monitor people you care about.</Text>

        <View style={styles.table}>
          <Text style={styles.billedNote}>All plans billed yearly (cancel anytime)</Text>

          <View style={[styles.planSection, styles.rowAlt]}>
            <Text style={styles.cell}><Text style={styles.planName}>Basic</Text> — $20/year</Text>
            <Text style={styles.planDesc}>Monitor up to 5 people.</Text>
          </View>

          <View style={styles.planSection}>
            <Text style={styles.cell}><Text style={styles.planName}>Plus</Text> — $20/year base, plus $4/year for each person beyond 5</Text>
            <Text style={styles.planDesc}>Example: 15 people = $20 + (10 {'\u00d7'} $4) = $60/year.</Text>
          </View>

          <View style={[styles.planSection, styles.rowAlt]}>
            <Text style={styles.cell}><Text style={styles.planName}>Pro</Text> — for organizations with high-volume or special-needs requirements</Text>
            <Text style={styles.planDesc}>Intended for professional and commercial use (clergy, legal, real estate, corporate, and similar).  Pro customers use Plus pricing for their watch list, and can optionally add editing grid ($150/year), staff-assisted import ($150 per import), or custom solutions.</Text>
            <Pressable onPress={() => setProInfoVisible(true)} style={styles.proInfoLinkWrap}><Text style={styles.proInfoLink}>Pro info</Text></Pressable>
          </View>
        </View>

        <Text style={styles.note}>3 free trial searches before any payment is required.  Cancel, upgrade, or downgrade anytime.</Text>

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

      <ConfirmDialog
        visible={searchInfoVisible}
        title="Daily obituary searches"
        body={"ObitNote searches online newspapers and memorial websites for obituaries every day in the US, Canada, the UK, Australia, and New Zealand using the names, locations, ages, and keywords you provide.  When one of your people is found, we'll let you know right away by text and email."}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setSearchInfoVisible(false)}
        onCancel={() => setSearchInfoVisible(false)}
      />

      <ConfirmDialog
        visible={proInfoVisible}
        title="Pro Account Info"
        body={<Text style={styles.proInfoBody}>A Pro account is a professional option in <Text style={styles.brandInline}>ObitNote</Text> offering a full-screen editable grid for thousands of rows, text file data import handled by <Text style={styles.brandInline}>ObitNote</Text> staff, and phone call support.  For more help, send a message through the Help (?) icon at the top of this page.</Text>}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setProInfoVisible(false)}
        onCancel={() => setProInfoVisible(false)}
      />

      <Text style={styles.footer}>
        Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
      </Text>
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
  table: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  planSection: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowAlt: {
    backgroundColor: '#F8F5FC',
  },
  cell: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555555',
  },
  planName: {
    color: colors.brand,
    fontWeight: '700',
  },
  planDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444444',
    lineHeight: 20,
    marginTop: 4,
  },
  billedNote: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: '#F8F5FC',
  },
  note: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginBottom: spacing.lg,
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
  proInfoLinkWrap: {
    marginTop: 6,
  },
  proInfoLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.green,
    textDecorationLine: 'underline',
  },
  proInfoBody: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 22,
  },
  backButton: {
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
});

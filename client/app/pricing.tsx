import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius } from '../src/theme';

export default function PricingPage() {
  const [searchInfoVisible, setSearchInfoVisible] = useState(false);
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
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.planCol]}>Plan</Text>
            <Text style={[styles.headerCell, styles.priceCol]}>Per Year</Text>
            <Text style={[styles.headerCell, styles.perCol]}>Per Person</Text>
          </View>
          <Text style={styles.billedNote}>All plans billed yearly (cancel anytime)</Text>
          {[
            { plan: 'Basic - up to 5', price: '$20', per: '$4.00' },
            { plan: 'Plus - up to 10', price: '$40', per: '$4.00' },
            { plan: 'Premium - 11+', price: '$40+', per: '$4.00*' },
          ].map((row, i) => (
            <View key={i} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
              <Text style={[styles.cell, styles.planCol]}>{row.plan}</Text>
              <Text style={[styles.cell, styles.priceCol, styles.priceText]}>{row.price}</Text>
              <Text style={[styles.cell, styles.perCol]}>{row.per}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.rowAlt]}>
            <Text style={[styles.cell, { flex: 7 }]}>*Premium: $40 base + $4 per person over 10</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.cell, { flex: 7 }]}>Pro: for professionals.  email support@obitnote.com</Text>
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
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerCell: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowAlt: {
    backgroundColor: '#F8F5FC',
  },
  cell: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#555555',
  },
  planCol: {
    flex: 3,
  },
  priceCol: {
    flex: 2,
    textAlign: 'center',
  },
  priceText: {
    fontWeight: '700',
    color: colors.brand,
  },
  perCol: {
    flex: 2,
    textAlign: 'right',
  },
  contactCol: {
    flex: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#555555',
    textAlign: 'center',
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

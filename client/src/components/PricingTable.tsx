import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ConfirmDialog } from './ConfirmDialog';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface PricingTableProps {
  onSelectBasic?: () => void;
  onSelectPlus?: () => void;
}

export function PricingTable({ onSelectBasic, onSelectPlus }: PricingTableProps) {
  const [proInfoVisible, setProInfoVisible] = useState(false);
  const showButtons = !!(onSelectBasic || onSelectPlus);

  return (
    <>
      <View style={styles.table}>
        <Text style={styles.billedNote}>All plans billed yearly (cancel anytime)</Text>

        <View style={[styles.planSection, styles.rowAlt]}>
          {showButtons ? (
            <View style={styles.planHeader}>
              <Text style={[styles.cell, styles.planName]}>Basic</Text>
              <Text style={[styles.cell, styles.planPrice]}>$20/year</Text>
              {onSelectBasic && (
                <Pressable onPress={onSelectBasic} style={styles.selectButton}>
                  <Text style={styles.selectButtonText}>Select</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.cell}><Text style={styles.planName}>Basic</Text> — $20/year</Text>
          )}
          <Text style={styles.planDesc}>Monitor up to 5 people.</Text>
        </View>

        <View style={styles.planSection}>
          {showButtons ? (
            <View style={styles.planHeader}>
              <Text style={[styles.cell, styles.planName]}>Plus</Text>
              <Text style={[styles.cell, styles.planPrice]}>$4/year per person, 6 person minimum</Text>
              {onSelectPlus && (
                <Pressable onPress={onSelectPlus} style={styles.selectButton}>
                  <Text style={styles.selectButtonText}>Select</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.cell}><Text style={styles.planName}>Plus</Text> — $4/year per person, 6 person minimum</Text>
          )}
          <Text style={styles.planDesc}>Example:  15 people is 15 {'×'} $4 = $60 a year (plus tax).</Text>
        </View>

        <View style={[styles.planSection, styles.rowAlt]}>
          {showButtons ? (
            <>
              <View style={styles.planHeader}>
                <Text style={[styles.cell, styles.planName]}>Pro</Text>
                <Text style={[styles.cell, styles.planPrice]}>for organizations with high-volume or special-needs requirements</Text>
              </View>
              <Text style={styles.planDesc}>For professional and commercial use (clergy, legal, real estate, corporate, and similar).  Pro customers use Plus pricing for their watch list, and can add <Pressable onPress={() => setProInfoVisible(true)} style={styles.proInfoLinkInline}><Text style={styles.proMoreInfo}>Pro optional benefits</Text></Pressable>.</Text>
            </>
          ) : (
            <>
              <Text style={styles.cell}><Text style={styles.planName}>Pro</Text> — for organizations with high-volume or special-needs requirements</Text>
              <Text style={styles.planDesc}>Professional and commercial use.  Pro customers use Plus pricing for their watch list, and can add <Pressable onPress={() => setProInfoVisible(true)} style={styles.proInfoLinkInline}><Text style={styles.proMoreInfo}>Pro optional benefits</Text></Pressable>.</Text>
            </>
          )}
        </View>
      </View>

      <Text style={styles.note}>3 free trial searches before any payment is required.  Cancel, upgrade, or downgrade anytime.</Text>

      <ConfirmDialog
        visible={proInfoVisible}
        title={<Text style={{ color: colors.brand }}>Pro service</Text>}
        body={
          <View>
            <Text style={styles.proBody}>
              <Text style={styles.planName}>Pro</Text> is for organizations with high-volume or special-needs requirements.  For professional and commercial use (clergy, legal, real estate, corporate, and similar).
            </Text>
            <Text style={styles.proBody}>Pro customers use Plus pricing for their watch list, and can optionally add:</Text>
            <View style={styles.proBullet}>
              <Text style={styles.proBulletDot}>{'•'}</Text>
              <Text style={styles.proBody}><Text style={styles.proBulletLabel}>Pro Data Grid</Text> — an editable grid view of all people searched, for easy management of large lists.  $150/year.</Text>
            </View>
            <View style={styles.proBullet}>
              <Text style={styles.proBulletDot}>{'•'}</Text>
              <Text style={styles.proBody}><Text style={styles.proBulletLabel}>Staff-assisted import</Text> — <Text style={styles.brandInline}>ObitNote</Text> staff import your Excel, CSV, TSV, or JSON list of people to monitor.  $150 per import.</Text>
            </View>
            <View style={styles.proBullet}>
              <Text style={styles.proBulletDot}>{'•'}</Text>
              <Text style={styles.proBody}><Text style={styles.proBulletLabel}>Custom solutions</Text> — custom integrations, report formats, or features scoped specifically for your Pro account.  Available on request; scoped and priced per engagement.</Text>
            </View>
            <Text style={[styles.proBody, { marginTop: 12 }]}>For more info, email support@obitnote.com</Text>
          </View>
        }
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setProInfoVisible(false)}
        onCancel={() => setProInfoVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  table: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  billedNote: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: '#F8F5FC',
  },
  planSection: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowAlt: {
    backgroundColor: '#F8F5FC',
  },
  planHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 4,
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
  planPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
    flex: 1,
  },
  planDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444444',
    lineHeight: 20,
  },
  selectButton: {
    backgroundColor: colors.green,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proInfoLinkInline: {
    display: 'inline' as any,
  },
  proMoreInfo: {
    fontWeight: '700',
    color: colors.green,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline' as const,
  },
  note: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginBottom: spacing.lg,
  },
  proBody: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 24,
    flex: 1,
    marginBottom: 8,
  },
  proBullet: {
    flexDirection: 'row' as const,
    marginBottom: 8,
    paddingLeft: 4,
  },
  proBulletDot: {
    fontSize: fontSize.base,
    color: '#444444',
    marginRight: 8,
    lineHeight: 24,
  },
  proBulletLabel: {
    fontWeight: '700',
    color: '#444444',
  },
  brandInline: {
    fontWeight: '700',
    color: colors.brand,
  },
});

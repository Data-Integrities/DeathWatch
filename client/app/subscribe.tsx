import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Button } from '../src/components/Button';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { HelpModal } from '../src/components/HelpModal';
import { usePaddle } from '../src/hooks/usePaddle';
import { getAuthToken } from '../src/services/api/client';
import { colors, fontSize, spacing, borderRadius } from '../src/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const PLANS = [
  { code: 'PLAN_5', label: 'Basic - up to 5', price: '$20', per: '$4.00', priceId: 'pri_01kppcr7dpr63g3j9y1wf9hd29' },
  { code: 'PLAN_10', label: 'Plus - up to 10', price: '$40', per: '$4.00', priceId: 'pri_01kppcrkwcpz1rz7m1hsht15wt' },
  { code: 'PLAN_PREMIUM', label: 'Premium - 11+', price: '$40+', per: '$4.00*', priceId: 'pri_01kppcs2qh0hhpkqtm3yj47kkf' },
];

export default function SubscribePage() {
  const { user, refreshUser } = useAuth();
  const [searchInfoVisible, setSearchInfoVisible] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationFailed, setActivationFailed] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollForSubscription = useCallback(() => {
    const MAX_ATTEMPTS = 15;
    const INTERVAL_MS = 2000;
    let attempt = 0;

    const poll = () => {
      attempt++;
      const token = getAuthToken();
      fetch(`${API_BASE}/api/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(json => {
          if (json?.user?.subscriptionActive) {
            setActivating(false);
            refreshUser().then(() => router.replace('/matches'));
            return;
          }
          if (attempt >= MAX_ATTEMPTS) {
            setActivating(false);
            setActivationFailed(true);
            return;
          }
          pollTimer.current = setTimeout(poll, INTERVAL_MS);
        })
        .catch(() => {
          if (attempt >= MAX_ATTEMPTS) {
            setActivating(false);
            setActivationFailed(true);
            return;
          }
          pollTimer.current = setTimeout(poll, INTERVAL_MS);
        });
    };

    poll();
  }, [refreshUser]);

  const handleCheckoutComplete = useCallback(() => {
    setActivating(true);
    setActivationFailed(false);
    pollForSubscription();
  }, [pollForSubscription]);

  const paddle = usePaddle(handleCheckoutComplete);

  const openCheckout = (priceId: string) => {
    if (paddle) {
      const opts: any = {
        items: [{ priceId, quantity: 1 }],
      };
      if (user?.id) {
        opts.customData = { userId: String(user.id) };
      }
      paddle.Checkout.open(opts);
    } else {
      console.error('Paddle not initialized');
    }
  };

  if (activating) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.activatingContent}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.activatingTitle}>Activating your subscription...</Text>
            <Text style={styles.activatingBody}>
              This usually takes just a few seconds.  <Text style={styles.yellowHighlight}>Please don't close this page.</Text>
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.brand}>ObitNote</Text>
          <Text style={styles.tm}>{'\u2122'}</Text>
        </View>
        <Text style={styles.title}>Subscribe</Text>
        <Text style={styles.subtitle}>Monitor people you care about.</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.planCol]}>Plan</Text>
            <Text style={[styles.headerCell, styles.priceCol]}>Per Year</Text>
            <Text style={[styles.headerCell, styles.perCol]}>Per Person</Text>
            <Text style={[styles.headerCell, styles.selectCol]}></Text>
          </View>
          <Text style={styles.billedNote}>All plans billed yearly (cancel anytime)</Text>
          {PLANS.map((row, i) => (
            <View key={row.code} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
              <Text style={[styles.cell, styles.planCol]}>{row.label}</Text>
              <Text style={[styles.cell, styles.priceCol, styles.priceText]}>{row.price}</Text>
              <Text style={[styles.cell, styles.perCol]}>{row.per}</Text>
              <View style={styles.selectCol}>
                <Pressable onPress={() => openCheckout(row.priceId)} style={styles.selectButton}>
                  <Text style={styles.selectButtonText}>Select</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={[styles.row, styles.rowAlt]}>
            <Text style={[styles.cell, styles.planCol, { flex: 7.5 }]}>*Premium: $40 base + $4 per person over 10</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.planCol, { flex: 7.5 }]}>Pro: for professionals.  email support@obitnote.com</Text>
          </View>
        </View>

        <Text style={styles.note}>3 free trial searches before any payment is required.  Cancel, upgrade, or downgrade anytime.</Text>

        {activationFailed && (
          <View style={styles.failedCard}>
            <Text style={styles.failedText}>
              We received your payment but activation is taking longer than expected.  Please sign out and sign back in.  If the problem persists, <Pressable onPress={() => setHelpVisible(true)} style={styles.supportLinkWrap}><Text style={styles.supportLink}>message ObitNote support</Text></Pressable>.
            </Text>
          </View>
        )}

        <Text style={styles.description}>
          <Text style={styles.brandInline}>ObitNote</Text> is an obituary monitor and alert service.  Add people's names and <Text style={styles.brandInline}>ObitNote</Text> will send you a text and email when an obituary for any of them is published.  <Pressable onPress={() => setSearchInfoVisible(true)} style={styles.searchInfoLinkWrap}><Text style={styles.searchInfoLink}>Daily obituary searches</Text></Pressable>.
        </Text>

        <Button
          title="Go Back"
          variant="secondary"
          onPress={() => router.back()}
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

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
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
    alignItems: 'center',
  },
  headerCell: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
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
  selectCol: {
    flex: 1.5,
    alignItems: 'flex-end' as const,
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
  contactCol: {
    flex: 5.5,
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
  activatingContent: {
    alignItems: 'center' as const,
    padding: spacing.xl,
  },
  activatingTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700' as const,
    color: '#444444',
    marginTop: spacing.lg,
    textAlign: 'center' as const,
  },
  activatingBody: {
    fontSize: fontSize.base,
    color: '#444444',
    marginTop: spacing.sm,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  yellowHighlight: {
    backgroundColor: '#FFFF00',
  },
  failedCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
  },
  failedText: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 24,
    textAlign: 'center' as const,
  },
  supportLinkWrap: {
    display: 'inline' as any,
  },
  supportLink: {
    color: colors.green,
    fontWeight: '700' as const,
    fontSize: fontSize.base,
    textDecorationLine: 'underline' as const,
  },
});

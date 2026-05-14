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

const BASIC_PRICE_ID = 'pri_01krhq4c78j0c0d0gvhasxp2p0';
const PLUS_PRICE_ID = 'pri_01krhmxw12mseqdjbj7napcaya';

export default function SubscribePage() {
  const { user, refreshUser } = useAuth();
  const [searchInfoVisible, setSearchInfoVisible] = useState(false);
  const [proInfoVisible, setProInfoVisible] = useState(false);
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

  const openCheckout = (priceId: string, quantity = 1) => {
    if (paddle) {
      const opts: any = {
        items: [{ priceId, quantity }],
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
          <Text style={styles.billedNote}>All plans billed yearly (cancel anytime)</Text>

          <View style={[styles.planSection, styles.rowAlt]}>
            <View style={styles.planHeader}>
              <Text style={[styles.cell, styles.planName]}>Basic</Text>
              <Text style={[styles.cell, styles.planPrice]}>$20/year</Text>
              <Pressable onPress={() => openCheckout(BASIC_PRICE_ID)} style={styles.selectButton}>
                <Text style={styles.selectButtonText}>Select</Text>
              </Pressable>
            </View>
            <Text style={styles.planDesc}>Monitor up to 5 people.</Text>
          </View>

          <View style={styles.planSection}>
            <View style={styles.planHeader}>
              <Text style={[styles.cell, styles.planName]}>Plus</Text>
              <Text style={[styles.cell, styles.planPrice]}>$4/year per person, 6 person minimum</Text>
              <Pressable onPress={() => openCheckout(PLUS_PRICE_ID, 6)} style={styles.selectButton}>
                <Text style={styles.selectButtonText}>Select</Text>
              </Pressable>
            </View>
            <Text style={styles.planDesc}>Example: 15 people = 15 {'\u00d7'} $4 = $60/year.</Text>
          </View>

          <View style={[styles.planSection, styles.rowAlt]}>
            <View style={styles.planHeader}>
              <Text style={[styles.cell, styles.planName]}>Pro</Text>
              <Text style={[styles.cell, styles.planPrice]}>for organizations with high-volume or special-needs requirements</Text>
            </View>
            <Text style={styles.planDesc}>Intended for professional and commercial use (clergy, legal, real estate, corporate, and similar).  Pro customers use Plus pricing for their watch list, and can optionally add:</Text>
            <Pressable onPress={() => setProInfoVisible(true)} style={styles.proInfoLinkWrap}><Text style={styles.proMoreInfo}>More Pro info</Text></Pressable>
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

      <ConfirmDialog
        visible={proInfoVisible}
        title={<Text style={{ color: colors.brand }}>Pro service</Text>}
        body={
          <View>
            <Text style={styles.proBody}>
              <Text style={styles.planName}>Pro</Text> is for organizations with high-volume or special-needs requirements.  Intended for professional and commercial use (clergy, legal, real estate, corporate, and similar).
            </Text>
            <Text style={styles.proBody}>Pro customers use Plus pricing for their watch list, and can optionally add:</Text>
            <View style={styles.proBullet}>
              <Text style={styles.proBulletDot}>{'\u2022'}</Text>
              <Text style={styles.proBody}><Text style={styles.proBulletLabel}>Editing grid</Text> — an editable grid view of all people searched, for easy management of large lists.  $150/year.</Text>
            </View>
            <View style={styles.proBullet}>
              <Text style={styles.proBulletDot}>{'\u2022'}</Text>
              <Text style={styles.proBody}><Text style={styles.proBulletLabel}>Staff-assisted import</Text> — <Text style={styles.brandInline}>ObitNote</Text> staff import your Excel, CSV, or JSON list of people to monitor.  $150 per import.</Text>
            </View>
            <View style={styles.proBullet}>
              <Text style={styles.proBulletDot}>{'\u2022'}</Text>
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
    fontSize: 16,
    fontWeight: '700',
    color: '#555555',
  },
  planSection: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  planHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 4,
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
  proInfoLinkWrap: {
    marginTop: 4,
  },
  proMoreInfo: {
    fontWeight: '700',
    color: colors.green,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline' as const,
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

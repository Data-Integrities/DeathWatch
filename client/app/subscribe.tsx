import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Animated, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Button } from '../src/components/Button';
import { CopyrightFooter } from '../src/components/CopyrightFooter';
import { DailySearchesDialog } from '../src/components/DailySearchesDialog';
import { HelpModal } from '../src/components/HelpModal';
import { PricingTable } from '../src/components/PricingTable';
import { usePaddle } from '../src/hooks/usePaddle';
import { getAuthToken } from '../src/services/api/client';
import { colors, fontSize, spacing, borderRadius } from '../src/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const BASIC_PRICE_ID = 'pri_01krhq4c78j0c0d0gvhasxp2p0';
const PLUS_PRICE_ID = 'pri_01krhmxw12mseqdjbj7napcaya';

export default function SubscribePage() {
  const { user, refreshUser } = useAuth();
  const [searchInfoVisible, setSearchInfoVisible] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationFailed, setActivationFailed] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);

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
    <Animated.View style={[styles.fadeWrap, { opacity: fadeAnim }]}>
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Pressable onPress={() => router.replace('/matches')} style={styles.closeButton}>
          <Text style={styles.closeX}>{'✕'}</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.brand}>ObitNote</Text>
          <Text style={styles.tm}>{'™'}</Text>
        </View>
        <Text style={styles.title}>Subscribe</Text>
        <Text style={styles.subtitle}>Monitor people you care about.</Text>

        <PricingTable
          onSelectBasic={() => openCheckout(BASIC_PRICE_ID)}
          onSelectPlus={() => openCheckout(PLUS_PRICE_ID, 6)}
        />

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
          onPress={() => router.replace('/matches')}
          style={styles.backButton}
        />
      </View>

      <DailySearchesDialog visible={searchInfoVisible} onClose={() => setSearchInfoVisible(false)} />

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
      />

      <CopyrightFooter />
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fadeWrap: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  container: {
    flexGrow: 1,
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
    position: 'relative' as const,
  },
  closeButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  closeX: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.green,
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

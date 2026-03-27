import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { TrialSearchModal } from '../src/components/TrialSearchModal';
import { usePaddle } from '../src/hooks/usePaddle';
import { HelpModal } from '../src/components/HelpModal';
import { getAuthToken } from '../src/services/api/client';
import { colors, fontSize, spacing, borderRadius, shadows } from '../src/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function WelcomeScreen() {
  const { user, refreshUser } = useAuth();
  const { width } = useWindowDimensions();
  const subscribeTextStyle = width < 400 ? { fontSize: 14, fontWeight: '700' as const } : undefined;
  const [trialVisible, setTrialVisible] = useState(false);
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

  const openCheckout = () => {
    if (paddle) {
      const opts: any = {
        items: [{ priceId: 'pri_01kmdt5pf8bzna0582hpbs9r2y', quantity: 1 }],
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
      <View style={{ flex: 1 }}>
        <AppHeader />
        <ScreenContainer style={styles.content}>
          <View style={styles.activatingCard}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.activatingTitle}>Activating your subscription...</Text>
            <Text style={styles.activatingBody}>
              This usually takes just a few seconds.  <Text style={styles.yellowHighlight}>Please don't close this page.</Text>
            </Text>
          </View>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <ScreenContainer style={styles.content}>
        <Text style={styles.greeting}>
          Welcome to <Text style={styles.brandText}>ObitNOTE</Text>{user?.firstName ? `, ${user.firstName}` : ''}!
        </Text>

        {activationFailed && (
          <Card style={styles.failedCard}>
            <Text style={styles.failedText}>
              We received your payment but activation is taking longer than expected.  Please sign out and sign back in.  If the problem persists, <Pressable onPress={() => setHelpVisible(true)} style={styles.supportLinkWrap}><Text style={styles.supportLink}>message ObitNOTE support</Text></Pressable>.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Try It Free</Text>
          <Text style={styles.cardBody}>
            Search for someone you <Text style={styles.boldText}>KNOW</Text> has passed away.{'\n'}
            We'll show you what we find -- instantly.
          </Text>
          <Text style={styles.cardNote}>
            ({user?.trialSearchesMax ?? 3} free searches)
          </Text>
          <Button
            title="Try for Free"
            variant="primary"
            onPress={() => setTrialVisible(true)}
            style={styles.cardButton}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Ready to Subscribe?</Text>
          <Text style={styles.cardBody}>
            Skip the trial and start monitoring people now.
          </Text>
          <Button
            title="Subscribe to ObitNOTE obituary monitoring"
            variant="secondary"
            onPress={openCheckout}
            style={styles.cardButton}
            textStyle={subscribeTextStyle}
          />
        </Card>
      </ScreenContainer>

      <TrialSearchModal
        visible={trialVisible}
        onClose={() => setTrialVisible(false)}
      />

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  brandText: {
    fontWeight: '700',
    color: colors.brand,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    alignItems: 'center' as const,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontSize: fontSize.base,
    color: '#444444',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  cardNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  boldText: {
    fontWeight: '700',
  },
  cardButton: {
    minWidth: 200,
  },
  activatingCard: {
    alignItems: 'center' as const,
    marginTop: spacing.xl * 2,
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
  supportLinkWrap: {
    display: 'inline' as any,
  },
  supportLink: {
    color: colors.green,
    fontWeight: '700' as const,
    fontSize: fontSize.base,
    textDecorationLine: 'underline' as const,
  },
  yellowHighlight: {
    backgroundColor: '#FFFF00',
  },
  failedCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: '#FFF8E1',
  },
  failedText: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 24,
    textAlign: 'center' as const,
  },
});

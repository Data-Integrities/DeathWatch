import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { colors, fontSize, spacing, borderRadius, shadows } from '../src/theme';

export default function WelcomeScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const subscribeTextStyle = width < 400 ? { fontSize: 14, fontWeight: '700' as const } : undefined;

  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <ScreenContainer style={styles.content}>
        <Text style={styles.greeting}>
          Welcome to <Text style={styles.brandText}>ObitNOTE</Text>, {user?.firstName}!
        </Text>

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
            onPress={() => router.push('/trial/search')}
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
            onPress={() => router.push('/subscribe' as any)}
            style={styles.cardButton}
            textStyle={subscribeTextStyle}
          />
        </Card>
      </ScreenContainer>
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
});

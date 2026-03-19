import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { colors, fontSize, spacing, borderRadius } from '../src/theme';

export default function RefundPage() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.brand}>ObitNOTE</Text>
          <Text style={styles.tm}>{'\u2122'}</Text>
        </View>

        <Text style={styles.title}>Refund Policy</Text>
        <Text style={styles.updated}>Last updated: March 18, 2026</Text>

        <Text style={styles.body}>
          We want you to be happy with ObitNOTE.  If you are not satisfied with your subscription, you may request a refund by contacting us at support@obitnote.com.
        </Text>

        <Text style={styles.heading}>Cancellation</Text>
        <Text style={styles.body}>
          You may cancel your subscription at any time through your account settings or by contacting us at support@obitnote.com.  Cancellation takes effect immediately and you will receive a prorated refund for the unused portion of your subscription.
        </Text>

        <Text style={styles.heading}>Full Refund</Text>
        <Text style={styles.body}>
          If you request a refund within 30 days of your payment, we will issue a full refund.
        </Text>

        <Text style={styles.heading}>Prorated Refund</Text>
        <Text style={styles.body}>
          If you request a refund after 30 days, we will issue a prorated refund for the unused portion of your annual subscription.
        </Text>

        <Text style={styles.heading}>How to Request a Refund</Text>
        <Text style={styles.body}>
          Contact us at support@obitnote.com with the email address associated with your account.  Refunds are typically processed within 5-10 business days.
        </Text>

        <Text style={styles.heading}>Questions</Text>
        <Text style={styles.body}>
          If you have any questions about our refund policy, contact us at support@obitnote.com.
        </Text>

        <Button
          title="Back to Sign In"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
          style={styles.backButton}
        />

        <Text style={styles.footer}>
          Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 600,
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
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.xs,
  },
  updated: {
    fontSize: fontSize.sm,
    color: '#999999',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#444444',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  backButton: {
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
});

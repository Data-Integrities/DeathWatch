import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { PrivacyContent, legalStyles } from '../src/components/LegalModal';
import { Button } from '../src/components/Button';
import { colors, spacing, borderRadius } from '../src/theme';

export default function PrivacyPage() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <PrivacyContent />
          <Button
            title="Back to Sign In"
            variant="secondary"
            onPress={() => router.push('/sign-in')}
            style={styles.backButton}
          />
        </ScrollView>
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
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  backButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});

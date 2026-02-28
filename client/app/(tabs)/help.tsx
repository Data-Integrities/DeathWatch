import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';

export default function HelpScreen() {
  return (
    <ScreenContainer>
      <Button
        title="Back"
        variant="secondary"
        onPress={() => router.back()}
        style={styles.backButton}
      />
      <View style={styles.card}>
        <Text style={styles.heading}>Contact us</Text>
        <Text style={styles.body}>
          support@obitnote.com{'\n'}or{'\n'}(800) 588-1950{'\n\n'}Thank you <Image source={require('../../assets/smile.jpg')} style={{ width: 20, height: 20, top: 4 }} />
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
  },
});

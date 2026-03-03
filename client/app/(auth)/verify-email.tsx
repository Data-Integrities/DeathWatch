import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { AppHeader } from '../../src/components/AppHeader';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { colors, fontSize, spacing, heading } from '../../src/theme';

export default function VerifyEmailScreen() {
  const { status, message } = useLocalSearchParams<{ status?: string; message?: string }>();
  const { user, refreshUser } = useAuth();

  const isSuccess = status === 'success';
  const isLoggedIn = !!user;

  // If already logged in and verification succeeded, refresh user data
  useEffect(() => {
    if (isSuccess && isLoggedIn) {
      refreshUser().catch(() => {});
    }
  }, [isSuccess, isLoggedIn]);

  return (
    <View style={{ flex: 1 }}>
      <AppHeader minimal />
      <ScreenContainer style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {isSuccess ? 'Email Verified' : 'Verification Failed'}
          </Text>
          <Text style={[styles.message, isSuccess ? styles.successText : styles.errorText]}>
            {message || (isSuccess ? 'Your email has been verified.' : 'The verification link is invalid or has expired.')}
          </Text>
          <Button
            title={isLoggedIn ? 'Continue' : 'Sign In'}
            variant="primary"
            onPress={() => router.replace(isLoggedIn ? '/matches' : '/sign-in')}
            style={styles.button}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...heading,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.base,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  successText: {
    color: colors.success,
  },
  errorText: {
    color: colors.error,
  },
  button: {
    minWidth: 160,
  },
});

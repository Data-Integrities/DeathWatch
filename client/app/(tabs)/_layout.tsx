import React, { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { colors, fontSize, spacing } from '../../src/theme';

export default function TabsLayout() {
  const { user, isLoading, refreshUser } = useAuth();
  const [resending, setResending] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  const handleResend = async () => {
    setResending(true);
    setBannerMessage('');
    try {
      await api.post('/api/auth/resend-verification');
      setBannerMessage('Verification email sent!');
      setTimeout(() => setBannerMessage(''), 4000);
    } catch (err: any) {
      setBannerMessage(err.message || 'Failed to resend.');
      setTimeout(() => setBannerMessage(''), 4000);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader />
      {user.emailVerified === false && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Please verify your email address.
          </Text>
          {bannerMessage ? (
            <Text style={styles.bannerFeedback}>{bannerMessage}</Text>
          ) : (
            <Pressable onPress={handleResend} disabled={resending}>
              <Text style={styles.bannerLink}>
                {resending ? 'Sending...' : 'Resend email'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="matches" />
        <Tabs.Screen name="searches" />
        <Tabs.Screen name="help" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f0fa',
  },
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: colors.warningLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  bannerText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: '600',
  },
  bannerLink: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  bannerFeedback: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
});

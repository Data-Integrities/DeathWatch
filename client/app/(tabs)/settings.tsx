import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Card } from '../../src/components/Card';
import { Checkbox } from '../../src/components/Checkbox';
import { Toast } from '../../src/components/Toast';
import { colors, fontSize, spacing } from '../../src/theme';
import { BUILD_VERSION } from '../../src/version';

export default function SettingsScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [toast, setToast] = useState('');
  const [unrepliedCount, setUnrepliedCount] = useState(0);

  useEffect(() => {
    if (user?.isAdmin) {
      api.get<{ count: number }>('/api/admin/messages/unreplied-count')
        .then(res => setUnrepliedCount(res.count))
        .catch(() => {});
    }
  }, [user?.isAdmin]);

  const handleChangeEmail = async () => {
    setEmailError('');
    setEmailMessage('');
    if (!newEmail || !emailPassword) {
      setEmailError('Please fill in all fields.');
      return;
    }
    setEmailLoading(true);
    try {
      const res = await api.post<{ message: string }>('/api/auth/change-email', {
        emailNew: newEmail,
        passwordCurrent: emailPassword,
      });
      await refreshUser();
      setEmailMessage('');
      setNewEmail('');
      setEmailPassword('');
      setToast('Email changed');
    } catch (err: any) {
      setEmailError(err.message || 'Failed to change email.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setMessage('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/change-password', {
        passwordCurrent: currentPassword,
        passwordNew: newPassword,
        passwordNewConfirm: confirmPassword,
      });
      setMessage('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast('Password changed');
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      await api.post('/api/auth/resend-verification');
      setResendMessage('Verification email sent!');
    } catch (err: any) {
      setResendMessage(err.message || 'Failed to resend.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Button title="Back" variant="secondary" onPress={() => router.back()} style={styles.backButton} />
      <Toast message={toast} visible={!!toast} onDone={() => setToast('')} />
      {user?.isAdmin && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <Pressable onPress={() => router.push('/admin/activity')} style={styles.adminRow}>
            <Text style={styles.adminRowText}>User Activity</Text>
            <Text style={styles.adminRowArrow}>{'\u203A'}</Text>
          </Pressable>
          <View style={styles.adminDivider} />
          <Pressable onPress={() => router.push('/admin/users')} style={styles.adminRow}>
            <Text style={styles.adminRowText}>Users</Text>
            <Text style={styles.adminRowArrow}>{'\u203A'}</Text>
          </Pressable>
          <View style={styles.adminDivider} />
          <Pressable onPress={() => router.push('/admin/messages')} style={styles.adminRow}>
            <Text style={styles.adminRowText}>Messages</Text>
            <View style={styles.adminRowRight}>
              {unrepliedCount > 0 && (
                <Text style={styles.unrepliedBadge}>{unrepliedCount} unreplied</Text>
              )}
              <Text style={styles.adminRowArrow}>{'\u203A'}</Text>
            </View>
          </Pressable>
        </Card>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.email}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user && user.emailVerified === false && (
          <View style={styles.verificationRow}>
            <Text style={styles.unverifiedText}>Email not verified</Text>
            {resendMessage ? (
              <Text style={styles.resendFeedback}>{resendMessage}</Text>
            ) : (
              <Pressable onPress={handleResendVerification} disabled={resendLoading}>
                <Text style={styles.resendLink}>
                  {resendLoading ? 'Sending...' : 'Resend verification'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        {user && user.emailVerified === true && (
          <Text style={styles.verifiedText}>Verified</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Change Email</Text>

        {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
        {emailMessage ? <Text style={styles.success}>{emailMessage}</Text> : null}

        <TextField
          label="New Email"
          labelWidth={90}
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="Password"
          labelWidth={90}
          value={emailPassword}
          onChangeText={setEmailPassword}
          secureTextEntry
        />
        <Button
          title="Change Email"
          onPress={handleChangeEmail}
          loading={emailLoading}
          variant="secondary"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TextField
          label="Current"
          labelWidth={90}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextField
          label="New"
          labelWidth={90}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <TextField
          label="Confirm"
          labelWidth={90}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Button
          title="Change Password"
          onPress={handleChangePassword}
          loading={loading}
          variant="secondary"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Info Card</Text>
        <Checkbox
          checked={!user?.skipMatchesInfoCard}
          onToggle={async (checked) => {
            try {
              await api.patch('/api/auth/preferences', { skipMatchesInfoCard: !checked });
              await refreshUser();
            } catch (err) {
              console.error('Failed to update preference:', err);
            }
          }}
          label="Include info card on Obituaries page"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Version</Text>
        <Text style={styles.versionText}>{BUILD_VERSION}</Text>
      </Card>

      <Button
        title="Sign Out"
        onPress={signOut}
        variant="danger"
        style={styles.signOut}
      />

      <Text style={styles.footer}>
        Copyright © 2009-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  email: {
    fontSize: fontSize.base,
    color: '#444444',
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  unverifiedText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: '600',
  },
  verifiedText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  resendLink: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  resendFeedback: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  success: {
    fontSize: fontSize.sm,
    color: colors.success,
    backgroundColor: colors.successLight,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  adminRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adminRowText: {
    fontSize: fontSize.base,
    color: colors.purple,
    fontWeight: '600',
  },
  unrepliedBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
  },
  adminRowArrow: {
    fontSize: fontSize.lg,
    color: '#444444',
  },
  adminDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  versionText: {
    fontSize: fontSize.sm,
    color: '#444444',
    textAlign: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  signOut: {
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
});

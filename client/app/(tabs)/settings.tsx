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

  // Editable account fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Change email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Misc
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [toast, setToast] = useState('');
  const [unrepliedCount, setUnrepliedCount] = useState(0);

  // Sync fields when user data changes
  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setPhoneNumber(user?.phoneNumber || '');
  }, [user?.firstName, user?.lastName, user?.phoneNumber]);

  useEffect(() => {
    if (user?.isAdmin) {
      api.get<{ count: number }>('/api/admin/messages/unreplied-count')
        .then(res => setUnrepliedCount(res.count))
        .catch(() => {});
    }
  }, [user?.isAdmin]);

  // Check if account fields have changed
  const accountDirty = firstName !== (user?.firstName || '')
    || lastName !== (user?.lastName || '')
    || phoneNumber !== (user?.phoneNumber || '');

  const handleSaveAccount = async () => {
    setAccountError('');
    if (!firstName.trim()) { setAccountError('First name is required.'); return; }
    if (!lastName.trim()) { setAccountError('Last name is required.'); return; }
    setAccountLoading(true);
    try {
      await api.patch('/api/auth/preferences', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim() || null,
      });
      await refreshUser();
      setToast('Account updated');
    } catch (err: any) {
      setAccountError(err.message || 'Failed to save.');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    setEmailError('');
    if (!newEmail || !emailPassword) { setEmailError('Please fill in all fields.'); return; }
    setEmailLoading(true);
    try {
      await api.post<{ message: string }>('/api/auth/change-email', {
        emailNew: newEmail,
        passwordCurrent: emailPassword,
      });
      await refreshUser();
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
    setPwError('');
    if (!currentPassword || !newPassword || !confirmPassword) { setPwError('Please fill in all fields.'); return; }
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await api.post('/api/auth/change-password', {
        passwordCurrent: currentPassword,
        passwordNew: newPassword,
        passwordNewConfirm: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast('Password changed');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
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

        {accountError ? <Text style={styles.error}>{accountError}</Text> : null}

        <TextField
          label="First Name"
          labelWidth={90}
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />
        <TextField
          label="Last Name"
          labelWidth={90}
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />

        <View style={styles.emailRow}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{user?.email}</Text>
        </View>
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

        <TextField
          label="Mobile"
          labelWidth={90}
          value={phoneNumber}
          onChangeText={(v) => setPhoneNumber(v.replace(/[^0-9+\-() ]/g, ''))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="US or Canada mobile number"
        />

        <Checkbox
          checked={user?.smsOptIn !== false}
          onToggle={async (checked) => {
            try {
              await api.patch('/api/auth/preferences', { smsOptIn: checked });
              await refreshUser();
            } catch (err) {
              console.error('Failed to update SMS preference:', err);
            }
          }}
          label="Send me text messages when obituaries are found"
        />

        {accountDirty && (
          <Button
            title="Save Changes"
            onPress={handleSaveAccount}
            loading={accountLoading}
            variant="primary"
            style={styles.saveButton}
          />
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Change Email</Text>

        {emailError ? <Text style={styles.error}>{emailError}</Text> : null}

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

        {pwError ? <Text style={styles.error}>{pwError}</Text> : null}

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
          loading={pwLoading}
          variant="secondary"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
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
        Copyright © 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
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
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    width: 90,
    flexShrink: 0,
  },
  fieldValue: {
    fontSize: fontSize.base,
    color: '#444444',
    flex: 1,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    paddingLeft: 94,
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
    marginBottom: spacing.sm,
    paddingLeft: 94,
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
  saveButton: {
    marginTop: spacing.md,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    backgroundColor: colors.errorLight,
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

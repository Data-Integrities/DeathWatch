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
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing } from '../../src/theme';
import { BUILD_VERSION } from '../../src/version';

const PLAN_LABELS: Record<string, string> = {
  PLAN_10: 'Up to 10 people ($20/yr)',
  PLAN_25: 'Up to 25 people ($39/yr)',
  PLAN_50: 'Up to 50 people ($69/yr)',
  PLAN_100: 'Up to 100 people ($119/yr)',
  PLAN_CUSTOM: 'Custom',
};

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

  // Subscription management
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [changePlanVisible, setChangePlanVisible] = useState(false);
  const [changePlanLoading, setChangePlanLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');

  // Misc
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [toast, setToast] = useState('');
  const [unrepliedCount, setUnrepliedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

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
      api.get<{ count: number }>('/api/admin/errors/count')
        .then(res => setErrorCount(res.count))
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
    if (newPassword !== confirmPassword) { setPwError('New passwords don\'t match.'); return; }
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

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await api.post('/api/subscription/cancel');
      await refreshUser();
      setCancelVisible(false);
      setToast('Subscription cancelled');
    } catch (err: any) {
      setCancelVisible(false);
      setToast(err.message || 'Failed to cancel.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleChangePlan = async (planCode: string) => {
    setChangePlanLoading(true);
    try {
      const res = await api.post<{ message: string; isUpgrade: boolean }>('/api/subscription/change-plan', { planCode });
      await refreshUser();
      setChangePlanVisible(false);
      setToast(res.message);
    } catch (err: any) {
      setChangePlanVisible(false);
      setToast(err.message || 'Failed to change plan.');
    } finally {
      setChangePlanLoading(false);
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
          <View style={styles.adminDivider} />
          <Pressable onPress={() => router.push('/admin/errors')} style={styles.adminRow}>
            <Text style={styles.adminRowText}>Error Log</Text>
            <View style={styles.adminRowRight}>
              {errorCount > 0 && (
                <Text style={styles.errorBadge}>{errorCount} today</Text>
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
          placeholder="e.g. (904) 477-0311 or +44 7911 123456"
        />
        <Text style={styles.phoneHint}>Include country code for non-US numbers (e.g. +44)</Text>

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

      {user?.subscriptionActive && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Plan</Text>
            <Text style={styles.subValue}>{PLAN_LABELS[user.planCode || ''] || user.planCode || 'Active'}</Text>
          </View>
          {user.planRenewalDate && (
            <View style={styles.subRow}>
              <Text style={styles.subLabel}>Renews</Text>
              <Text style={styles.subValue}>{user.planRenewalDate}</Text>
            </View>
          )}
          {user.usingGraceSlot && (
            <Text style={styles.graceWarning}>You've exceeded your plan limit by 1 person.  Please upgrade or remove a person.</Text>
          )}
          <View style={styles.subActions}>
            <Button
              title="Change Plan"
              variant="secondary"
              onPress={() => setChangePlanVisible(true)}
              style={styles.subButton}
            />
            <Button
              title="Cancel Subscription"
              variant="danger"
              onPress={() => setCancelVisible(true)}
              style={styles.subButton}
            />
          </View>
        </Card>
      )}

      <ConfirmDialog
        visible={cancelVisible}
        title="Cancel subscription"
        body={"Are you sure you want to cancel your subscription?  This takes effect immediately and you'll receive a prorated refund.  Your monitored searches will stop."}
        confirmLabel={cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
        confirmVariant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelVisible(false)}
      />

      {changePlanVisible && (
        <ConfirmDialog
          visible={changePlanVisible}
          title="Change plan"
          body={
            <View>
              <Text style={styles.changePlanIntro}>Select a new plan:</Text>
              {Object.entries(PLAN_LABELS).filter(([code]) => code !== 'PLAN_CUSTOM' && code !== user?.planCode).map(([code, label]) => (
                <Pressable
                  key={code}
                  onPress={() => setSelectedPlan(code)}
                  style={[styles.planOption, selectedPlan === code && styles.planOptionSelected]}
                >
                  <Text style={[styles.planOptionText, selectedPlan === code && styles.planOptionTextSelected]}>{label}</Text>
                </Pressable>
              ))}
              {selectedPlan && (
                <Text style={styles.changePlanNote}>
                  {['PLAN_10', 'PLAN_25', 'PLAN_50', 'PLAN_100'].indexOf(selectedPlan) > ['PLAN_10', 'PLAN_25', 'PLAN_50', 'PLAN_100'].indexOf(user?.planCode || '')
                    ? 'Upgrade takes effect immediately.  You\'ll be charged the prorated difference.'
                    : 'Downgrade takes effect at your next renewal date.'}
                </Text>
              )}
            </View>
          }
          confirmLabel={changePlanLoading ? 'Processing...' : 'Confirm'}
          onConfirm={() => { if (selectedPlan) handleChangePlan(selectedPlan); }}
          onCancel={() => { setChangePlanVisible(false); setSelectedPlan(''); }}
        />
      )}

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
  phoneHint: {
    fontSize: 12,
    color: colors.textMuted,
    paddingLeft: 94,
    marginBottom: spacing.sm,
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
  errorBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.error,
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
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  subLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#444444',
    width: 90,
  },
  subValue: {
    fontSize: fontSize.base,
    color: '#444444',
    flex: 1,
  },
  graceWarning: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: '600',
    backgroundColor: '#FFF8E1',
    padding: spacing.sm,
    borderRadius: 6,
    marginVertical: spacing.sm,
  },
  subActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  subButton: {
    flex: 1,
  },
  changePlanIntro: {
    fontSize: fontSize.base,
    color: '#444444',
    marginBottom: spacing.sm,
  },
  planOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  planOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: '#F8F5FC',
  },
  planOptionText: {
    fontSize: fontSize.base,
    color: '#444444',
    fontWeight: '600',
  },
  planOptionTextSelected: {
    color: colors.brand,
  },
  changePlanNote: {
    fontSize: fontSize.sm,
    color: '#444444',
    marginTop: spacing.sm,
    fontStyle: 'italic',
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

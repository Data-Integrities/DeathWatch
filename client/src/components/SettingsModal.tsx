import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api/client';
import { Button } from './Button';
import { TextField } from './TextField';
import { Card } from './Card';
import { Checkbox } from './Checkbox';
import { Toast } from './Toast';
import { LegalModal } from './LegalModal';
import { colors, fontSize, spacing, borderRadius, shadows } from '../theme';
import { BUILD_VERSION } from '../version';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: Props) {
  const { user, signOut, refreshUser } = useAuth();

  // Editable account fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Change phone
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

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
  const [legalType, setLegalType] = useState<'terms' | 'privacy' | null>(null);

  // Sync fields when user data changes or modal opens
  useEffect(() => {
    if (visible) {
      setFirstName(user?.firstName || '');
      setLastName(user?.lastName || '');
      setPhoneNumber(user?.phoneNumber || '');
      setAccountError('');
      setPhoneError('');
      setEmailError('');
      setPwError('');
      setNewEmail('');
      setEmailPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [visible, user?.firstName, user?.lastName, user?.phoneNumber]);

  useEffect(() => {
    if (visible && user?.isAdmin) {
      api.get<{ count: number }>('/api/admin/messages/unreplied-count')
        .then(res => setUnrepliedCount(res.count))
        .catch(() => {});
    }
  }, [visible, user?.isAdmin]);

  const accountDirty = firstName !== (user?.firstName || '')
    || lastName !== (user?.lastName || '');

  const phoneDirty = phoneNumber !== (user?.phoneNumber || '');

  const handleSaveAccount = async () => {
    setAccountError('');
    if (!firstName.trim()) { setAccountError('First name is required.'); return; }
    if (!lastName.trim()) { setAccountError('Last name is required.'); return; }
    setAccountLoading(true);
    try {
      await api.patch('/api/auth/preferences', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshUser();
      setToast('Account updated');
    } catch (err: any) {
      setAccountError(err.message || 'Failed to save.');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleSavePhone = async () => {
    setPhoneError('');
    setPhoneLoading(true);
    try {
      await api.patch('/api/auth/preferences', {
        phoneNumber: phoneNumber.trim() || null,
      });
      await refreshUser();
      setToast('Phone number updated');
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to save.');
    } finally {
      setPhoneLoading(false);
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

  const handleSignOut = () => {
    onClose();
    signOut();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Pressable onPress={onClose} style={styles.closeX} accessibilityRole="button" accessibilityLabel="Close">
            <FontAwesome name="times" size={28} color={colors.green} />
          </Pressable>
          <Toast message={toast} visible={!!toast} onDone={() => setToast('')} />
          <ScrollView style={styles.scrollInner} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Settings</Text>

            {/* Sign Out */}
            <Button
              title="Sign Out"
              onPress={handleSignOut}
              variant="danger"
              style={styles.signOut}
            />

            {/* Admin */}
            {user?.isAdmin && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Admin</Text>
                <Pressable onPress={() => { onClose(); router.push('/admin/activity'); }} style={styles.adminRow}>
                  <Text style={styles.adminRowText}>User Activity</Text>
                  <Text style={styles.adminRowArrow}>{'\u203A'}</Text>
                </Pressable>
                <View style={styles.adminDivider} />
                <Pressable onPress={() => { onClose(); router.push('/admin/users'); }} style={styles.adminRow}>
                  <Text style={styles.adminRowText}>Users</Text>
                  <Text style={styles.adminRowArrow}>{'\u203A'}</Text>
                </Pressable>
                <View style={styles.adminDivider} />
                <Pressable onPress={() => { onClose(); router.push('/admin/messages'); }} style={styles.adminRow}>
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

            {/* Account */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>

              {accountError ? <Text style={styles.error}>{accountError}</Text> : null}

              <TextField label="First Name" labelWidth={90} value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              <TextField label="Last Name" labelWidth={90} value={lastName} onChangeText={setLastName} autoCapitalize="words" />

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

            {/* Change Phone */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Change Phone</Text>
              {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
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
                checked={user?.smsOptIn === false}
                onToggle={async (checked) => {
                  try {
                    await api.patch('/api/auth/preferences', { smsOptIn: !checked });
                    await refreshUser();
                  } catch (err) {
                    console.error('Failed to update SMS preference:', err);
                  }
                }}
                label="Don't send notification texts"
              />
              {phoneDirty && (
                <Button
                  title="Save Phone"
                  onPress={handleSavePhone}
                  loading={phoneLoading}
                  variant="primary"
                  style={styles.saveButton}
                />
              )}
            </Card>

            {/* Change Email */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Change Email</Text>
              {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
              <TextField label="New Email" labelWidth={90} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <TextField label="Password" labelWidth={90} value={emailPassword} onChangeText={setEmailPassword} secureTextEntry />
              <Button title="Change Email" onPress={handleChangeEmail} loading={emailLoading} variant={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()) && emailPassword ? 'primary' : 'secondary'} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()) || !emailPassword} />
            </Card>

            {/* Change Password */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Change Password</Text>
              {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
              <TextField label="Current" labelWidth={90} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
              <TextField label="New" labelWidth={90} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 8 characters" />
              <TextField label="Confirm" labelWidth={90} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
              <Button title="Change Password" onPress={handleChangePassword} loading={pwLoading} variant={currentPassword && newPassword.length >= 8 && confirmPassword === newPassword ? 'primary' : 'secondary'} disabled={!currentPassword || newPassword.length < 8 || confirmPassword !== newPassword} />
              <Pressable onPress={() => { onClose(); router.push('/forgot-password'); }} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </Pressable>
            </Card>

            {/* Version */}
            <Text style={styles.versionText}>{BUILD_VERSION}</Text>

            <View style={styles.legalLinks}>
              <Pressable onPress={() => setLegalType('terms')}>
                <Text style={styles.legalLinkText}>Terms of Service</Text>
              </Pressable>
              <Text style={styles.legalSep}>{'\u2022'}</Text>
              <Pressable onPress={() => setLegalType('privacy')}>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </Pressable>
            </View>

            <Text style={styles.footer}>
              Copyright &copy; 2025-{new Date().getFullYear()} UltraSafe Data, LLC (US).{'\n'}All rights reserved.
            </Text>
          </ScrollView>
        </View>
      </View>
      <LegalModal visible={!!legalType} type={legalType || 'terms'} onClose={() => setLegalType(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: '#f5f0fa',
    borderRadius: borderRadius.lg,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
    ...shadows.modal,
  },
  closeX: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    padding: 8,
  },
  scrollInner: {
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: spacing.md,
  },
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
  forgotLink: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  forgotLinkText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.green,
    textDecorationLine: 'underline',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legalLinkText: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  signOut: {
    marginBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#444444',
  },
});

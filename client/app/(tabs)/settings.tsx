import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Card } from '../../src/components/Card';
import { colors, fontSize, spacing } from '../../src/theme';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TextField
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextField
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          helperText="At least 8 characters"
        />
        <TextField
          label="Confirm New Password"
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

      <Button
        title="Sign Out"
        onPress={signOut}
        variant="danger"
        style={styles.signOut}
      />
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
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  email: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
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
  signOut: {
    marginTop: spacing.lg,
  },
});

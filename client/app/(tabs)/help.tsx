import React, { useState } from 'react';
import { View, Text, TextInput, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../src/theme';

export default function HelpScreen() {
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSentModal, setShowSentModal] = useState(false);
  const [showSubjectAlert, setShowSubjectAlert] = useState(false);
  const [subjectError, setSubjectError] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) {
      setShowSubjectAlert(true);
      setSubjectError(true);
      return;
    }
    if (!body.trim()) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/api/messages', { subject: subject.trim(), body: body.trim() });
      setSubject('');
      setBody('');
      setShowSentModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ConfirmDialog
        visible={showSentModal}
        title="Message Sent"
        body="Your message has been sent.  We will respond as soon as possible."
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => { setShowSentModal(false); router.back(); }}
        onCancel={() => { setShowSentModal(false); router.back(); }}
      />
      <ConfirmDialog
        visible={showSubjectAlert}
        title="Subject Required"
        body="Please add a subject to your message."
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setShowSubjectAlert(false)}
        onCancel={() => setShowSubjectAlert(false)}
      />
      <Button
        title="Back"
        variant="secondary"
        onPress={() => router.back()}
        style={styles.backButton}
      />

      {user && (
        <View style={styles.card}>
          <Text style={styles.heading}>Send us a message</Text>
          <Text style={styles.subtitle}>We'll respond by email as soon as possible. <Image source={require('../../assets/smile.jpg')} style={{ width: 20, height: 20, top: 4 }} /></Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextField
            label="Subject *"
            labelWidth={90}
            value={subject}
            onChangeText={(text) => { setSubject(text); setSubjectError(false); }}
            placeholder="Required"
            error={subjectError ? ' ' : undefined}
          />
          <Text style={styles.messageLabel}>Message</Text>
          <TextInput
            style={styles.messageInput}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
          />
          <Button
            title="Send"
            onPress={handleSend}
            disabled={!body.trim()}
            loading={loading}
            style={styles.sendButton}
          />
        </View>
      )}
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
    marginBottom: spacing.md,
    ...shadows.card,
  },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: '#444444',
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  messageLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#444444',
    marginBottom: spacing.xs,
  },
  messageInput: {
    minHeight: 120,
    fontSize: fontSize.base,
    color: '#444444',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
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
});

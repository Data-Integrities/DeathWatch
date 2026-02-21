import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, minTouchTarget } from '../theme';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
];

interface StatePickerProps {
  value: string | null;
  onChange: (code: string | null) => void;
  label?: string;
  hideLabel?: boolean;
  error?: string;
}

export function StatePicker({ value, onChange, label = 'State', hideLabel, error }: StatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedState = US_STATES.find(s => s.code === value);
  const displayText = selectedState ? `${selectedState.name} (${selectedState.code})` : '';

  const filtered = useMemo(() => {
    if (!search) return US_STATES;
    const q = search.toLowerCase();
    return US_STATES.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <View style={styles.container}>
      <View style={hideLabel ? undefined : styles.row}>
        {!hideLabel && <Text style={styles.label}>{label}</Text>}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${label}`}
          style={[styles.trigger, hideLabel ? undefined : styles.triggerFlex, error ? styles.triggerError : undefined]}
        >
          <Text style={[styles.triggerText, !value && styles.placeholder]}>
            {displayText || 'Select a state'}
          </Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.closeButton}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search states..."
              value={search}
              onChangeText={setSearch}
              autoFocus
              placeholderTextColor={colors.textMuted}
            />
            <FlatList
              data={filtered}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.code);
                    setOpen(false);
                    setSearch('');
                  }}
                  style={[styles.option, item.code === value && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, item.code === value && styles.optionTextSelected]}>
                    {item.name} ({item.code})
                  </Text>
                </Pressable>
              )}
            />
            {value && (
              <Pressable
                onPress={() => { onChange(null); setOpen(false); setSearch(''); }}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>Clear Selection</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    width: 100,
    flexShrink: 0,
  },
  trigger: {
    minHeight: 40,
  },
  triggerFlex: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  triggerError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  triggerText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxHeight: '80%',
    maxWidth: 300,
    width: '100%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    fontSize: fontSize.base,
    color: colors.green,
    fontWeight: '600',
  },
  searchInput: {
    fontSize: fontSize.base,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    color: colors.textPrimary,
  },
  option: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  optionSelected: {
    backgroundColor: colors.successLight,
  },
  optionText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.green,
  },
  clearButton: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  clearText: {
    fontSize: fontSize.base,
    color: colors.error,
    fontWeight: '600',
  },
});

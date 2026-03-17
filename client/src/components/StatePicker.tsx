import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, minTouchTarget } from '../theme';

type PickerItem = { type: 'state'; code: string; name: string } | { type: 'divider'; label: string };

const REGIONS: PickerItem[] = [
  { type: 'state', code: 'AL', name: 'Alabama' }, { type: 'state', code: 'AK', name: 'Alaska' }, { type: 'state', code: 'AZ', name: 'Arizona' },
  { type: 'state', code: 'AR', name: 'Arkansas' }, { type: 'state', code: 'CA', name: 'California' }, { type: 'state', code: 'CO', name: 'Colorado' },
  { type: 'state', code: 'CT', name: 'Connecticut' }, { type: 'state', code: 'DE', name: 'Delaware' }, { type: 'state', code: 'FL', name: 'Florida' },
  { type: 'state', code: 'GA', name: 'Georgia' }, { type: 'state', code: 'HI', name: 'Hawaii' }, { type: 'state', code: 'ID', name: 'Idaho' },
  { type: 'state', code: 'IL', name: 'Illinois' }, { type: 'state', code: 'IN', name: 'Indiana' }, { type: 'state', code: 'IA', name: 'Iowa' },
  { type: 'state', code: 'KS', name: 'Kansas' }, { type: 'state', code: 'KY', name: 'Kentucky' }, { type: 'state', code: 'LA', name: 'Louisiana' },
  { type: 'state', code: 'ME', name: 'Maine' }, { type: 'state', code: 'MD', name: 'Maryland' }, { type: 'state', code: 'MA', name: 'Massachusetts' },
  { type: 'state', code: 'MI', name: 'Michigan' }, { type: 'state', code: 'MN', name: 'Minnesota' }, { type: 'state', code: 'MS', name: 'Mississippi' },
  { type: 'state', code: 'MO', name: 'Missouri' }, { type: 'state', code: 'MT', name: 'Montana' }, { type: 'state', code: 'NE', name: 'Nebraska' },
  { type: 'state', code: 'NV', name: 'Nevada' }, { type: 'state', code: 'NH', name: 'New Hampshire' }, { type: 'state', code: 'NJ', name: 'New Jersey' },
  { type: 'state', code: 'NM', name: 'New Mexico' }, { type: 'state', code: 'NY', name: 'New York' }, { type: 'state', code: 'NC', name: 'North Carolina' },
  { type: 'state', code: 'ND', name: 'North Dakota' }, { type: 'state', code: 'OH', name: 'Ohio' }, { type: 'state', code: 'OK', name: 'Oklahoma' },
  { type: 'state', code: 'OR', name: 'Oregon' }, { type: 'state', code: 'PA', name: 'Pennsylvania' }, { type: 'state', code: 'RI', name: 'Rhode Island' },
  { type: 'state', code: 'SC', name: 'South Carolina' }, { type: 'state', code: 'SD', name: 'South Dakota' }, { type: 'state', code: 'TN', name: 'Tennessee' },
  { type: 'state', code: 'TX', name: 'Texas' }, { type: 'state', code: 'UT', name: 'Utah' }, { type: 'state', code: 'VT', name: 'Vermont' },
  { type: 'state', code: 'VA', name: 'Virginia' }, { type: 'state', code: 'WA', name: 'Washington' }, { type: 'state', code: 'WV', name: 'West Virginia' },
  { type: 'state', code: 'WI', name: 'Wisconsin' }, { type: 'state', code: 'WY', name: 'Wyoming' }, { type: 'state', code: 'DC', name: 'District of Columbia' },
  { type: 'divider', label: 'Canada' },
  { type: 'state', code: 'AB', name: 'Alberta' }, { type: 'state', code: 'BC', name: 'British Columbia' },
  { type: 'state', code: 'MB', name: 'Manitoba' }, { type: 'state', code: 'NB', name: 'New Brunswick' },
  { type: 'state', code: 'NL', name: 'Newfoundland and Labrador' }, { type: 'state', code: 'NS', name: 'Nova Scotia' },
  { type: 'state', code: 'NT', name: 'Northwest Territories' }, { type: 'state', code: 'NU', name: 'Nunavut' },
  { type: 'state', code: 'ON', name: 'Ontario' }, { type: 'state', code: 'PE', name: 'Prince Edward Island' },
  { type: 'state', code: 'QC', name: 'Quebec' }, { type: 'state', code: 'SK', name: 'Saskatchewan' },
  { type: 'state', code: 'YT', name: 'Yukon' },
];

// All known codes for distinguishing picker selections from custom entries
const KNOWN_CODES = new Set(
  REGIONS.filter(r => r.type === 'state').map(r => (r as { code: string }).code)
);

function isKnownCode(value: string): boolean {
  return KNOWN_CODES.has(value);
}

interface StatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  city?: string;
  onCityChange?: (value: string) => void;
  label?: string;
  labelWidth?: number;
  hideLabel?: boolean;
  error?: string;
  openOnFocus?: boolean;
}

export function StatePicker({ value, onChange, city, onCityChange, label = 'State', labelWidth, hideLabel, error, openOnFocus }: StatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [customCity, setCustomCity] = useState('');
  const [customRegion, setCustomRegion] = useState('');
  const [customCountry, setCustomCountry] = useState('');

  // Display text: known code → "Name (CODE)", custom → the value itself
  const displayText = useMemo(() => {
    if (!value) return '';
    if (isKnownCode(value)) {
      const found = REGIONS.find(s => s.type === 'state' && (s as any).code === value) as { name: string; code: string } | undefined;
      return found ? `${found.name} (${found.code})` : value;
    }
    return value;
  }, [value]);

  const filtered = useMemo(() => {
    if (!search) return REGIONS;
    const q = search.toLowerCase();
    return REGIONS.filter(s =>
      s.type === 'state' && (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
    );
  }, [search]);

  const handleCustomSave = () => {
    const cityVal = customCity.trim();
    const region = customRegion.trim();
    const country = customCountry.trim();
    if (region || country) {
      const parts = [region, country].filter(Boolean);
      onChange(parts.join(', '));
    }
    if (onCityChange) {
      onCityChange(cityVal);
    }
    setShowCustom(false);
    setCustomCity('');
    setCustomRegion('');
    setCustomCountry('');
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.container}>
      <View style={hideLabel ? undefined : styles.row}>
        {!hideLabel && <Text style={[styles.label, labelWidth ? { width: labelWidth } : undefined]}>{label}</Text>}
        <Pressable
          onPress={() => setOpen(true)}
          onFocus={openOnFocus ? () => setOpen(true) : undefined}
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
              <Pressable onPress={() => { setOpen(false); setSearch(''); }} accessibilityRole="button" accessibilityLabel="Close">
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
              keyExtractor={(item, index) => item.type === 'divider' ? `divider-${index}` : item.code}
              renderItem={({ item }) => {
                if (item.type === 'divider') {
                  return (
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>{item.label}</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  );
                }
                return (
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
                );
              }}
              ListFooterComponent={
                <Pressable
                  onPress={() => { setShowCustom(true); setCustomCity(city || ''); setCustomRegion(''); setCustomCountry(''); }}
                  style={styles.notFoundButton}
                >
                  <Text style={styles.notFoundText}>Not found?  Enter a region name.</Text>
                </Pressable>
              }
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

      <Modal visible={showCustom} transparent animationType="fade" onRequestClose={() => setShowCustom(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.customModal}>
            <Text style={styles.customTitle}>Enter Region</Text>
            <Text style={styles.customHint}>
              For countries outside the US and Canada, spell out the full region and country name.
            </Text>
            <Text style={styles.customFieldLabel}>City or Town</Text>
            <TextInput
              style={styles.customInput}
              value={customCity}
              onChangeText={setCustomCity}
              placeholder="e.g., Christchurch, London"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Text style={styles.customFieldLabel}>Region</Text>
            <TextInput
              style={styles.customInput}
              value={customRegion}
              onChangeText={setCustomRegion}
              placeholder="e.g., Canterbury, Greater London"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Text style={styles.customFieldLabel}>Country</Text>
            <TextInput
              style={styles.customInput}
              value={customCountry}
              onChangeText={setCustomCountry}
              placeholder="e.g., England, New Zealand"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              onSubmitEditing={handleCustomSave}
              returnKeyType="done"
            />
            <View style={styles.customButtons}>
              <Pressable onPress={() => setShowCustom(false)} style={styles.customCancel}>
                <Text style={styles.customCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCustomSave} style={[styles.customSave, !customRegion.trim() && !customCountry.trim() && styles.customSaveDisabled]}>
                <Text style={styles.customSaveText}>Save</Text>
              </Pressable>
            </View>
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
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
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
    fontSize: fontSize.sm,
    fontWeight: '600',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  notFoundButton: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  notFoundText: {
    fontSize: fontSize.sm,
    color: colors.green,
    fontWeight: '600',
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

  // Custom region modal
  customModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxWidth: 300,
    width: '100%',
    padding: spacing.lg,
  },
  customTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  customHint: {
    fontSize: fontSize.sm,
    color: '#444444',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  customFieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 4,
  },
  customInput: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  customButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
  },
  customCancelText: {
    fontSize: fontSize.base,
    color: '#444444',
    fontWeight: '600',
  },
  customSave: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: borderRadius.sm,
  },
  customSaveDisabled: {
    opacity: 0.4,
  },
  customSaveText: {
    fontSize: fontSize.base,
    color: colors.white,
    fontWeight: '600',
  },
});

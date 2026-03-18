import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { COUNTRIES_PINNED, COUNTRIES_ALPHA } from '../data/countries';
import type { Country } from '../data/countries';
import { colors, fontSize, spacing, borderRadius, minTouchTarget } from '../theme';

type ListItem = { type: 'country'; country: Country } | { type: 'divider'; label: string };

interface CountryPickerProps {
  value: string | null;        // country code (e.g. 'US')
  onChange: (code: string | null, dial: string) => void;
  label?: string;
  labelWidth?: number;
}

export function CountryPicker({ value, onChange, label = 'Country', labelWidth }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const allItems: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    for (const c of COUNTRIES_PINNED) {
      items.push({ type: 'country', country: c });
    }
    items.push({ type: 'divider', label: 'All Countries' });
    for (const c of COUNTRIES_ALPHA) {
      items.push({ type: 'country', country: c });
    }
    return items;
  }, []);

  const filtered = useMemo(() => {
    if (!search) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(item => {
      if (item.type === 'divider') return false;
      const c = item.country;
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.dial.includes(q);
    });
  }, [search, allItems]);

  const selected = useMemo(() => {
    if (!value) return null;
    return COUNTRIES_ALPHA.find(c => c.code === value) || COUNTRIES_PINNED.find(c => c.code === value) || null;
  }, [value]);

  const displayText = selected ? `${selected.name} (${selected.dial})` : '';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.label, labelWidth ? { width: labelWidth } : undefined]}>{label}</Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${label}`}
          style={[styles.trigger, styles.triggerFlex]}
        >
          <Text style={[styles.triggerText, !value && styles.placeholder]}>
            {displayText || 'Select a country'}
          </Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <Pressable onPress={() => { setOpen(false); setSearch(''); }} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.closeButton}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search countries..."
              value={search}
              onChangeText={setSearch}
              autoFocus
              placeholderTextColor={colors.textMuted}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item, index) => item.type === 'divider' ? `divider-${index}` : `${item.country.code}-${index}`}
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
                const c = item.country;
                const isSelected = c.code === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(c.code, c.dial);
                      setOpen(false);
                      setSearch('');
                    }}
                    style={[styles.option, isSelected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {c.name} ({c.dial})
                    </Text>
                  </Pressable>
                );
              }}
            />
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
    gap: 4,
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
  triggerText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
    maxWidth: 340,
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
});

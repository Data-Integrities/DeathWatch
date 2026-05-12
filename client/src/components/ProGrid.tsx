import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Modal, useWindowDimensions, TextInput } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ConfirmDialog } from './ConfirmDialog';
import { colors, spacing, borderRadius } from '../theme';
const CONTAINER_PADDING = spacing.md * 2;
import type { SearchQuery } from '../types';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const id = 'google-sans-flex';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..700&display=swap';
    document.head.appendChild(link);
  }
}

interface ProGridProps {
  searches: SearchQuery[];
  onPress: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onNewSearch?: () => void;
  onAbout?: () => void;
  searchCountText?: string;
}

type SortKey = 'first' | 'last' | 'maiden' | 'nickname' | 'middle' | 'age' | 'city' | 'state' | 'keywords' | 'status' | 'matches';
type SortDir = 'asc' | 'desc';

const gridFont = Platform.OS === 'web'
  ? { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
  : {};

const dataFont = Platform.OS === 'web'
  ? { fontFamily: "'Google Sans Flex', sans-serif", fontWeight: '500' as any }
  : {};

export const COL_WIDTHS = {
  first: 100,
  last: 100,
  maiden: 80,
  nickname: 80,
  middle: 60,
  age: 75,
  city: 100,
  state: 50,
  keywords: 100,
  status: 80,
  matches: 55,
  actions: 87,
};

export const PRO_GRID_MIN_WIDTH = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0);

export function getProGridWidth(viewportWidth: number, padding = 0) {
  const widths = computeWidths(viewportWidth, padding);
  return Object.values(widths).reduce((a, b) => a + b, 0);
}

function getStatus(s: SearchQuery): string {
  if (s.confirmed) return 'Confirmed';
  if (s.matchCntTotal > 0) return 'Matched';
  return 'Searching';
}

function sortValue(s: SearchQuery, key: SortKey): string | number {
  switch (key) {
    case 'first': return (s.nameFirst || '').toLowerCase();
    case 'last': return (s.nameLast || '').toLowerCase();
    case 'maiden': return (s.nameMaiden || '').toLowerCase();
    case 'nickname': return (s.nameNickname || '').toLowerCase();
    case 'middle': return (s.nameMiddle || '').toLowerCase();
    case 'age': return s.ageApx || 0;
    case 'city': return (s.city || '').toLowerCase();
    case 'state': return (s.state || '').toLowerCase();
    case 'keywords': return (s.keyWords || '').toLowerCase();
    case 'status': {
      if (s.confirmed) return 2;
      if (s.matchCntTotal > 0) return 0;
      return 1;
    }
    case 'matches': return s.matchCntTotal;
  }
}

function defaultSort(searches: SearchQuery[]): SearchQuery[] {
  return [...searches].sort((a, b) => {
    const ga = a.confirmed ? 2 : a.matchCntTotal > 0 ? 0 : 1;
    const gb = b.confirmed ? 2 : b.matchCntTotal > 0 ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const lastCmp = (a.nameLast || '').localeCompare(b.nameLast || '');
    if (lastCmp !== 0) return lastCmp;
    return (a.nameFirst || '').localeCompare(b.nameFirst || '');
  });
}

function sortSearches(searches: SearchQuery[], key: SortKey, dir: SortDir): SearchQuery[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...searches].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m;
    return String(va).localeCompare(String(vb)) * m;
  });
}

function getRowBg(s: SearchQuery, index: number): object {
  const odd = index % 2 === 1;
  if (s.confirmed) return { backgroundColor: odd ? '#d9f0d9' : colors.successLight };
  if (s.matchCntTotal > 0) return { backgroundColor: odd ? '#f5f0b8' : '#FFFACD' };
  return { backgroundColor: odd ? '#f2eff5' : colors.white };
}

const EXPAND_KEYS = ['first', 'last', 'maiden', 'nickname', 'middle', 'city', 'keywords'] as const;
const FIXED_WIDTH = (['age', 'state', 'status', 'matches', 'actions'] as const)
  .reduce((sum, k) => sum + COL_WIDTHS[k], 0);
const EXPAND_MIN = EXPAND_KEYS.reduce((sum, k) => sum + COL_WIDTHS[k], 0);
const MAX_GRID = 1920;

function computeWidths(viewportWidth: number, padding = 0) {
  const contentWidth = Math.min(viewportWidth - padding, MAX_GRID);
  const available = contentWidth - FIXED_WIDTH;
  if (available <= EXPAND_MIN) return COL_WIDTHS;
  const scale = available / EXPAND_MIN;
  const widths = { ...COL_WIDTHS };
  for (const k of EXPAND_KEYS) {
    widths[k] = Math.floor(COL_WIDTHS[k] * scale);
  }
  return widths;
}

export function ProGrid({ searches, onPress, onEdit, onDelete, onNewSearch, onAbout, searchCountText }: ProGridProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const colWidths = computeWidths(viewportWidth, CONTAINER_PADDING);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [proInfoVisible, setProInfoVisible] = useState(false);
  const [filterText, setFilterText] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleResetSort = () => {
    setSortKey(null);
    setSortDir('asc');
  };

  const sorted = sortKey ? sortSearches(searches, sortKey, sortDir) : defaultSort(searches);

  const filtered = filterText.trim()
    ? sorted.filter(s => {
        const q = filterText.toLowerCase();
        return [s.nameFirst, s.nameLast, s.nameMaiden, s.nameNickname, s.nameMiddle, s.city, s.state, s.keyWords]
          .some(f => f && f.toLowerCase().includes(q));
      })
    : sorted;

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const headerCell = (label: string, key: SortKey, width: number, align: 'left' | 'center' = 'center') => (
    <Pressable key={key} onPress={() => handleSort(key)} style={[styles.headerCell, { width, alignItems: align === 'left' ? 'flex-start' : 'center' }]}>
      <Text style={[styles.headerText, { textAlign: align }]} numberOfLines={1}>{label}{arrow(key)}</Text>
    </Pressable>
  );

  const dataCell = (text: string | null, width: number, rowId: string, colKey: string, align: 'left' | 'center' = 'center') => {
    const val = text || '';
    return (
      <View key={colKey} style={{ width }}>
        <Text style={[styles.cell, { textAlign: align }]} numberOfLines={1}>{val || '--'}</Text>
      </View>
    );
  };

  const stickyHeader: any = Platform.OS === 'web'
    ? { position: 'sticky', top: 0, zIndex: 10 }
    : {};

  return (
    <View style={styles.container}>
      <View style={stickyHeader}>
        <View style={styles.gridTitleRow}>
          <Text style={styles.gridTitle}>Pro Data Grid</Text>
          {onNewSearch && (
            <View style={styles.titleBarBtnWrap} pointerEvents="box-none">
              <Pressable onPress={onNewSearch} style={styles.titleBarBtn}>
                <Text style={styles.titleBarBtnText}>New Search</Text>
              </Pressable>
              <View style={styles.searchBox}>
                <FontAwesome name="search" size={13} color={colors.green} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  value={filterText}
                  onChangeText={setFilterText}
                  placeholder="Search in grid..."
                  placeholderTextColor="#999999"
                />
                {filterText.length > 0 && (
                  <Pressable onPress={() => setFilterText('')} style={{ padding: 2 }}>
                    <FontAwesome name="times-circle" size={14} color="#999999" />
                  </Pressable>
                )}
              </View>
            </View>
          )}
          {onAbout && (
            <Pressable onPress={onAbout}>
              <Text style={styles.titleBarLink}>About ObitNote</Text>
            </Pressable>
          )}
          {searchCountText ? (
            <Text style={styles.titleBarCount}>{searchCountText}</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setProInfoVisible(true)}>
            <Text style={styles.proInfoLink}>Pro info</Text>
          </Pressable>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#FFFACD' }]} />
            <Text style={styles.legendTextWhite}>Obituary found</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.successLight }]} />
            <Text style={styles.legendTextWhite}>Right Person confirmed</Text>
          </View>
        </View>
        {sortKey && (
          <View style={styles.sortResetRow}>
            <Pressable onPress={handleResetSort} style={styles.resetBtn}>
              <Text style={styles.resetText}>Default sort</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.headerRow}>
          {headerCell('First', 'first', colWidths.first, 'left')}
          {headerCell('Last', 'last', colWidths.last, 'left')}
          {headerCell('Middle Name (optional)', 'middle', colWidths.middle, 'left')}
          {headerCell('Maiden', 'maiden', colWidths.maiden, 'left')}
          {headerCell('Nick', 'nickname', colWidths.nickname, 'left')}
          {headerCell('Appx. Age', 'age', colWidths.age)}
          {headerCell('City', 'city', colWidths.city, 'left')}
          {headerCell('ST', 'state', colWidths.state)}
          {headerCell('Keywords', 'keywords', colWidths.keywords, 'left')}
          {headerCell('Status', 'status', colWidths.status, 'left')}
          {headerCell('Obits', 'matches', colWidths.matches)}
          <View style={[styles.headerCell, { width: colWidths.actions }]}>
            <Text style={styles.headerText}> </Text>
          </View>
        </View>
      </View>

      {filtered.map((s, i) => {
          const displayName = [s.nameFirst, s.nameLast].filter(Boolean).join(' ');
          return (
            <Pressable key={s.id} onPress={() => onPress(s.id)} style={[styles.dataRow, getRowBg(s, i)]}>
              {dataCell(s.nameFirst, colWidths.first, s.id, 'first', 'left')}
              {dataCell(s.nameLast, colWidths.last, s.id, 'last', 'left')}
              {dataCell(s.nameMiddle, colWidths.middle, s.id, 'middle', 'left')}
              {dataCell(s.nameMaiden, colWidths.maiden, s.id, 'maiden', 'left')}
              {dataCell(s.nameNickname, colWidths.nickname, s.id, 'nickname', 'left')}
              {dataCell(s.ageApx ? String(s.ageApx) : null, colWidths.age, s.id, 'age')}
              {dataCell(s.city, colWidths.city, s.id, 'city', 'left')}
              {dataCell(s.state, colWidths.state, s.id, 'state')}
              {dataCell(s.keyWords, colWidths.keywords, s.id, 'keywords', 'left')}
              <View style={{ width: colWidths.status, justifyContent: 'center', alignItems: 'flex-start' }}>
                <Text style={[styles.cell, getStatusStyle(s), { textAlign: 'left' }]} numberOfLines={1}>{getStatus(s)}</Text>
              </View>
              <View style={{ width: colWidths.matches, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={styles.cell}>{s.matchCntTotal || '--'}</Text>
              </View>
              <View style={[styles.actionsCell, { width: colWidths.actions }]}>
                {s.confirmed ? (
                  <View style={styles.iconBtn} />
                ) : (
                  <Pressable onPress={(e) => { e.stopPropagation(); onEdit(s.id); }} style={styles.iconBtn}>
                    <FontAwesome name="pencil" size={16} color={colors.green} />
                  </Pressable>
                )}
                <Pressable onPress={(e) => { e.stopPropagation(); onDelete(s.id, displayName); }} style={styles.iconBtn}>
                  <FontAwesome name="trash" size={16} color={colors.error} />
                </Pressable>
              </View>
            </Pressable>
          );
        })}

      <ConfirmDialog
        visible={proInfoVisible}
        title="Pro Account Info"
        body={<Text style={styles.proInfoBody}>A Pro account is a professional option in <Text style={styles.brandText}>ObitNote</Text> that offers a full-screen editable grid for thousands of rows, text file data import handled by <Text style={styles.brandText}>ObitNote</Text> staff, and phone call support.  For more help, send a message through the Help (?) icon at the top of this page.</Text>}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setProInfoVisible(false)}
        onCancel={() => setProInfoVisible(false)}
      />
    </View>
  );
}

function getStatusStyle(s: SearchQuery): object {
  if (s.confirmed) return { color: colors.success };
  if (s.matchCntTotal > 0) return { color: '#444444' };
  return {};
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  gridTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.purple,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  gridTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  proInfoLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    textDecorationLine: 'underline',
  },
  titleBarBtnWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  titleBarBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    width: 180,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
    paddingVertical: 0,
    outlineStyle: 'none',
  } as any,
  titleBarBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.green,
  },
  titleBarLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
    textDecorationLine: 'underline',
  },
  titleBarCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
    marginTop: 11,
  },
  proInfoBody: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 22,
  },
  brandText: {
    fontWeight: '700',
    color: colors.brand,
  },
  sortResetRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#f5f0fa',
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  resetText: {
    fontSize: 12,
    color: colors.purple,
    fontWeight: '600',
    ...gridFont,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  legendText: {
    fontSize: 12,
    color: colors.textPrimary,
    ...gridFont,
  },
  legendTextWhite: {
    fontSize: 12,
    color: colors.white,
    ...gridFont,
  },
  scrollHorizontal: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  scrollVertical: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.purple,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  headerCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    ...gridFont,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  cell: {
    fontSize: 14,
    color: '#333333',
    paddingHorizontal: 4,
    textAlign: 'center',
    ...dataFont,
  },
  actionsCell: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

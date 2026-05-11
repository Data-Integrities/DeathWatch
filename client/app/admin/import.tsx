import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api/client';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, fontSize, spacing, borderRadius } from '../../src/theme';
import {
  parseFile, autoMapHeaders, applyMapping, findDuplicates,
  validateRow, generateRejectFile, getRejectFileName,
  IMPORT_FIELDS, detectFileType,
  type ParseResult, type ColumnMapping, type MappedRow, type ImportField,
  type FileType, type RejectedRow,
} from '../../src/utils/importParser';

const gridFont = Platform.OS === 'web'
  ? { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" as any }
  : {};

type Step = 'upload' | 'map' | 'preview20' | 'previewAll' | 'done';

interface UserOption {
  id: string;
  email: string;
  nameFirst: string | null;
  nameLast: string | null;
}

interface BatchInfo {
  batchId: string;
  loginId: string;
  rowCount: number;
  sampleName: string;
}

export default function ImportPage() {
  const { user } = useAuth();
  // ── State ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('upload');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [dupeIndices, setDupeIndices] = useState<number[]>([]);
  const [rejectedRows, setRejectedRows] = useState<RejectedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skippedDupes: number; dupeNames: string[] } | null>(null);
  const [fileName, setFileName] = useState('');

  // Delete batches
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  const [error, setError] = useState('');

  // ── Load users and batches ─────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get<{ users: UserOption[] }>('/api/admin/import/users');
      setUsers(res.users);
    } catch {}
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const res = await api.get<{ batches: BatchInfo[] }>('/api/admin/import/batches');
      setBatches(res.batches);
    } catch {}
  }, []);

  useEffect(() => { if (user) { loadUsers(); loadBatches(); } }, [user, loadUsers, loadBatches]);

  // ── File picker (web only) ─────────────────────────────────────────
  const handleFilePick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.tab,.json,.xls,.xlsx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const type = detectFileType(file.name);
      if (!type) {
        setError(`Unsupported file type: ${file.name}`);
        return;
      }

      setFileName(file.name);
      setError('');

      try {
        const result = await parseFile(file, hasHeaders);
        if (result.rows.length === 0) {
          setError(result.warnings.join('\n') || 'No data rows found in file.');
          return;
        }
        setParseResult(result);

        if (hasHeaders) {
          const auto = autoMapHeaders(result.headers);
          setMapping(auto);
        } else {
          const m: ColumnMapping = {};
          result.headers.forEach((_, i) => { m[i] = 'skip'; });
          setMapping(m);
        }

        setStep('map');
      } catch (err: any) {
        setError(`Error parsing file: ${err.message}`);
      }
    };
    input.click();
  }, [hasHeaders]);

  // ── Apply column mapping ───────────────────────────────────────────
  const handleApplyMapping = useCallback(async () => {
    if (!parseResult) return;
    setError('');

    const allMapped = parseResult.rows.map((row, i) => ({
      original: row,
      mapped: applyMapping(row, parseResult.headers, mapping),
    }));

    const valid: MappedRow[] = [];
    const rejected: RejectedRow[] = [];

    for (const item of allMapped) {
      const reasons = validateRow(item.mapped);
      if (reasons.length > 0) {
        rejected.push({ originalRow: item.original, reasons: reasons.join(', ') });
      } else {
        valid.push(item.mapped);
      }
    }

    setRejectedRows(rejected);

    if (rejected.length > 0) {
      setError(`${rejected.length} row(s) failed validation and will not be imported.  Download the rejects file for details.`);
    }

    if (selectedUserId) {
      try {
        const res = await api.get<{ searches: { nameFirst: string | null; nameLast: string | null; city: string | null }[] }>(
          `/api/admin/import/searches?userId=${selectedUserId}`
        );
        const dupes = findDuplicates(valid, res.searches);
        setDupeIndices(dupes);
      } catch {
        setDupeIndices([]);
      }
    }

    setMappedRows(valid);
    setStep('preview20');
  }, [parseResult, mapping, selectedUserId]);

  // ── Perform import ─────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!selectedUserId || mappedRows.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.post<{ success: boolean; inserted: number; skippedDupes: number; dupeNames: string[] }>('/api/admin/import', {
        userId: selectedUserId,
        rows: mappedRows,
      });
      setImportResult(res);
      setStep('done');
      loadBatches();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }, [selectedUserId, mappedRows, loadBatches]);

  // ── Delete batch ───────────────────────────────────────────────────
  const handleDeleteBatch = useCallback(async () => {
    if (!selectedBatch) return;
    setDeleteConfirmVisible(false);
    try {
      const res = await api.delete<{ success: boolean; deleted: number }>(`/api/admin/import/batches/${encodeURIComponent(selectedBatch)}`);
      setDeleteResult(`Deleted ${res.deleted} rows.`);
      setSelectedBatch('');
      loadBatches();
    } catch (err: any) {
      setDeleteResult(`Error: ${err.message}`);
    }
  }, [selectedBatch, loadBatches]);

  // ── Download rejects file ───────────────────────────────────────────
  const handleDownloadRejects = useCallback(() => {
    if (!parseResult || rejectedRows.length === 0) return;
    const detected = detectFileType(fileName);
    const fileType: FileType = detected === 'xls' ? 'csv' : (detected || 'csv');
    const content = generateRejectFile(fileType, parseResult.headers, rejectedRows);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getRejectFileName(fileName);
    a.click();
    URL.revokeObjectURL(url);
  }, [parseResult, rejectedRows, fileName]);

  // ── Update a mapping column ────────────────────────────────────────
  const setColumnMapping = (colIdx: number, value: ImportField | 'skip') => {
    setMapping(prev => ({ ...prev, [colIdx]: value }));
  };

  // ── Reset ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep('upload');
    setParseResult(null);
    setMapping({});
    setMappedRows([]);
    setDupeIndices([]);
    setRejectedRows([]);
    setImportResult(null);
    setFileName('');
    setError('');
  };

  // ── Format batch label ─────────────────────────────────────────────
  const formatBatchLabel = (b: BatchInfo) => {
    const d = new Date(b.batchId);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time} — ${b.rowCount} rows`;
  };

  // ── Preview table ──────────────────────────────────────────────────
  const renderPreviewTable = (rows: MappedRow[], maxRows?: number) => {
    const display = maxRows ? rows.slice(0, maxRows) : rows;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.gridHeaderRow}>
            <Text style={[styles.gridHeaderCell, { width: 40 }]}>#</Text>
            {IMPORT_FIELDS.map(f => (
              <Text key={f.key} style={[styles.gridHeaderCell, { width: f.key === 'keyWords' ? 140 : f.key === 'ageApx' ? 60 : f.key === 'state' ? 50 : 110 }]}>
                {f.label}
              </Text>
            ))}
            <Text style={[styles.gridHeaderCell, { width: 60 }]}>Status</Text>
          </View>
          {display.map((row, i) => {
            const isDupe = dupeIndices.includes(i);
            return (
              <View key={i} style={[styles.gridRow, i % 2 === 1 && styles.gridRowAlt, isDupe && styles.gridRowDupe]}>
                <Text style={[styles.gridCell, { width: 40 }]}>{i + 1}</Text>
                <Text style={[styles.gridCell, { width: 110 }]} numberOfLines={1}>{row.nameFirst || '--'}</Text>
                <Text style={[styles.gridCell, { width: 110 }]} numberOfLines={1}>{row.nameLast || '--'}</Text>
                <Text style={[styles.gridCell, { width: 110 }]} numberOfLines={1}>{row.nameMiddle || '--'}</Text>
                <Text style={[styles.gridCell, { width: 110 }]} numberOfLines={1}>{row.nameMaiden || '--'}</Text>
                <Text style={[styles.gridCell, { width: 110 }]} numberOfLines={1}>{row.nameNickname || '--'}</Text>
                <Text style={[styles.gridCell, { width: 60 }]}>{row.ageApx ?? '--'}</Text>
                <Text style={[styles.gridCell, { width: 110 }]} numberOfLines={1}>{row.city || '--'}</Text>
                <Text style={[styles.gridCell, { width: 50 }]}>{row.state || '--'}</Text>
                <Text style={[styles.gridCell, { width: 140 }]} numberOfLines={1}>{row.keyWords || '--'}</Text>
                <Text style={[styles.gridCell, { width: 60, color: isDupe ? colors.error : colors.green }]}>
                  {isDupe ? 'Dupe' : 'New'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Data Import</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Back</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* ── STEP: Upload ──────────────────────────────────────── */}
        {step === 'upload' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Select User and File</Text>

            <Text style={styles.label}>Import for user:</Text>
            <View style={styles.selectWrap}>
              <select
                value={selectedUserId}
                onChange={(e: any) => setSelectedUserId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- Select a user --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.email}{u.nameFirst ? ` (${u.nameFirst} ${u.nameLast || ''})` : ''}
                  </option>
                ))}
              </select>
            </View>

            <View style={styles.checkRow}>
              <Pressable
                onPress={() => setHasHeaders(!hasHeaders)}
                style={[styles.checkbox, hasHeaders && styles.checkboxChecked]}
              >
                {hasHeaders && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
              <Text style={styles.checkLabel}>First row contains column headers</Text>
            </View>

            <Text style={styles.hint}>Accepted formats: CSV, TSV, JSON, XLS, XLSX</Text>

            <Button
              title="Choose File"
              onPress={handleFilePick}
              style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
            />

            {fileName ? <Text style={styles.fileLabel}>Selected: {fileName}</Text> : null}
          </View>
        )}

        {/* ── STEP: Column Mapping ─────────────────────────────── */}
        {step === 'map' && parseResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Map Columns</Text>
            <Text style={styles.hint}>
              Assign each file column to an ObitNote field, or skip it.  {parseResult.rows.length} rows detected.
            </Text>

            {parseResult.warnings.length > 0 && (
              <View style={styles.warningBox}>
                {parseResult.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>{w}</Text>
                ))}
              </View>
            )}

            {/* Mapping dropdowns */}
            <View style={styles.mapGrid}>
              <View style={styles.mapHeaderRow}>
                <Text style={[styles.mapHeaderCell, { width: 160 }]}>File Column</Text>
                <Text style={[styles.mapHeaderCell, { width: 160 }]}>Map To</Text>
                <Text style={[styles.mapHeaderCell, { flex: 1 }]}>Sample Values</Text>
              </View>
              {parseResult.headers.map((header, colIdx) => {
                const samples = parseResult.rows.slice(0, 3).map(r => r[header]).filter(Boolean).join(', ');
                return (
                  <View key={colIdx} style={[styles.mapRow, colIdx % 2 === 1 && styles.gridRowAlt]}>
                    <Text style={[styles.mapCell, { width: 160, fontWeight: '600' }]}>{header}</Text>
                    <View style={{ width: 160 }}>
                      <select
                        value={mapping[colIdx] || 'skip'}
                        onChange={(e: any) => setColumnMapping(colIdx, e.target.value)}
                        style={selectStyle}
                      >
                        <option value="skip">-- Skip --</option>
                        {IMPORT_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </View>
                    <Text style={[styles.mapCell, { flex: 1, color: '#888' }]} numberOfLines={1}>{samples || '(empty)'}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.buttonRow}>
              <Button title="Back" variant="secondary" onPress={handleReset} />
              <Button
                title={`Preview First 20 of ${parseResult.rows.length} Rows`}
                onPress={handleApplyMapping}
                disabled={!Object.values(mapping).some(v => v !== 'skip')}
              />
            </View>
          </View>
        )}

        {/* ── STEP: Preview 20 ─────────────────────────────────── */}
        {step === 'preview20' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Preview (First 20 Rows)</Text>

            <Button
              title={importing ? 'Importing...' : `Perform Final Import (${mappedRows.length} rows)`}
              onPress={handleImport}
              disabled={importing || mappedRows.length === 0 || !selectedUserId}
              style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
            />

            {rejectedRows.length > 0 && (
              <View style={styles.rejectBanner}>
                <Text style={styles.rejectText}>
                  {rejectedRows.length} row(s) failed validation and will not be imported.
                </Text>
                <Pressable onPress={handleDownloadRejects}>
                  <Text style={styles.rejectLink}>Download {getRejectFileName(fileName)}</Text>
                </Pressable>
              </View>
            )}

            {dupeIndices.length > 0 && (
              <Text style={styles.warningText}>
                {dupeIndices.length} duplicate(s) detected (highlighted in red).  These will be skipped during import.
              </Text>
            )}

            <Text style={styles.hint}>{mappedRows.length} valid rows.  Showing first 20.</Text>
            {renderPreviewTable(mappedRows, 20)}

            <View style={styles.buttonRow}>
              <Button title="Back to Mapping" variant="secondary" onPress={() => setStep('map')} />
              {mappedRows.length > 20 && (
                <Button
                  title={`Preview All ${mappedRows.length} Rows`}
                  variant="secondary"
                  onPress={() => setStep('previewAll')}
                />
              )}
            </View>
          </View>
        )}

        {/* ── STEP: Preview All ────────────────────────────────── */}
        {step === 'previewAll' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Preview (All {mappedRows.length} Rows)</Text>

            <Button
              title={importing ? 'Importing...' : `Perform Final Import (${mappedRows.length} rows)`}
              onPress={handleImport}
              disabled={importing || mappedRows.length === 0 || !selectedUserId}
              style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
            />

            {rejectedRows.length > 0 && (
              <View style={styles.rejectBanner}>
                <Text style={styles.rejectText}>
                  {rejectedRows.length} row(s) failed validation and will not be imported.
                </Text>
                <Pressable onPress={handleDownloadRejects}>
                  <Text style={styles.rejectLink}>Download {getRejectFileName(fileName)}</Text>
                </Pressable>
              </View>
            )}

            {dupeIndices.length > 0 && (
              <Text style={styles.warningText}>
                {dupeIndices.length} duplicate(s) detected (highlighted in red).  These will be skipped during import.
              </Text>
            )}

            {renderPreviewTable(mappedRows)}

            <View style={styles.buttonRow}>
              <Button title="Back to 20-Row Preview" variant="secondary" onPress={() => setStep('preview20')} />
            </View>
          </View>
        )}

        {/* ── STEP: Done ───────────────────────────────────────── */}
        {step === 'done' && importResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Import Complete</Text>
            <Text style={styles.resultText}>Inserted: {importResult.inserted} rows</Text>
            {rejectedRows.length > 0 && (
              <View style={[styles.rejectBanner, { marginTop: spacing.sm }]}>
                <Text style={styles.rejectText}>
                  {rejectedRows.length} row(s) failed validation and were not imported.
                </Text>
                <Pressable onPress={handleDownloadRejects}>
                  <Text style={styles.rejectLink}>Download {getRejectFileName(fileName)}</Text>
                </Pressable>
              </View>
            )}
            {importResult.skippedDupes > 0 && (
              <Text style={styles.resultText}>Skipped (duplicates): {importResult.skippedDupes}</Text>
            )}
            {importResult.dupeNames.length > 0 && (
              <Text style={styles.hint}>Duplicates: {importResult.dupeNames.join(', ')}</Text>
            )}
            <Button title="Import Another File" onPress={handleReset} style={{ alignSelf: 'flex-start', marginTop: spacing.md }} />
          </View>
        )}

        {/* ── Delete Imported Rows ─────────────────────────────── */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Delete Imported Rows</Text>

          {batches.length === 0 ? (
            <Text style={styles.hint}>No import batches found.</Text>
          ) : (
            <>
              <View style={styles.selectWrap}>
                <select
                  value={selectedBatch}
                  onChange={(e: any) => setSelectedBatch(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">-- Select a batch to delete --</option>
                  {batches.map(b => (
                    <option key={b.batchId} value={b.batchId}>
                      {formatBatchLabel(b)}
                    </option>
                  ))}
                </select>
              </View>

              <Button
                title="Delete Selected Batch"
                variant="secondary"
                onPress={() => setDeleteConfirmVisible(true)}
                disabled={!selectedBatch}
                style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
              />

              {deleteResult && <Text style={styles.hint}>{deleteResult}</Text>}
            </>
          )}
        </View>

        <ConfirmDialog
          visible={deleteConfirmVisible}
          title="Delete Import Batch"
          body={`Are you sure you want to delete all rows from this import batch?  This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteBatch}
          onCancel={() => setDeleteConfirmVisible(false)}
        />
      </ScrollView>
    </View>
  );
}

// ── Native <select> style (web only) ────────────────────────────────
const selectStyle: any = {
  padding: '6px 10px',
  fontSize: 14,
  borderRadius: 6,
  border: '1px solid #ccc',
  backgroundColor: '#fff',
  color: '#444',
  width: '100%',
  maxWidth: 400,
  ...gridFont,
};

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0fa',
  },
  content: {
    padding: spacing.md,
    maxWidth: 1200,
    alignSelf: 'center' as any,
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#444444',
  },
  backLink: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.green,
    textDecorationLine: 'underline',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#444444',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 4,
  },
  fileLabel: {
    fontSize: 13,
    color: colors.green,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  selectWrap: {
    marginBottom: spacing.sm,
    maxWidth: 400,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    fontSize: 14,
    color: '#444444',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  rejectBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B8860B',
  },
  rejectLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.green,
    textDecorationLine: 'underline',
  },
  warningBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: 13,
    color: '#B8860B',
    ...gridFont,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  // ── Mapping grid ──────────────────────────────────────────────
  mapGrid: {
    marginTop: spacing.sm,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.brand,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  mapHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 4,
    ...gridFont,
  },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mapCell: {
    fontSize: 12,
    color: '#444444',
    paddingHorizontal: 4,
    ...gridFont,
  },
  // ── Preview grid ──────────────────────────────────────────────
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.brand,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  gridHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 4,
    textAlign: 'center',
    ...gridFont,
  },
  gridRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gridRowAlt: {
    backgroundColor: '#F8F5FC',
  },
  gridRowDupe: {
    backgroundColor: '#FFEBEE',
  },
  gridCell: {
    fontSize: 12,
    color: '#444444',
    paddingHorizontal: 4,
    ...gridFont,
  },
});

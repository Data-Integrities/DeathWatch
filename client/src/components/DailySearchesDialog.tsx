import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';

interface DailySearchesDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function DailySearchesDialog({ visible, onClose }: DailySearchesDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title="Daily obituary searches"
      body={"ObitNote searches online newspapers and memorial websites for obituaries every day in the US, Canada, the UK, Australia, and New Zealand using the names, locations, ages, and keywords you provide.  When one of your people is found, we'll let you know right away by text and email."}
      confirmLabel="OK"
      cancelLabel=""
      onConfirm={onClose}
      onCancel={onClose}
    />
  );
}

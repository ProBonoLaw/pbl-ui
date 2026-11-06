'use client';

import ModalDialog from '@/components/ModalDialog';
import type { RequestData } from '@/lib/types';

export default function RequestDeleteDialog({
  request,
  onConfirm,
  onCancel,
}: {
  request: RequestData | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!request) return null;

  return (
    <ModalDialog
      opened={true}
      title="Delete request?"
      submitText="Delete"
      cancelText="Cancel"
      onApproved={onConfirm}
      onCanceled={onCancel}>
      This will permanently delete the request and remove it from this case. This cannot be undone.
    </ModalDialog>
  );
}

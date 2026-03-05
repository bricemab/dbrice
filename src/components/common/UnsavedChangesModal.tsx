import { ConfirmModal } from "@/components/common/ConfirmModal";

interface UnsavedChangesModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UnsavedChangesModal({ open, onClose, onConfirm }: UnsavedChangesModalProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Unsaved Changes"
      description="This tab has unsaved changes. Are you sure you want to close it? All changes will be lost."
      confirmLabel="Close anyway"
      confirmVariant="destructive"
    />
  );
}

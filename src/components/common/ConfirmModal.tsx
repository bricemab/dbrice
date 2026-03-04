import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faSpinner } from "@fortawesome/free-solid-svg-icons";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
  isLoading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "destructive",
  isLoading,
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <FontAwesomeIcon icon={faCircleExclamation} className="text-destructive text-xl" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Bell, BellOff, X } from 'lucide-react';

interface ChartContextMenuProps {
    visible: boolean;
    x: number;
    y: number;
    price: number;
    nearAlertId?: string;
    hitItem?: {
        type: 'entry' | 'sl' | 'tp' | 'alert' | 'limit';
        ticket?: number | string;
    };
    onAddAlert: (price: number) => void;
    onRemoveAlert: (id: string) => void;
    onCancelOrder?: (ticket: number | string) => void;
    onClosePosition?: (ticket: number | string) => void;
    onCancelDraft?: () => void;
    onClose: () => void;
}

export function ChartContextMenu({
    visible,
    x,
    y,
    price,
    nearAlertId,
    hitItem,
    onAddAlert,
    onRemoveAlert,
    onCancelOrder,
    onClosePosition,
    onCancelDraft,
    onClose
}: ChartContextMenuProps) {
    if (!visible) return null;

    let actionButton = null;

    if (hitItem) {
        if (hitItem.ticket === 'draft' && onCancelDraft) {
            actionButton = (
                <button
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    onClick={() => {
                        onCancelDraft();
                        onClose();
                    }}
                >
                    <X size={14} />
                    Cancel Draft
                </button>
            );
        } else if (hitItem.ticket && hitItem.ticket !== 'draft') {
            // Check if it's position or order based on hitItem (parent should pass this info or we infer)
            // Ideally hitItem should say if it is position or order, but for now we rely on callbacks
            actionButton = (
                <button
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    onClick={() => {
                        if (onClosePosition) onClosePosition(hitItem.ticket!);
                        // Or use onCancelOrder if it is a pending order.
                        // For simplicity, let's assume the parent handles the distinction or we verify logic. 
                        // But actually, to be precise, we need to know if it's position or order.
                        // Let's rely on parent passing the correct handler or we can try both if uncertain.
                        // But wait, we can just show "Close/Cancel" and let parent decide.
                        if (onCancelOrder) onCancelOrder(hitItem.ticket!);
                        onClose();
                    }}
                >
                    <X size={14} />
                    Close / Cancel
                </button>
            );
        }
    } else if (nearAlertId) {
        actionButton = (
            <button
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                onClick={() => {
                    onRemoveAlert(nearAlertId);
                    onClose();
                }}
            >
                <BellOff size={14} />
                Remove Alert
            </button>
        );
    } else {
        actionButton = (
            <button
                className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2"
                onClick={() => {
                    onAddAlert(price);
                    onClose();
                }}
            >
                <Bell size={14} className="text-orange-500" />
                Add Alert
            </button>
        );
    }

    return (
        <div
            className="fixed z-50 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 w-48"
            style={{ left: x, top: y }}
            onClick={(e) => e.stopPropagation()}
        >
            {actionButton}
            <div className="h-[1px] bg-[#2a2e39] my-1" />
            <button
                className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2"
                onClick={onClose}
            >
                <X size={14} className="text-zinc-500" />
                Cancel
            </button>
        </div>
    );
}

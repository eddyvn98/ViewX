import { Bell, BellOff, X } from 'lucide-react';

interface ChartContextMenuProps {
    visible: boolean;
    x: number;
    y: number;
    price: number;
    nearAlertId?: string;
    onAddAlert: (price: number) => void;
    onRemoveAlert: (id: string) => void;
    onClose: () => void;
}

export function ChartContextMenu({
    visible,
    x,
    y,
    price,
    nearAlertId,
    onAddAlert,
    onRemoveAlert,
    onClose
}: ChartContextMenuProps) {
    if (!visible) return null;

    return (
        <div
            className="fixed z-50 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 w-48"
            style={{ left: x, top: y }}
            onClick={(e) => e.stopPropagation()}
        >
            {!nearAlertId ? (
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
            ) : (
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
            )}
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

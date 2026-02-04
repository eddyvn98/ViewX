'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AlertEditDialogProps {
    alertId: string;
    symbol: string;
    currentPrice: number;
    onSave: (newPrice: number) => void;
    onClose: () => void;
}

export function AlertEditDialog({ alertId, symbol, currentPrice, onSave, onClose }: AlertEditDialogProps) {
    const [price, setPrice] = useState(currentPrice.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Focus input on mount
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSave = () => {
        const newPrice = parseFloat(price);
        if (!isNaN(newPrice) && newPrice > 0) {
            onSave(newPrice);
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-96 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">Edit Alert Price</h3>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Symbol</label>
                        <div className="text-sm text-white font-mono bg-zinc-800 px-3 py-2 rounded">
                            {symbol}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Alert Price</label>
                        <input
                            ref={inputRef}
                            type="number"
                            step="any"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-medium transition-colors"
                        >
                            Save
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import { useStrategyStore } from '../store/strategy-store';
import { History, Eye, EyeOff } from 'lucide-react';

export const StrategyHistoryToggle = () => {
    const { showHistoryMarkers, toggleShowHistoryMarkers } = useStrategyStore();

    return (
        <button
            onClick={toggleShowHistoryMarkers}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${showHistoryMarkers
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
            title={showHistoryMarkers ? "Hide History Markers" : "Show History Markers"}
        >
            <History size={16} />
            <span>History</span>
            {showHistoryMarkers ? <Eye size={14} className="ml-1" /> : <EyeOff size={14} className="ml-1" />}
        </button>
    );
};

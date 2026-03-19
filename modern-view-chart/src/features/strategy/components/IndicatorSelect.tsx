import React from 'react';
import type { IndicatorType } from '../types';
import type { StrategyIndicatorOption } from '../indicator-options';

interface IndicatorSelectProps {
    value: IndicatorType;
    options: StrategyIndicatorOption[];
    onChange: (value: IndicatorType) => void;
    className?: string;
    panelClassName?: string;
    searchPlaceholder?: string;
    emptyText?: string;
}

export function IndicatorSelect({
    value,
    options,
    onChange,
    className = '',
    panelClassName = '',
    searchPlaceholder = 'Search...',
    emptyText = 'No results',
}: IndicatorSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [highlighted, setHighlighted] = React.useState(0);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const listRef = React.useRef<HTMLDivElement | null>(null);

    const filtered = React.useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return options;
        return options.filter((item) => item.value.toLowerCase().includes(keyword) || item.label.toLowerCase().includes(keyword));
    }, [options, search]);

    React.useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    React.useEffect(() => {
        if (!open) return;
        const selectedIdx = filtered.findIndex((item) => item.value === value);
        setHighlighted(selectedIdx >= 0 ? selectedIdx : 0);
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [open, filtered, value]);

    React.useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLButtonElement>(`[data-idx="${highlighted}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlighted, open]);

    const jumpByFirstLetter = (letter: string) => {
        if (!filtered.length) return;
        const lower = letter.toLowerCase();
        const start = Math.max(0, highlighted + 1);
        const ordered = [...filtered.slice(start), ...filtered.slice(0, start)];
        const found = ordered.find((item) => item.value.toLowerCase().startsWith(lower) || item.label.toLowerCase().startsWith(lower));
        if (!found) return;
        const idx = filtered.findIndex((item) => item.value === found.value);
        if (idx >= 0) setHighlighted(idx);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (/^[a-zA-Z0-9]$/.test(e.key)) {
                setOpen(true);
                jumpByFirstLetter(e.key);
                e.preventDefault();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((prev) => (prev + 1) % Math.max(filtered.length, 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((prev) => (prev - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const next = filtered[highlighted];
            if (next) onChange(next.value);
            setOpen(false);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            return;
        }
        if (/^[a-zA-Z0-9]$/.test(e.key) && document.activeElement !== inputRef.current) {
            jumpByFirstLetter(e.key);
            e.preventDefault();
        }
    };

    return (
        <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
            <button
                type="button"
                className="bg-secondary/80 text-[11px] h-6 px-1 rounded border border-border outline-none w-full font-bold text-foreground text-left"
                onClick={() => setOpen((prev) => !prev)}
            >
                {value}
            </button>
            {open && (
                <div className={`absolute left-0 top-7 z-[120] w-full rounded border border-border bg-popover p-1 shadow-xl ${panelClassName}`}>
                    <input
                        ref={inputRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="mb-1 h-6 w-full rounded border border-border bg-background px-2 text-[11px] outline-none"
                    />
                    <div ref={listRef} className="max-h-40 overflow-y-auto pr-0.5">
                        {filtered.length === 0 ? (
                            <div className="px-2 py-1 text-[11px] text-muted-foreground">{emptyText}</div>
                        ) : (
                            filtered.map((option, idx) => (
                                <button
                                    key={option.value}
                                    data-idx={idx}
                                    type="button"
                                    onMouseEnter={() => setHighlighted(idx)}
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    className={`block w-full rounded px-2 py-1 text-left text-[11px] ${idx === highlighted ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-secondary/60'}`}
                                >
                                    {option.value}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}



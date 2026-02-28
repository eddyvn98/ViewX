import { normalizeSymbol } from '@/lib/utils/symbol';

export const norm = (sym: string | undefined): string => normalizeSymbol(sym);

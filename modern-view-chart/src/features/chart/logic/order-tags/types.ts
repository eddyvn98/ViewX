import { Position, Order, Alert } from '@/lib/store';
import { VirtualPosition } from '@/features/strategy/types';

export interface TagData {
    id: string;
    type: string;
    ticket: string | number;
    price: number;
    anchorTime?: number;
    label: string;
    color: string;
    pOriginal?: Position | Order | Alert | VirtualPosition | any;
}

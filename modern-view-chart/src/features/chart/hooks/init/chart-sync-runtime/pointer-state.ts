import type { LogicalRangeSource } from '../chart-init-helpers';

export type PointerState = {
    getIsPointerInteracting: () => boolean;
    getPointerInteractionSource: () => LogicalRangeSource | null;
    setPointerInteractionSource: (value: LogicalRangeSource | null) => void;
    setPointerInteracting: (value: boolean) => void;
};

export function createPointerState(): PointerState {
    let isPointerInteracting = false;
    let pointerInteractionSource: LogicalRangeSource | null = null;

    return {
        getIsPointerInteracting: () => isPointerInteracting,
        getPointerInteractionSource: () => pointerInteractionSource,
        setPointerInteractionSource: (value: LogicalRangeSource | null) => {
            pointerInteractionSource = value;
        },
        setPointerInteracting: (value: boolean) => {
            isPointerInteracting = value;
        },
    };
}

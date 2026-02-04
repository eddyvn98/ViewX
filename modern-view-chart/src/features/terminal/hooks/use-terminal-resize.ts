import { useState, useEffect, useRef } from 'react';

export function useTerminalResize(
    initialHeight = 250,
    onHeightChange?: (h: number) => void,
    isCollapsedExternal = false,
    onToggleCollapse?: (c: boolean) => void
) {
    const [height, setHeight] = useState(initialHeight);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ y: number, h: number } | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragStartRef.current) return;

            const delta = dragStartRef.current.y - e.clientY;
            // Min height 150px, max height window - 200px
            const newHeight = Math.min(Math.max(dragStartRef.current.h + delta, 150), window.innerHeight - 200);

            setHeight(newHeight);
            onHeightChange?.(newHeight);

            // Auto expand if dragging up from collapsed state
            if (isCollapsedExternal && delta > 10) {
                onToggleCollapse?.(false);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragStartRef.current = null;
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ns-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isDragging, isCollapsedExternal, onToggleCollapse]);

    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = { y: e.clientY, h: isCollapsedExternal ? 40 : height };
    };

    const toggleCollapse = () => onToggleCollapse?.(!isCollapsedExternal);

    return {
        height,
        isCollapsed: isCollapsedExternal,
        isDragging,
        handleDragStart,
        toggleCollapse,
        setHeight
    };
}

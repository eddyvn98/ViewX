export function syncTagElements<TTag extends { id: string }, TElements extends { el: HTMLElement }>(
    container: HTMLElement,
    tags: TTag[],
    registry: Map<string, TElements>,
    factory: (tag: TTag) => TElements,
    onCreate?: (elements: TElements, tag: TTag) => void,
    onUpdate?: (elements: TElements, tag: TTag) => void,
    onRemove?: (elements: TElements, id: string) => void
) {
    const activeIds = new Set<string>();

    tags.forEach((tag) => {
        activeIds.add(tag.id);
        let elements = registry.get(tag.id);

        if (!elements) {
            elements = factory(tag);
            container.appendChild(elements.el);
            registry.set(tag.id, elements);
            onCreate?.(elements, tag);
        }

        onUpdate?.(elements, tag);
    });

    registry.forEach((elements, id) => {
        if (!activeIds.has(id)) {
            onRemove?.(elements, id);
            elements.el.remove();
            registry.delete(id);
        }
    });
}

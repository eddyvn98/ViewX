import { TagElements } from '../../logic/tag-renderer';

export function setupAlertTagInteractions(elements: TagElements, alertId: string, removeAlert: (id: string) => void) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
        removeAlert(alertId);
    });

    const makeDraggable = (el: HTMLElement | null) => {
        if (!el) return;
        el.setAttribute('data-draggable', 'true');
        el.setAttribute('data-type', 'alert');
        el.setAttribute('data-ticket', alertId);
    };

    makeDraggable(elements.priceBox);
    makeDraggable(elements.el.querySelector('.tag-body') as HTMLElement);
}

import { TagData } from '../../logic/order-tag-utils';
import { TagElements } from '../../logic/tag-renderer';

const TAG_COLLISION_PX = 16;

function toTicketNumber(ticket: string | number): number | null {
    const value = typeof ticket === 'number' ? ticket : Number.parseInt(String(ticket).replace(/^web:/, ''), 10);
    return Number.isFinite(value) ? value : null;
}

function isTagEmphasized(tag: TagData | undefined, focusedTicket: number | null, hoveredTicket: number | null): boolean {
    if (!tag) return false;
    const ticketNum = toTicketNumber(tag.ticket);
    if (ticketNum === null) return false;
    return ticketNum === focusedTicket || ticketNum === hoveredTicket;
}

function getTagPriority(tag?: TagData): number {
    if (!tag) return 99;
    if (tag.type === 'entry' || tag.type === 'draft_entry') return 0;
    if (tag.type === 'sl') return 1;
    if (tag.type === 'tp') return 2;
    return 3;
}

export function applyTagCaptionDeclutter(
    registry: Map<string, TagElements>,
    focusedTicket: number | null,
    hoveredTicket: number | null,
) {
    const rows: Array<{ y: number; elements: TagElements; tag?: TagData }> = [];

    registry.forEach((elements) => {
        const tag = (elements.el as any)._tagData as TagData | undefined;
        if (!tag || tag.type === 'draft_group') return;

        const yRaw = Number((elements.el as HTMLElement).dataset.yCoord);
        if (!Number.isFinite(yRaw)) return;

        rows.push({ y: yRaw, elements, tag });
    });

    rows.sort((a, b) => a.y - b.y);

    const updateVisibility = (elements: TagElements, visible: boolean, tag?: TagData) => {
        const isDragging = elements.el.hasAttribute('dragging');
        // Show caption for the selected "leader" in each collision group.
        // Emphasized/dragged tags should always remain visible.
        const shouldShow = visible || isTagEmphasized(tag, focusedTicket, hoveredTicket) || isDragging;
        const caption = elements.el.querySelector('.dot-caption') as HTMLElement | null;
        if (caption) {
            caption.style.display = shouldShow ? '' : 'none';
            caption.style.opacity = shouldShow ? '1' : '0';
        }
    };

    let start = 0;
    while (start < rows.length) {
        let end = start;
        while (end + 1 < rows.length && Math.abs(rows[end + 1].y - rows[end].y) < TAG_COLLISION_PX) end += 1;

        if (end === start) {
            updateVisibility(rows[start].elements, true, rows[start].tag);
            start = end + 1;
            continue;
        }

        let leader = start;
        for (let i = start + 1; i <= end; i += 1) {
            const currentPriority = getTagPriority(rows[i].tag);
            const leaderPriority = getTagPriority(rows[leader].tag);
            if (currentPriority < leaderPriority) leader = i;
        }

        for (let i = start; i <= end; i += 1) updateVisibility(rows[i].elements, i === leader, rows[i].tag);

        start = end + 1;
    }
}

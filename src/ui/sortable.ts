// Thin SortableJS wrapper for Preact. SortableJS moves DOM nodes itself; we put every node back
// where Preact expects it and apply the change through state instead, so Preact stays the owner.
import Sortable from 'sortablejs';
import { useEffect, useRef } from 'preact/hooks';

export const DECK_GROUP = 'tourroute';

interface RouteOptions {
  /** A deck card (data-landmark-id) was dropped at `index`. */
  onAdd: (landmarkId: string, index: number) => void;
  onMove: (from: number, to: number) => void;
}

/** Route list: accepts cards from the deck and reorders by the drag handle. */
export function useRouteSortable(opts: RouteOptions) {
  const ref = useRef<HTMLOListElement>(null);
  const cb = useRef(opts);
  cb.current = opts;
  useEffect(() => {
    if (!ref.current) return; // e.g. "tour not found" view
    const s = Sortable.create(ref.current, {
      group: { name: DECK_GROUP, pull: false, put: true },
      handle: '.drag-handle',
      draggable: '.stop-card',
      animation: 160,
      forceFallback: true, // same pointer-based behaviour for mouse and touch
      fallbackOnBody: true,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      emptyInsertThreshold: 24,
      delay: 120,
      delayOnTouchOnly: true,
      onAdd(evt) {
        const id = evt.item.dataset.landmarkId;
        // Restore the deck: put the original card back where its temporary clone is.
        evt.clone.replaceWith(evt.item);
        if (id && evt.newIndex !== undefined) cb.current.onAdd(id, evt.newIndex);
      },
      onUpdate(evt) {
        const { oldIndex, newIndex, from, item } = evt;
        if (oldIndex === undefined || newIndex === undefined) return;
        from.removeChild(item);
        from.insertBefore(item, from.children[oldIndex] ?? null);
        cb.current.onMove(oldIndex, newIndex);
      },
    });
    return () => s.destroy();
  }, []);
  return ref;
}

/** Deck list: cards can be dragged out (cloned) but the deck itself is not sortable. */
export function useDeckSortable() {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const s = Sortable.create(ref.current!, {
      group: { name: DECK_GROUP, pull: 'clone', put: false },
      sort: false,
      draggable: '.deck-card',
      filter: '.deck-card--used, button, a, .site-info',
      preventOnFilter: false,
      animation: 160,
      forceFallback: true, // same pointer-based behaviour for mouse and touch
      fallbackOnBody: true,
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      delay: 150,
      delayOnTouchOnly: true,
    });
    return () => s.destroy();
  }, []);
  return ref;
}

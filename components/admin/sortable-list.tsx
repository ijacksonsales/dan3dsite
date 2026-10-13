"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Vertical list reordered by dragging a handle (touch, mouse or keyboard).
 * Only the handle starts a drag, so the rest of the row still scrolls the
 * page on a tablet.
 */
export function SortableList<T extends { id: string }>({
  items,
  getLabel,
  onReorder,
  renderItem,
  disabled,
}: {
  items: T[];
  /** Name read by screen readers while dragging. */
  getLabel: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const label = (id: string | number) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? getLabel(item) : "";
  };
  const position = (id: string | number | undefined) =>
    items.findIndex((item) => item.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `${label(active.id)} selecionado, na posição ${position(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(active.id)} na posição ${position(over.id)}.` : "",
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} solto na posição ${position(over.id)}.`
        : `${label(active.id)} solto.`,
    onDragCancel: ({ active }) => `Ordem de ${label(active.id)} mantida.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mudar a ordem, aperte espaço, use as setas para cima e para baixo e aperte espaço de novo para soltar.",
        },
      }}
    >
      <SortableContext
        items={items}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <ul className="space-y-3">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              id={item.id}
              label={getLabel(item)}
              disabled={disabled}
            >
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={`Arrastar ${label} para mudar a ordem`}
      className="grid size-12 shrink-0 touch-none place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
    >
      <GripVerticalIcon className="size-6" />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn("relative", isDragging && "z-10 shadow-lg")}
    >
      {children(handle)}
    </li>
  );
}

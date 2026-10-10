"use client";

import { useRef, useState, type PointerEvent } from "react";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const SWIPE_PX = 60;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

/**
 * Full-screen photo with pinch zoom, drag to pan and double-tap zoom. At normal
 * size a horizontal swipe calls `onSwipe` (previous/next photo). All gestures
 * are handled here (`touch-action: none`), so the page itself never zooms.
 */
export function ZoomableImage({
  src,
  alt,
  onSwipe,
}: {
  src: string;
  alt: string;
  onSwipe: (direction: 1 | -1) => void;
}) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startDistance: number;
    startScale: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const lastTap = useRef(0);

  const clamp = (next: Transform): Transform => {
    const scale = Math.min(MAX_SCALE, Math.max(1, next.scale));
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || scale === 1) return { scale, x: 0, y: 0 };
    const maxX = ((scale - 1) * box.width) / 2;
    const maxY = ((scale - 1) * box.height) / 2;
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    gesture.current = {
      startDistance: pointers.current.size === 2 ? distance() : 0,
      startScale: transform.scale,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !gesture.current) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const g = gesture.current;
    if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > 10)
      g.moved = true;

    if (pointers.current.size === 2 && g.startDistance > 0) {
      const scale = (g.startScale * distance()) / g.startDistance;
      setTransform((t) => clamp({ ...t, scale }));
    } else if (pointers.current.size === 1 && transform.scale > 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setTransform((t) => clamp({ ...t, x: t.x + dx, y: t.y + dy }));
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (!g || !wasSingle) return;

    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        setTransform((t) =>
          t.scale > 1
            ? IDENTITY
            : clamp({ scale: DOUBLE_TAP_SCALE, x: 0, y: 0 }),
        );
      } else lastTap.current = now;
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (
      transform.scale === 1 &&
      Math.abs(dx) > SWIPE_PX &&
      Math.abs(dx) > Math.abs(dy)
    )
      onSwipe(dx < 0 ? 1 : -1);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-full w-full touch-none overflow-hidden select-none"
    >
      {/* Full-size original from Storage; next/image adds nothing with
          `images.unoptimized` and would fight the transform. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full object-contain transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
        }}
      />
    </div>
  );
}

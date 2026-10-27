import { LOGICAL_H, LOGICAL_W } from "../config";

export interface Rect { x: number; y: number; w: number; h: number }

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function gap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.max(dx, dy);
}

export interface RenderTransform { canvasW: number; canvasH: number; scaleX: number; scaleY: number }

export function renderTransform(viewW: number, viewH: number, dpr: number): RenderTransform {
  const canvasW = Math.round(viewW * dpr);
  const canvasH = Math.round(viewH * dpr);
  const scaleX = canvasW / LOGICAL_W;
  const scaleY = canvasH / LOGICAL_H;
  return { canvasW, canvasH, scaleX, scaleY };
}

export function screenToLogical(cssX: number, cssY: number, viewW: number, viewH: number): { x: number; y: number } {
  const x = (cssX / viewW) * LOGICAL_W;
  const y = (cssY / viewH) * LOGICAL_H;
  return { x, y };
}

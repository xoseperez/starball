export function isTouchDevice(m: { pointerCoarse: boolean; hoverNone: boolean }): boolean {
  return m.pointerCoarse && m.hoverNone;
}

export function isPortrait(viewW: number, viewH: number): boolean {
  return viewH > viewW;
}

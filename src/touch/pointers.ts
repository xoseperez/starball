import { controlById, findControl, type Emit, type TouchLayout } from "./controls";
import { contains } from "./geometry";
import { HoldRepeat } from "./repeat";

interface Track {
  controlId: string;
  isRepeat: boolean;
  repeat: HoldRepeat | null;
  inside: boolean;
}

export class PointerTracker {
  private readonly tracks = new Map<number, Track>();

  down(id: number, x: number, y: number, now: number, layout: TouchLayout): Emit[] {
    const control = findControl(layout, x, y);
    if (!control) return [];
    if (control.repeat) {
      this.tracks.set(id, {
        controlId: control.id,
        isRepeat: true,
        repeat: new HoldRepeat(now),
        inside: true,
      });
      return [{ commands: control.commands, coarse: false }];
    }
    this.tracks.set(id, {
      controlId: control.id,
      isRepeat: false,
      repeat: null,
      inside: true,
    });
    return [];
  }

  move(id: number, x: number, y: number, layout: TouchLayout): void {
    const track = this.tracks.get(id);
    if (!track) return;
    const control = controlById(layout, track.controlId);
    if (control && contains(control.rect, x, y)) return;
    track.inside = false;
    track.repeat = null;
  }

  up(id: number, x: number, y: number, layout: TouchLayout): Emit[] {
    const track = this.tracks.get(id);
    if (!track) return [];
    this.tracks.delete(id);
    if (track.isRepeat || !track.inside) return [];
    const control = controlById(layout, track.controlId);
    if (!control || !contains(control.rect, x, y)) return [];
    return [{ commands: control.commands, coarse: false }];
  }

  cancel(id: number): void {
    this.tracks.delete(id);
  }

  cancelAll(): void {
    this.tracks.clear();
  }

  tick(now: number, layout: TouchLayout): Emit[] {
    const emits: Emit[] = [];
    for (const [id, track] of [...this.tracks]) {
      if (!track.repeat) continue;
      const control = controlById(layout, track.controlId);
      if (!control) {
        this.tracks.delete(id);
        continue;
      }
      for (const step of track.repeat.due(now)) {
        emits.push({ commands: control.commands, coarse: step.coarse });
      }
    }
    return emits;
  }

  pressedIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const track of this.tracks.values()) {
      if (track.inside) ids.add(track.controlId);
    }
    return ids;
  }
}

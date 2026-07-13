export interface MovementInput {
  readonly action: boolean;
  readonly jump: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export class InputState {
  private actionQueued = false;
  private jumpQueued = false;
  private leftPointers = new Set<number>();
  private rightPointers = new Set<number>();

  pressLeft(pointerId: number): void {
    this.leftPointers.add(pointerId);
  }

  pressRight(pointerId: number): void {
    this.rightPointers.add(pointerId);
  }

  queueJump(): void {
    this.jumpQueued = true;
  }

  queueAction(): void {
    this.actionQueued = true;
  }

  release(pointerId: number): void {
    this.leftPointers.delete(pointerId);
    this.rightPointers.delete(pointerId);
  }

  reset(): void {
    this.leftPointers.clear();
    this.rightPointers.clear();
    this.jumpQueued = false;
    this.actionQueued = false;
  }

  consume(keyboard: Omit<MovementInput, "jump"> & { readonly jump: boolean }): MovementInput {
    const result = {
      left: keyboard.left || this.leftPointers.size > 0,
      right: keyboard.right || this.rightPointers.size > 0,
      jump: keyboard.jump || this.jumpQueued,
      action: keyboard.action || this.actionQueued,
    };
    this.jumpQueued = false;
    this.actionQueued = false;
    return result;
  }
}

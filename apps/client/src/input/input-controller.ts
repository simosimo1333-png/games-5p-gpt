import type Phaser from "phaser";

import { InputState, type MovementInput } from "./input-state";
import { KeyboardInput } from "./keyboard-input";
import { TouchControls } from "../ui/touch-controls";

export class InputController {
  private readonly keyboard: KeyboardInput;
  private readonly state = new InputState();

  constructor(scene: Phaser.Scene) {
    this.keyboard = new KeyboardInput(scene);
    new TouchControls(scene, this.state);
  }

  read(): MovementInput {
    return this.state.consume(this.keyboard.read());
  }

  reset(): void {
    this.state.reset();
  }
}

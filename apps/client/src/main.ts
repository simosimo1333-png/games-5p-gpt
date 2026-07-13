import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "./config/game";
import { WORLD_PHYSICS } from "./config/physics";
import { BootScene } from "./scenes/boot-scene";
import { GameScene } from "./scenes/game-scene";
import { LobbyScene } from "./scenes/lobby-scene";
import { ResultScene } from "./scenes/result-scene";
import "./style.css";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#a7d8ff",
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: WORLD_PHYSICS.gravityY }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, LobbyScene, GameScene, ResultScene],
});

import { randomInt } from "node:crypto";

import { Room, RoomError } from "./room";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  create(hostPlayerId: string, hostName: string, now = Date.now()): Room {
    let code = "";
    do {
      code = Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    } while (this.rooms.has(code));
    const room = new Room(code, hostPlayerId, hostName, now);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "ルームが見つかりません");
    return room;
  }

  deleteIfEmpty(room: Room): void {
    if (room.isEmpty) this.rooms.delete(room.code);
  }
}

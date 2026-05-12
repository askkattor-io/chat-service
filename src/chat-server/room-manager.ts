import { WebSocket } from "ws";

export const AVAILABLE_ROOMS = ["general", "politics", "funny"] as const;
export type Room = (typeof AVAILABLE_ROOMS)[number];

export function isRoom(value: string): value is Room {
  return (AVAILABLE_ROOMS as readonly string[]).includes(value);
}

class RoomManager {
  private rooms = new Map<Room, Set<WebSocket>>();

  constructor() {
    for (const room of AVAILABLE_ROOMS) {
      this.rooms.set(room, new Set());
    }
  }

  public joinRoom(room: Room, socket: WebSocket) {
    this.rooms.get(room)?.add(socket);
  }

  public leaveRoom(room: Room, socket: WebSocket) {
    this.rooms.get(room)?.delete(socket);
  }

  public broadcast(room: Room, message: string) {
    for (const client of this.rooms.get(room) ?? []) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export const roomManager = new RoomManager();

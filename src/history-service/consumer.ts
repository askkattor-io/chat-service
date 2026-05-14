import { Redis } from "ioredis";
import {
  AVAILABLE_ROOMS,
  getLastSeenIds,
  insertMessage,
  Room,
  updateLastSeenId,
} from "./db.js";

const redisClient = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
});

const rooms = AVAILABLE_ROOMS.map((v) => `chat:${v}`);
const lastIds: Record<Room, string> = {
  general: "$",
  politics: "$",
  funny: "$",
};

export async function processStreamMessages() {
  const { rows } = await getLastSeenIds();
  for (const { room, last_read_id } of rows) {
    lastIds[room as Room] = last_read_id;
  }

  while (true) {
    const read = await redisClient.xread(
      "BLOCK",
      "0",
      "STREAMS",
      ...rooms,
      ...Object.values(lastIds),
    );
    if (!read) break;
    for (const [streamName, records] of read) {
      const room = streamName.replace(`chat:`, "") as Room;
      for (const [recordId, [, message]] of records) {
        await insertMessage(room, message, recordId);
        await updateLastSeenId(room, recordId);
        lastIds[room] = recordId;
      }
    }
  }
}

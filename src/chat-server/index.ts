import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Redis } from "ioredis";
import { AVAILABLE_ROOMS, isRoom, Room, roomManager } from "./room-manager.js";

const redisOpts = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const redisClient = new Redis(redisOpts);
const redisClientXRead = new Redis(redisOpts);

const host = process.env.HOST ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  res.write("hello");
  res.end();
});

const wss = new WebSocketServer({
  server,
  verifyClient: ({ req }, cb) => {
    const room = req.url?.split("/").at(-1);
    cb(isRoom(room ?? ""), 404, "Invalid room");
  },
});

wss.on("connection", async (client, req) => {
  const url = new URL(`http://${host}${req.url}`);
  const room = url.pathname.split("/").at(-1);
  if (!isRoom(room!)) throw Error("Room does not exist");

  roomManager.joinRoom(room, client);
  client.on("message", (msg) => {
    redisClient.xadd(
      `chat:${room}`,
      "*",
      "message",
      JSON.stringify({ text: msg.toString(), timestamp: Date.now() }),
    );
  });

  client.on("close", () => {
    roomManager.leaveRoom(room, client);
  });

  try {
    const res = await fetch(
      `${process.env.HISTORY_SERVICE_URL}/history/${room}?limit=50`,
    );
    const { data } = await res.json();
    client.send(JSON.stringify({ type: "history", messages: data }));
  } catch (error) {
    client.send(
      JSON.stringify({ type: "error", messages: "Error fetching history" }),
    );
  }
});

const rooms = AVAILABLE_ROOMS.map((v) => `chat:${v}`);
const lastIds: Record<Room, string> = {
  general: "$",
  politics: "$",
  funny: "$",
};

async function processStreamMessages() {
  while (true) {
    const read = await redisClientXRead.xread(
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
        roomManager.broadcast(room, message);
        lastIds[room] = recordId;
      }
    }
  }
}

processStreamMessages();

server.listen(port, () => {
  console.log("Server started");
});

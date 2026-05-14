import { Pool } from "pg";

export const AVAILABLE_ROOMS = ["general", "politics", "funny"] as const;
export type Room = (typeof AVAILABLE_ROOMS)[number];

export function isRoom(value: string): value is Room {
  return (AVAILABLE_ROOMS as readonly string[]).includes(value);
}

const pool = new Pool({
  user: process.env.PG_USER ?? "",
  host: process.env.PG_HOST ?? "localhost",
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
});

async function initSchema() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    room VARCHAR NOT NULL,
    text TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    stream_id TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room, id DESC);

CREATE TABLE IF NOT EXISTS stream_positions (
    room TEXT PRIMARY KEY,
    last_read_id TEXT NOT NULL
);
`);
}

async function initStreamPositions() {
  const result = await getLastSeenIds();
  if (!result.rowCount) {
    for (const room of AVAILABLE_ROOMS) {
      await pool.query(
        `INSERT INTO stream_positions (room, last_read_id) VALUES ($1, $2)`,
        [room, "$"],
      );
    }
  }
}

async function init() {
  await initSchema();
  await initStreamPositions();
}

async function insertMessage(room: Room, msg: string, streamId: string) {
  await pool.query(
    `INSERT INTO messages (room, text, timestamp, stream_id) VALUES ($1, $2, $3, $4) ON CONFLICT (stream_id) DO NOTHING`,
    [room, msg, Date.now(), streamId],
  );
}

async function updateLastSeenId(room: Room, lastSeenId: string) {
  await pool.query(
    `UPDATE stream_positions SET last_read_id = $2 WHERE room = $1`,
    [room, lastSeenId],
  );
}

async function getHistory(room: Room, limit: number) {
  return pool.query(
    `
        SELECT id, room, text, timestamp 
        FROM messages
        WHERE room = $1 
        ORDER BY id
        LIMIT $2;
`,
    [room, limit],
  );
}

async function getLastSeenIds() {
  return pool.query(`SELECT * FROM stream_positions`);
}

export {
  pool,
  init,
  getHistory,
  getLastSeenIds,
  insertMessage,
  updateLastSeenId,
};

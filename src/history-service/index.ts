import { createServer } from "node:http";
import { getHistory, init, isRoom } from "./db.js";
import { processStreamMessages } from "./consumer.js";

const PORT = process.env.SERVER_PORT ?? 3001;
const HOST = process.env.SERVER_HOST ?? "localhost";

await init();

const server = createServer(async (req, res) => {
  const url = new URL(`http://${HOST}${req.url}`);
  const [, firstPart, room] = url.pathname.split("/");
  const limit = url.searchParams.get("limit");

  if (!limit || !isRoom(room) || firstPart !== "history") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.write(JSON.stringify({ error: "Incorrect params" }));
    return res.end();
  }

  const history = await getHistory(room, Number(limit));
  res.setHeader("Content-Type", "application/json");
  res.write(JSON.stringify({ data: history.rows }));
  return res.end();
});

processStreamMessages();

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

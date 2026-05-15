# Chat Service

A multiroom real-time chat app built as an exercise from Chapter 13 of Node.js Design Patterns (exercises 13.1 and 13.2).

## Architecture

![System Architecture](architecture.png)

The core idea: WebSocket connections are stateful, which means you can't just throw more servers at the problem. If two users are connected to different server instances, they won't see each other's messages unless those instances are talking to each other.

The solution is Redis Streams. Every chat server publishes incoming messages to a shared stream and reads from it. That way it doesn't matter which server a client is connected to — everyone gets every message.

The history service is a separate process that consumes the same streams and writes to Postgres. It remembers where it left off in the stream across restarts (persisting the last-read stream ID to Postgres), so it never misses a message even if it goes down.

When a client connects, the chat server fetches the room history from the history service and sends it as a batch before live messages start flowing.

## Stack

- **WebSocket** (ws) — real-time bidirectional communication with clients
- **Redis Streams** — pub/sub backbone between chat server instances
- **PostgreSQL** — persistent message history + stream position tracking
- **TypeScript** — both services
- **Docker + docker-compose** — local dev with hot reload via tsx watch
- **GitHub Actions** — CI/CD pipeline that builds and pushes images to Docker Hub on merge to main
- **Kubernetes** — production manifests with HPA for the chat server and a single-replica history service

## Running locally

```bash
docker compose up --watch
```

This starts Redis, Postgres, the chat server (port 3000), and the history service (port 3001). The `--watch` flag enables hot reload — save a file, the relevant service restarts automatically. |

## Rooms

Three hardcoded rooms: `general`, `politics`, `funny`.

Connect via WebSocket at `ws://localhost:3000/{room}`.

## Deploying

```bash
kubectl apply -f k8s/manifests.yaml
```

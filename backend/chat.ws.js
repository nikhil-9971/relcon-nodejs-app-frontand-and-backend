const WebSocket = require("ws");
const url = require("url");
const jwt = require("jsonwebtoken");
const Chat = require("./models/Chat");

const JWT_SECRET = process.env.JWT_SECRET || "relcon-secret-key";

// username -> set of sockets
const clients = new Map();

function verifyToken(token) {
  try {
    return jwt.verify(token.replace(/^Bearer\s+/i, ""), JWT_SECRET);
  } catch {
    return null;
  }
}

function makeRoomId(a, b) {
  return [a, b].sort().join("__");
}

function broadcastPresence() {
  // broadcast online users list to all
  const online = Array.from(clients.keys());
  const payload = JSON.stringify({ type: "presence", online });
  for (const conns of clients.values()) {
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }
}

function setupWebsocket(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const parsed = url.parse(request.url, true);
    const token = parsed.query.token;
    const payload = verifyToken(token);
    if (!payload) {
      socket.destroy();
      return;
    }
    const username = (
      payload.engineerName ||
      payload.name ||
      payload.username ||
      ""
    ).trim();

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.user = username;
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    const user = ws.user;
    if (!clients.has(user)) clients.set(user, new Set());
    clients.get(user).add(ws);
    broadcastPresence();

    // welcome
    ws.send(
      JSON.stringify({
        type: "system",
        from: "System",
        text: `Connected as ${user}`,
        timestamp: new Date(),
      })
    );

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      // message structure expected: { to, text, type? }
      if (msg.type === "mark-read") {
        // mark room messages as read
        const roomId = makeRoomId(user, msg.from); // msg.from is other side
        await Chat.updateMany(
          { roomId, to: user, read: false },
          { read: true }
        );
        // notify sender about read receipt
        const receipt = {
          type: "read-receipt",
          from: user,
          to: msg.from,
          roomId,
        };
        if (clients.has(msg.from)) {
          for (const s of clients.get(msg.from)) {
            if (s.readyState === WebSocket.OPEN)
              s.send(JSON.stringify(receipt));
          }
        }
        return;
      }

      if (!msg.to || !msg.text) return;
      const toUser = msg.to.trim();
      const text = msg.text;
      const roomId = makeRoomId(user, toUser);

      // save message
      const messageDoc = await Chat.create({
        from: user,
        to: toUser,
        text,
        roomId,
        delivered: false,
        read: false,
      });

      const payloadMessage = {
        type: "chat",
        from: user,
        to: toUser,
        text,
        roomId,
        _id: messageDoc._id,
        createdAt: messageDoc.createdAt,
      };

      // deliver to recipient
      if (clients.has(toUser)) {
        for (const clientWs of clients.get(toUser)) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({ ...payloadMessage, delivered: true })
            );
          }
        }
      }

      // update delivered flag in DB
      await Chat.findByIdAndUpdate(messageDoc._id, { delivered: true });

      // echo back to sender with delivery info
      if (clients.has(user)) {
        for (const clientWs of clients.get(user)) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({ ...payloadMessage, delivered: true })
            );
          }
        }
      }
    });

    ws.on("close", () => {
      if (clients.has(user)) {
        clients.get(user).delete(ws);
        if (clients.get(user).size === 0) clients.delete(user);
      }
      broadcastPresence();
    });
  });
}

module.exports = setupWebsocket;

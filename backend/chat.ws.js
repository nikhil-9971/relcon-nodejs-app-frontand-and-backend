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

function broadcastPresence() {
  // build list of currently online users
  const users = Array.from(clients.keys()).map((name) => ({
    name,
    online: true,
  }));

  const payload = {
    type: "presence",
    users,
  };

  for (const conns of clients.values()) {
    for (const s of conns) {
      if (s.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify(payload));
      }
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

    // Notify the new socket
    ws.send(
      JSON.stringify({
        type: "system",
        text: `✅ Connected as ${user}`,
      })
    );

    // Broadcast updated presence to everyone
    broadcastPresence();

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      // Client asking for current presence explicitly
      if (msg.type === "get_presence") {
        const users = Array.from(clients.keys()).map((name) => ({
          name,
          online: true,
        }));
        ws.send(
          JSON.stringify({
            type: "presence",
            users,
          })
        );
        return;
      }

      if (msg.type === "typing") {
        // Broadcast typing status to all except the sender
        const payload = {
          type: "typing",
          from: user,
        };

        for (const [username, conns] of clients.entries()) {
          if (username === user) continue;
          for (const s of conns) {
            if (s.readyState === WebSocket.OPEN)
              s.send(JSON.stringify(payload));
          }
        }

        return;
      }

      // 📦 Handle group chat
      if (msg.type === "group") {
        const messageDoc = await Chat.create({
          from: user,
          to: "group",
          roomId: "group",
          text: msg.text,
          delivered: true,
          read: false,
          replyTo: msg.replyTo || null, // 🟢 Save replyTo if it exists
        });

        const payloadMessage = {
          type: "group",
          from: user,
          text: msg.text,
          createdAt: messageDoc.createdAt,
          replyTo: msg.replyTo || null, // 🟢 Send to everyone
        };

        // 🚀 Broadcast to all users
        for (const conns of clients.values()) {
          for (const s of conns) {
            if (s.readyState === WebSocket.OPEN) {
              s.send(JSON.stringify(payloadMessage));
            }
          }
        }
      }
    });

    ws.on("close", () => {
      if (clients.has(user)) {
        clients.get(user).delete(ws);
        if (clients.get(user).size === 0) clients.delete(user);
      }
      // Update presence after someone disconnects
      broadcastPresence();
    });
  });
}

module.exports = setupWebsocket;

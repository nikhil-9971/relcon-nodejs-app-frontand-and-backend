// chat.ws.js
const WebSocket = require("ws");
const url = require("url");
const jwt = require("jsonwebtoken");
const Chat = require("./models/Chat"); // path adjust करो अगर अलग है

// JWT secret (environment variable से लो)
const JWT_SECRET = process.env.JWT_SECRET || "relcon-secret-key"; // replace/ensure it's same as auth

// In-memory map: username -> ws connection(s)
const clients = new Map();

function verifyToken(token) {
  try {
    return jwt.verify(token.replace(/^Bearer\s+/i, ""), JWT_SECRET);
  } catch (e) {
    return null;
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

    // Send welcome
    ws.send(
      JSON.stringify({
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
      // Expecting { to, text }
      const toUser = (msg.to || "").trim();
      const text = msg.text || "";
      if (!toUser || !text) return;

      // Persist
      const messageDoc = await Chat.create({
        from: user,
        to: toUser,
        text,
      });

      const payloadMessage = {
        from: user,
        to: toUser,
        text,
        timestamp: messageDoc.createdAt,
      };

      // Send to recipient if connected
      if (clients.has(toUser)) {
        for (const clientWs of clients.get(toUser)) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(payloadMessage));
          }
        }
      }

      // Echo to sender (in case UI wants confirmation)
      if (clients.has(user)) {
        for (const clientWs of clients.get(user)) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(payloadMessage));
          }
        }
      }
    });

    ws.on("close", () => {
      if (clients.has(user)) {
        clients.get(user).delete(ws);
        if (clients.get(user).size === 0) clients.delete(user);
      }
    });
  });
}

module.exports = setupWebsocket;

// corn.js
const cron = require("node-cron");
const fetch = require("node-fetch");
const Chat = require("../models/Chat");

const BASE_URL = "https://relcon-backend-jwt.onrender.com";

function startCronJobs(broadcastToAll) {
  // Run every day at 18:35 IST
  cron.schedule(
    "17 19 * * *",
    async () => {
      console.log("⏰ Running pending incidents cron job at 17:19 IST");

      try {
        const res = await fetch(`${BASE_URL}/getAllIncidents`);
        const result = await res.json();

        if (!result?.success) return;

        const pending = (result.incidents || []).filter(
          (i) => i.status === "Pending"
        );

        // Remove any previous system chatbot messages (keep only the latest each day)
        await Chat.deleteMany({
          roomId: "group",
          from: "🤖 Chatbot",
          system: true,
        });

        if (pending.length > 0) {
          // Build HTML table
          let tableHTML = `
            <table border="1" style="border-collapse: collapse; width: 100%; margin-top: 5px;">
              <thead>
                <tr style="background-color: #4CAF50; color: white; text-align: left;">
                  <th>RO Code</th>
                  <th>Site Name</th>
                  <th>Region</th>
                  <th>Incident ID</th>
                  <th>Incident Date</th>
                </tr>
              </thead>
              <tbody>
          `;

          for (const i of pending) {
            tableHTML += `
              <tr>
                <td>${i.roCode}</td>
                <td>${i.siteName}</td>
                <td>${i.region}</td>
                <td>${i.incidentId}</td>
                <td>${i.incidentDate}</td>
              </tr>`;
          }

          tableHTML += "</tbody></table>";

          // Save to DB as text (history-safe)
          const messageDoc = await Chat.create({
            from: "🤖 Chatbot",
            to: "group",
            roomId: "group",
            text: tableHTML, // store in text
            delivered: true,
            read: false,
            system: true,
          });

          // Broadcast as HTML so styling is preserved
          broadcastToAll({
            type: "group",
            from: "🤖 Chatbot",
            html: tableHTML,
            createdAt: messageDoc.createdAt,
          });
        } else {
          // Save + broadcast single "No pending..." message
          const messageDoc = await Chat.create({
            from: "🤖 Chatbot",
            to: "group",
            roomId: "group",
            text: "✅ No pending incidents today.",
            delivered: true,
            read: false,
            system: true,
          });

          broadcastToAll({
            type: "group",
            from: "🤖 Chatbot",
            text: "✅ No pending incidents today.",
            createdAt: messageDoc.createdAt,
          });
        }
      } catch (err) {
        console.error("❌ Cron job error:", err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
}

module.exports = { startCronJobs };

const cron = require("node-cron");
const fetch = require("node-fetch");
const Chat = require("../models/Chat"); // to save messages in DB

const BASE_URL = "https://relcon-backend-jwt.onrender.com";

function startCronJobs(broadcastToAll) {
  // Run every day at 16:40 IST
  cron.schedule(
    "21 17 * * *",
    async () => {
      console.log("⏰ Running pending incidents cron job at 16:40 IST");

      try {
        const res = await fetch(`${BASE_URL}/getAllIncidents`);
        const result = await res.json();

        if (result.success) {
          const pending = result.incidents.filter(
            (i) => i.status === "Pending"
          );

          if (pending.length > 0) {
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

            pending.forEach((i) => {
              tableHTML += `
                <tr>
                  <td>${i.roCode}</td>
                  <td>${i.siteName}</td>
                  <td>${i.region}</td>
                  <td>${i.incidentId}</td>
                  <td>${i.incidentDate}</td>
                </tr>`;
            });

            tableHTML += "</tbody></table>";

            // Save message in DB also
            await Chat.create({
              from: "🤖 Chatbot",
              to: "group",
              roomId: "group",
              text: tableHTML,
              delivered: true,
              read: false,
            });

            // Broadcast to all WS clients
            broadcastToAll({
              type: "group",
              from: "🤖 Chatbot",
              html: tableHTML,
              createdAt: new Date().toISOString(),
            });
          } else {
            broadcastToAll({
              type: "group",
              from: "🤖 Chatbot",
              text: "✅ No pending incidents today.",
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("❌ Cron job error:", err);
      }
    },
    {
      timezone: "Asia/Kolkata", // ✅ ensure Indian Standard Time
    }
  );
}

module.exports = { startCronJobs };

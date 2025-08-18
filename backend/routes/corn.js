// corn.js
const cron = require("node-cron");
const fetch = require("node-fetch");
const Chat = require("../models/Chat");
const { buildPendingReportsWorkbookBuffer } = require("../utils/pendingReports");
const { sendEmailWithAttachments } = require("../utils/mailer");

const BASE_URL = "https://relcon-backend-jwt.onrender.com";

function startCronJobs(broadcastToAll) {
  // Run every day at 19:30 IST
  cron.schedule(
    "30 19 * * *",
    async () => {
      console.log("⏰ Running pending incidents cron job at 19:30 IST");

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
          $or: [
            { system: true },
            { text: { $regex: /^\s*<table[\s\S]*<\/table>\s*$/i } },
          ],
        });

        if (pending.length > 0) {
          // Build HTML table with inline styles for consistent rendering
          const thStyle =
            "border: 1px solid #ccc; padding: 6px 8px; text-align: left; white-space: nowrap; background-color: #15803d; color: white;";
          const tdStyle =
            "border: 1px solid #ccc; padding: 6px 8px; text-align: left; white-space: nowrap;";

          let tableHTML = `
            <table style="border-collapse: collapse; width: 100%; margin-top: 5px; font-size: 12px;">
              <thead>
                <tr>
                  <th style="${thStyle}">RO Code</th>
                  <th style="${thStyle}">Site Name</th>
                  <th style="${thStyle}">Region</th>
                  <th style="${thStyle}">Incident ID</th>
                  <th style="${thStyle}">Incident Date</th>
                </tr>
              </thead>
              <tbody>
          `;

          for (const i of pending) {
            tableHTML += `
              <tr>
                <td style="${tdStyle}">${i.roCode}</td>
                <td style="${tdStyle}">${i.siteName}</td>
                <td style="${tdStyle}">${i.region}</td>
                <td style="${tdStyle}">${i.incidentId}</td>
                <td style="${tdStyle}">${i.incidentDate}</td>
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

  // 📧 Daily email: Pending Verify Status + JioBP Status as Excel (08:30 IST)
  cron.schedule(
    "30 8 * * *",
    async () => {
      try {
        const recipients = process.env.REPORT_RECIPIENTS || "";
        if (!recipients) {
          console.warn("[reports] REPORT_RECIPIENTS not set. Skipping email.");
          return;
        }

        const { buffer, counts } = await buildPendingReportsWorkbookBuffer();
        const subject = `Pending Verify & JioBP Status - ${new Date()
          .toISOString()
          .slice(0, 10)}`;
        const text = `Attached are the pending reports.\n\nVerify Status pending: ${counts.verify}\nJioBP Status pending: ${counts.jio}`;

        const result = await sendEmailWithAttachments({
          to: recipients,
          subject,
          text,
          attachments: [
            {
              filename: "PendingReports.xlsx",
              content: buffer,
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });

        if (result?.skipped) {
          console.warn("[reports] Email skipped due to missing SMTP configuration.");
        } else {
          console.log("[reports] Email sent.");
        }
      } catch (err) {
        console.error("❌ Reports cron error:", err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
}

module.exports = { startCronJobs };

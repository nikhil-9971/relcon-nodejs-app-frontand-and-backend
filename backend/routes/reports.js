const express = require("express");
const router = express.Router();
const { verifyToken } = require("./auth");
const { buildPendingReportsWorkbookBuffer } = require("../utils/pendingReports");
const { sendEmailWithAttachments } = require("../utils/mailer");

// GET /reports/pending.xlsx - download the workbook
router.get("/pending.xlsx", verifyToken, async (req, res) => {
  try {
    const { buffer } = await buildPendingReportsWorkbookBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=PendingReports.xlsx");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Error building report:", err);
    res.status(500).json({ error: "Failed to build report" });
  }
});

// POST /reports/send - emails the workbook
router.post("/send", verifyToken, async (req, res) => {
  try {
    const recipients = process.env.REPORT_RECIPIENTS || "";
    if (!recipients) {
      return res.status(400).json({ error: "REPORT_RECIPIENTS env not set" });
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

    res.json({ success: true, result, counts });
  } catch (err) {
    console.error("❌ Error sending report:", err);
    res.status(500).json({ error: "Failed to send report" });
  }
});

module.exports = router;
const express = require("express");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");

const router = express.Router();

router.post(
  "/contact",
  [
    body("message")
      .trim()
      .isLength({ min: 10 })
      .withMessage("Le message doit contenir au moins 10 caractères."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        errors: errors.array(),
      });
    }

    try {
      const { message } = req.body;

      const partnerEmail = req.user?.email;
      const partnerId = req.user?.id;

      if (!partnerEmail) {
        return res.status(401).json({
          ok: false,
          error: "Utilisateur non authentifié",
        });
      }

      console.log("📧 SUPPORT_EMAIL:", process.env.SUPPORT_EMAIL);
      console.log("🔑 SUPPORT_PASSWORD exists:", !!process.env.SUPPORT_PASSWORD);

      if (!process.env.SUPPORT_EMAIL || !process.env.SUPPORT_PASSWORD) {
        return res.status(500).json({
          ok: false,
          error: "Variables SMTP manquantes",
        });
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.SUPPORT_EMAIL,
          pass: process.env.SUPPORT_PASSWORD,
        },
      });

      // 🔥 Vérification connexion SMTP
      await transporter.verify();
      console.log("✅ SMTP Ready");

      await transporter.sendMail({
        from: `"Partner Support" <${process.env.SUPPORT_EMAIL}>`,
        to: process.env.SUPPORT_EMAIL,
        subject: `📩 Support - Partner ID ${partnerId}`,
        html: `
          <div style="font-family: Arial; line-height:1.6;">
            <h2>Nouveau message Support</h2>
            <p><strong>Partner ID:</strong> ${partnerId}</p>
            <p><strong>Email:</strong> ${partnerEmail}</p>
            <hr />
            <p><strong>Message :</strong></p>
            <p>${message.replace(/\n/g, "<br/>")}</p>
          </div>
        `,
      });

      console.log("📨 Mail envoyé avec succès");

      return res.json({ ok: true });
    } catch (err) {
      console.error("❌ SUPPORT ERROR:", err);
      return res.status(500).json({
        ok: false,
        error: "Erreur SMTP",
      });
    }
  }
);

module.exports = router;
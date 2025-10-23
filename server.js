// server.js — backend sécurisé + CORS + confirmation utilisateur

import express from "express";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors"; // ✅ Import CORS

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMAIL_TO = process.env.EMAIL_TO;
const EMAIL_FROM = process.env.EMAIL_FROM;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// ✅ Autoriser ton site à appeler le backend
app.use(
  cors({
    origin: [
      "https://atelier-lichen.fr", // ton site en production
      "https://chatbot-menuiserie-1.onrender.com", // ton Render
      "http://localhost:3000", // utile pour tester localement
    ],
  })
);

app.use(bodyParser.json());

// ✅ Configuration e-mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// ✅ Route principale : chatbot + mail
app.post("/api/chat", async (req, res) => {
  const messages = req.body.messages || [];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // modèle rapide et efficace
        messages,
      }),
    });

    const data = await response.json();

    if (!data.choices || !data.choices.length) {
      throw new Error("Aucune réponse du modèle OpenAI");
    }

    let reply = data.choices[0].message.content || "Une erreur est survenue.";

    // ✅ Ajout d’une phrase de remerciement personnalisée
    reply +=
      "\n\n🪵 Merci pour ces précisions, je vous recontacte rapidement pour échanger sur votre projet.";

    // ✅ Envoi du résumé par mail
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: "🪵 Nouveau brief client via le chatbot",
      text: `Résumé de la conversation :\n\n${messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}\n\nRéponse du chatbot :\n${reply}`,
    });

    // ✅ Envoi de la réponse à l’utilisateur
    res.json({ reply });
  } catch (err) {
    console.error("Erreur serveur GPT/chatbot :", err);
    res
      .status(500)
      .json({ error: "Erreur serveur — impossible de contacter le chatbot." });
  }
});

// ✅ Route test Render
app.get("/", (req, res) => {
  res.send("🚀 Le chatbot Menuiserie Lichen est en ligne et prêt à répondre !");
});

// ✅ Serveur en écoute
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Chatbot server running on port ${port}`);
});

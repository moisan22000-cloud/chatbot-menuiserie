// ==========================
// 🤖 Chatbot Atelier Lichen (version stable Render)
// ==========================

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { fileURLToPath } from "url";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERREUR : clé OpenAI manquante. Ajoute-la dans ton .env");
  console.error("OPENAI_API_KEY=sk-...");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  dest: path.join(process.cwd(), "tmp"),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.get("/", (_req, res) => {
  res.send("🚀 Chatbot Atelier Lichen : prêt à répondre !");
});

async function summarizeFile(file) {
  try {
    const filePath = file.path;

    if (file.mimetype.startsWith("text/")) {
      const content = fs.readFileSync(filePath, "utf8");
      return `📄 Fichier texte "${file.originalname}" : ${content.slice(0, 300)}...`;
    }

    if (file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return `📘 PDF "${file.originalname}" : ${data.text.slice(0, 300).replace(/\s+/g, " " )}...`;
    }

    if (file.mimetype.startsWith("image/")) {
      const stats = fs.statSync(filePath);
      return `🖼️ Image "${file.originalname}" (${Math.round(stats.size / 1024)} Ko, ${file.mimetype}) jointe.`;
    }

    return `📎 Fichier "${file.originalname}" (${file.mimetype}) joint.`;
  } catch (err) {
    console.error("⚠️ Impossible de lire le fichier", file.originalname, err.message);
    return `⚠️ Fichier "${file.originalname}" illisible.`;
  }
}

function isImageRequest(text = "") {
  const patterns = ["image", "rendu", "visualise", "illustration", "photo", "dessin", "aperçu"];
  return patterns.some((k) => text.toLowerCase().includes(k));
}

app.post("/api/chat", upload.array("files[]", 5), async (req, res) => {
  const cleanup = () => req.files?.forEach((file) => fs.unlink(file.path, () => {}));

  try {
    let messages = req.body.messages;
    if (typeof messages === "string") {
      try {
        messages = JSON.parse(messages);
      } catch (err) {
        console.error("⚠️ Impossible de parser les messages :", err.message);
        messages = [];
      }
    }
    messages = Array.isArray(messages) ? messages : [];

    const userMessage = messages[messages.length - 1]?.content || "";
    const fileSummaries = [];

    for (const file of req.files || []) {
      fileSummaries.push(await summarizeFile(file));
    }

    const context = [];
    if (fileSummaries.length) {
      context.push({
        role: "user",
        content: "Résumé des pièces jointes :\n" + fileSummaries.join("\n\n"),
      });
    }

    if (isImageRequest(userMessage)) {
      cleanup();
      return res.json({
        reply: "🛠️ Génération d'image non disponible sur ce point de terminaison.",
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Tu es Lichen, artisan menuisier-agenceur à Rennes. " +
            "Conseille avec précision, bienveillance et pragmatisme. " +
            "Pose des questions utiles et propose des pistes concrètes sur matériaux, budget et délais.",
        },
        ...messages,
        ...context,
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    const reply = completion.choices?.[0]?.message?.content || "(Pas de réponse)";
    res.json({ reply });
    cleanup();
  } catch (err) {
    console.error("🔥 Erreur serveur :", err.message);
    cleanup();
    res.status(500).json({ error: "Erreur serveur GPT : " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Serveur Atelier Lichen actif sur le port ${PORT}`);
});

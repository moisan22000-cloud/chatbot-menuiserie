import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import * as pdfParse from "pdf-parse"; // ✅ Import compatible ESM

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Config upload temporaire ===
const upload = multer({
  dest: "/tmp/",
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo max
});

// === Route test simple ===
app.get("/", (req, res) => {
  res.send("🚀 Le chatbot Menuiserie Lichen est en ligne et prêt à répondre !");
});

// === Fonction utilitaire pour décrire les fichiers ===
async function analyzeFile(filePath, mimetype, originalname) {
  try {
    if (mimetype.startsWith("text/") || mimetype.includes("json") || mimetype.includes("csv")) {
      const content = fs.readFileSync(filePath, "utf8");
      return `📄 Fichier texte "${originalname}" (${content.slice(0, 300)}...)`;
    }

    if (mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse.default(dataBuffer); // ✅ Appel correct
      const extract = data.text.slice(0, 300).replace(/\s+/g, " ");
      return `📘 PDF "${originalname}" — extrait: ${extract}...`;
    }

    if (mimetype.startsWith("image/")) {
      return `🖼️ Image "${originalname}" jointe (type ${mimetype})`;
    }

    return `📎 Fichier "${originalname}" (${mimetype}) joint.`;
  } catch (err) {
    console.error("Erreur analyse fichier:", err);
    return `📁 Fichier "${originalname}" joint (lecture impossible).`;
  }
}

// === Route principale du chatbot ===
app.post("/api/chat", upload.array("files[]", 5), async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const MODEL = process.env.MODEL || "gpt-5";
    if (!OPENAI_API_KEY) throw new Error("Clé API manquante");

    const rawMessages = req.body.messages ? JSON.parse(req.body.messages) : [];
    const files = req.files || [];

    // Analyse des fichiers joints
    const fileSummaries = [];
    for (const file of files) {
      const summary = await analyzeFile(file.path, file.mimetype, file.originalname);
      fileSummaries.push(summary);
    }

    // Prompt système : personnalité du conseiller Lichen
    const systemPrompt = {
      role: "system",
      content:
        "Tu es Lichen, un conseiller expert en menuiserie et agencement sur mesure, situé à Rennes. " +
        "Tu accompagnes les particuliers à décrire leurs projets (mobilier, dressing, agencement, matériaux, finitions) " +
        "et à comprendre la faisabilité technique et les étapes de conception. Sois clair, précis et bienveillant."
    };

    // Construit les messages à envoyer à GPT
    const messages = [systemPrompt, ...rawMessages];

    if (fileSummaries.length > 0) {
      messages.push({
        role: "user",
        content: "Voici les fichiers que j’ai joints :\n" + fileSummaries.join("\n\n"),
      });
    }

    // Appel OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
      }),
    });

    const data = await response.json();

    // Nettoyage des fichiers temporaires
    for (const file of files) {
      fs.unlink(file.path, () => {});
    }

    // Vérifie la réponse
    const reply = data?.choices?.[0]?.message?.content || "Désolé, je n’ai pas pu formuler de réponse.";
    res.json({ reply });

  } catch (err) {
    console.error("Erreur serveur GPT/chatbot :", err);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

// === Lancement du serveur ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Serveur chatbot actif sur le port ${PORT}`));

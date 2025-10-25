import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import * as pdfParse from "pdf-parse";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Upload temporaire (Render supporte /tmp) ===
const upload = multer({
  dest: "/tmp/",
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo max
});

// === Test route ===
app.get("/", (req, res) => {
  res.send("🚀 Chatbot Atelier Lichen actif — texte + images + fichiers prêts !");
});

// === Analyse des fichiers joints ===
async function analyzeFile(filePath, mimetype, originalname) {
  try {
    if (mimetype.startsWith("text/") || mimetype.includes("json") || mimetype.includes("csv")) {
      const content = fs.readFileSync(filePath, "utf8");
      return `📄 Fichier texte "${originalname}" (${content.slice(0, 300)}...)`;
    }

    if (mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse.default(dataBuffer);
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

// === Détection si le message demande une image ===
function wantsImage(text) {
  if (!text) return false;
  const keywords = [
    "image", "rendu", "visualise", "montre", "dessin", "illustration",
    "photo", "représentation", "aperçu", "inspire-moi", "peux-tu me montrer"
  ];
  return keywords.some(k => text.toLowerCase().includes(k));
}

// === ROUTE PRINCIPALE ===
app.post("/api/chat", upload.array("files[]", 5), async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const MODEL_TEXT = process.env.MODEL || "gpt-5";
  const MODEL_IMAGE = "gpt-image-1";

  try {
    if (!OPENAI_API_KEY) throw new Error("Clé API OpenAI manquante");

    const rawMessages = req.body.messages ? JSON.parse(req.body.messages) : [];
    const userMessage = rawMessages[rawMessages.length - 1]?.content || "";
    const files = req.files || [];

    // Analyse des fichiers
    const fileSummaries = [];
    for (const file of files) {
      const summary = await analyzeFile(file.path, file.mimetype, file.originalname);
      fileSummaries.push(summary);
    }

    // Supprime les fichiers en fin de traitement
    const cleanupFiles = () => {
      for (const file of files) fs.unlink(file.path, () => {});
    };

    // === Cas 1 : le user demande une image ===
    if (wantsImage(userMessage)) {
      const prompt = `${userMessage} — style photo réaliste, design sobre, matériaux naturels, lumière douce, inspiration Atelier Lichen (menuiserie, bois, agencement sur mesure).`;

      const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL_IMAGE,
          prompt,
          size: "1024x1024",
          n: 1
        })
      });

      const imageData = await imageResponse.json();
      cleanupFiles();

      if (imageData?.data?.[0]?.url) {
        return res.json({
          reply: "Voici une proposition visuelle inspirée de votre demande 👇",
          imageUrl: imageData.data[0].url
        });
      } else {
        return res.json({ reply: "Je n’ai pas pu générer d’image pour cette demande." });
      }
    }

    // === Cas 2 : simple réponse texte ===
    const systemPrompt = {
      role: "system",
      content:
        "Tu es Lichen, un conseiller expert en menuiserie et agencement sur mesure, basé à Rennes. " +
        "Tu aides les particuliers à formuler leur projet, à comprendre les matériaux (chêne, frêne, bouleau...), " +
        "et à visualiser les solutions possibles. Sois clair, précis, chaleureux et professionnel."
    };

    const messages = [systemPrompt, ...rawMessages];

    if (fileSummaries.length > 0) {
      messages.push({
        role: "user",
        content: "Voici les fichiers que j’ai joints :\n" + fileSummaries.join("\n\n")
      });
    }

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_TEXT,
        messages
      })
    });

    const data = await chatResponse.json();
    cleanupFiles();

    const reply = data?.choices?.[0]?.message?.content || "Désolé, je n’ai pas pu formuler de réponse.";
    res.json({ reply });

  } catch (err) {
    console.error("Erreur serveur :", err);
    res.status(500).json({ error: "Erreur interne du serveur GPT" });
  }
});

// === Lancement du serveur ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Serveur Lichen actif sur le port ${PORT}`));

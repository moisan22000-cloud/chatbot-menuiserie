// ==========================
// 🤖 Chatbot Atelier Lichen
// ==========================

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse"); // ✅ compatible ESM + CommonJS

dotenv.config();

// ===== Vérification de la clé API =====
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERREUR : clé OpenAI manquante. Ajoute-la dans ton .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

// ===== CORS autorisé =====
app.use(
  cors({
    origin: [
      "https://menuiserie-lichen.fr",
      "https://www.menuiserie-lichen.fr",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const upload = multer({
  dest: path.join(process.cwd(), "tmp"),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.get("/", (_req, res) => {
  res.send("🚀 Chatbot Atelier Lichen : prêt à répondre !");
});

// ======== 🧠 Analyse des fichiers joints ========

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
      return `📘 PDF "${file.originalname}" : ${data.text
        .slice(0, 300)
        .replace(/\s+/g, " ")}...`;
    }
    if (file.mimetype.startsWith("image/")) {
      const stats = fs.statSync(filePath);
      return `🖼️ Image "${file.originalname}" (${Math.round(
        stats.size / 1024
      )} Ko, ${file.mimetype}) jointe.`;
    }
    return `📎 Fichier "${file.originalname}" (${file.mimetype}) joint.`;
  } catch (err) {
    console.error("⚠️ Impossible de lire le fichier", file.originalname, err.message);
    return `⚠️ Fichier "${file.originalname}" illisible.`;
  }
}

function isImageRequest(text = "") {
  const patterns = [
    "image",
    "rendu",
    "visualise",
    "illustration",
    "photo",
    "dessin",
    "aperçu"
  ];
  return patterns.some((k) => text.toLowerCase().includes(k));
}

// ======== 🤖 Route principale du chatbot ========

app.post("/api/chat", upload.array("files[]", 5), async (req, res) => {
  const cleanup = () =>
    req.files?.forEach((file) => fs.unlink(file.path, () => {}));

  try {
    let messages = req.body.messages;
    if (typeof messages === "string") {
      try {
        messages = JSON.parse(messages);
      } catch {
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
        content: "Résumé des pièces jointes :\n" + fileSummaries.join("\n\n")
      });
    }

    // ======== 🔍 Analyse d’image jointe ========
    const hasImage = (req.files || []).some(f => f.mimetype.startsWith("image/"));
    if (hasImage && /agencement|rendu|meuble|aménagement|décor/i.test(userMessage)) {
      try {
        const file = req.files[0];
        const imageBuffer = fs.readFileSync(file.path);
        const imageBase64 = imageBuffer.toString("base64");

        const completion = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Tu es Lichen, artisan menuisier-agenceur à Rennes. " +
                "Tu conseilles avec réalisme sur les matériaux, la disposition, les teintes et le style. " +
                "Quand on t’envoie une photo, décris la pièce et propose un agencement réaliste."
            },
            {
              role: "user",
              content: [
                { type: "text", text: userMessage },
                { type: "image_url", image_url: `data:image/jpeg;base64,${imageBase64}` }
              ]
            }
          ],
          temperature: 0.7,
          max_tokens: 700
        });

        const reply = completion.choices?.[0]?.message?.content || "Aucune idée d’agencement trouvée.";
        cleanup();
        return res.json({ reply });
      } catch (err) {
        console.error("⚠️ Erreur analyse image :", err.message);
        cleanup();
        return res.json({
          reply: "⚠️ Impossible d’analyser l’image pour le moment.",
          error: err.message
        });
      }
    }

// ======== 🧠 Lecture et analyse d’image utilisateur ========
const hasImage = (req.files || []).some(f => f.mimetype.startsWith("image/"));

if (hasImage) {
  try {
    // On récupère la première image (tu peux itérer sur plusieurs)
    const file = req.files[0];
    const imageBuffer = fs.readFileSync(file.path);
    const imageBase64 = imageBuffer.toString("base64");

    // 🔸 Étape 1 : comprendre la photo et proposer un agencement
    const visionResponse = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Tu es Lichen, artisan menuisier-agenceur à Rennes. " +
            "Quand on t’envoie une photo, analyse la pièce (style, matériaux, lumière, teintes) " +
            "et propose un agencement de mobilier réaliste et esthétique qui s’intègre à la photo."
        },
        {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            { type: "image_url", image_url: `data:image/jpeg;base64,${imageBase64}` }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const visionReply = visionResponse.choices?.[0]?.message?.content || "Aucune suggestion trouvée.";

    // 🔸 Étape 2 : générer un rendu visuel intégré (facultatif)
    const renderPrompt = `Intègre à cette photo un agencement réaliste selon la description suivante : ${visionReply}`;
    const renderImage = await client.images.generate({
      model: "gpt-image-1",
      prompt: renderPrompt,
      size: "1024x1024"
    });

    const imageUrl = renderImage.data?.[0]?.url || null;

    cleanup();
    return res.json({
      reply: visionReply,
      imageUrl
    });
  } catch (err) {
    console.error("⚠️ Erreur lecture ou génération image :", err.message);
    cleanup();
    return res.json({
      reply: "⚠️ Impossible d’analyser ou de générer l’image.",
      error: err.message
    });
  }
}


    // ======== 🎨 Génération d’image (rendu) ========
    if (isImageRequest(userMessage)) {
      try {
        const image = await client.images.generate({
          model: "gpt-image-1",
          prompt: userMessage,
          size: "1024x1024"
        });

        const data = image.data?.[0] || {};
        const imageUrl =
          data.url ||
          (data.b64_json ? `data:image/png;base64,${data.b64_json}` : null);

        cleanup();

        if (imageUrl) {
          return res.json({
            reply: "🖼️ Voici une image générée selon ta demande :",
            imageUrl
          });
        } else {
          console.error("⚠️ OpenAI n'a renvoyé ni URL ni base64 :", image);
          return res.json({
            reply:
              "⚠️ L'image a été générée mais aucun lien n'a été renvoyé par OpenAI."
          });
        }
      } catch (err) {
        console.error("⚠️ Erreur génération image :", err.message);
        cleanup();
        return res.json({
          reply: "⚠️ Erreur pendant la génération d'image. Réessaie plus tard.",
          error: err.message
        });
      }
    }

    // ======== 💬 Réponse textuelle classique ========
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es Lichen, artisan menuisier-agenceur à Rennes. " +
            "Conseille avec précision, bienveillance et pragmatisme. " +
            "Pose des questions utiles et propose des pistes concrètes sur matériaux, budget et délais."
        },
        ...messages,
        ...context
      ],
      temperature: 0.7,
      max_tokens: 700
    });

    const reply =
      completion.choices?.[0]?.message?.content || "(Pas de réponse)";
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

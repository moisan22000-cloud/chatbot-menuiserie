import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Route racine : test simple
app.get("/", (req, res) => {
  res.send("🚀 Le chatbot Menuiserie Lichen est en ligne et prêt à répondre !");
});

// ✅ Route API principale
app.post("/api/chat", async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error("Clé API manquante");

    const MODEL = process.env.MODEL || "gpt-5";

    const messages = req.body.messages || [];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "Aucune réponse reçue.";
    res.json({ reply });
  } catch (err) {
    console.error("Erreur serveur GPT/chatbot :", err);
    res.status(500).json({ error: "Erreur serveur GPT/chatbot" });
  }
});

// ✅ Port pour Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Serveur chatbot en ligne sur le port ${PORT}`));

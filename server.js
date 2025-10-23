import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMAIL_TO = process.env.EMAIL_TO;
const EMAIL_FROM = process.env.EMAIL_FROM;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

app.use(cors()); // Autorise toutes les origines
app.use(bodyParser.json());

// Transport d’e‑mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Chatbot route
app.post('/api/chat', async (req, res) => {
  const messages = req.body.messages || [];

  const fullMessages = [
    { role: 'system', content: "Tu es un assistant spécialisé en menuiserie, à l'écoute du client pour comprendre son projet." },
    ...messages
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: fullMessages,
      }),
    });

    const data = await response.json();
    console.log('Réponse OpenAI brute :', JSON.stringify(data));

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("Aucune réponse du modèle OpenAI");
    }

    // Envoi de mail au menuisier
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: '🪵 Nouveau message via le chatbot',
      text: `Résumé de la conversation :\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
    });

    res.json({ reply });
  } catch (err) {
    console.error('Erreur serveur GPT/chatbot :', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de test pour Render
app.get('/', (req, res) => {
  res.send('🚀 Le chatbot Menuiserie Lichen est en ligne et prêt à répondre !');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Serveur chatbot lancé sur le port ${port}`);
});

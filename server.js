// server.js — Node.js backend sécurisé

import express from 'express';
import bodyParser from 'body-parser';
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

app.use(bodyParser.json());

// Configure l’envoi d’email
const transporter = nodemailer.createTransport({
  service: 'gmail', // Ou un autre provider SMTP
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Route pour le chatbot
app.post('/api/chat', async (req, res) => {
  const messages = req.body.messages || [];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages,
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Une erreur est survenue';

    // Envoi par mail
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: '🪵 Nouveau brief client via le chatbot',
      text: `Résumé de la conversation :\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
    });

    res.json({ reply });
  } catch (err) {
    console.error('Erreur serveur GPT/chatbot :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de test pour Render
app.get('/', (req, res) => {
  res.send('Le chatbot est en ligne 🚀');
});

app.listen(port, () => {
  console.log(`Chatbot server running on port ${port}`);
});

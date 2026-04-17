import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import {
  SALES_LINKS,
  getOrCreateUser,
  updateUserFacts,
  buildSystemPrompt,
  applyModelOutput,
  isDirectPriceIntent,
  isDirectBasicIntent,
  isDirectPremiumIntent,
  isHesitationIntent,
  buildDirectPriceReply,
  buildBasicLinkReply,
  buildPremiumLinkReply,
  buildHesitationReply
} from "./agent.js";

dotenv.config();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// memória simples em RAM
const memory = {};

// ==============================
// utilidades
// ==============================
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeText(text) {
  return (text || "").trim().toLowerCase();
}

async function sendWhatsAppText(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

async function generateAgentReply(user, originalText) {
  const systemPrompt = buildSystemPrompt(user);

  const messages = [
    { role: "system", content: systemPrompt },
    ...user.historico.slice(-8),
    { role: "user", content: originalText }
  ];

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data?.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(content);

  if (!parsed?.reply) {
    return {
      reply: "Entendi. Me conta só mais uma coisa: isso é algo pontual ou já vem se repetindo na sua vida?",
      stage: "investigacao",
      suggested_product: "none",
      capture: {}
    };
  }

  return parsed;
}

// ==============================
// verificação do webhook
// ==============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ==============================
// recebimento de mensagens
// ==============================
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!msg) {
      return res.sendStatus(200);
    }

    if (msg.type !== "text") {
      await sendWhatsAppText(
        msg.from,
        "No momento eu consigo te atender melhor por mensagem de texto. Me conta em poucas palavras o que você está vivendo hoje."
      );
      return res.sendStatus(200);
    }

    const from = msg.from;
    const originalText = msg.text?.body || "";
    const text = normalizeText(originalText);

    const user = getOrCreateUser(memory, from);
    updateUserFacts(user, originalText);

    let reply = "";

    if (isDirectPriceIntent(text)) {
      reply = buildDirectPriceReply(user);
    } else if (isDirectBasicIntent(text)) {
      reply = buildBasicLinkReply(user);
    } else if (isDirectPremiumIntent(text)) {
      reply = buildPremiumLinkReply(user);
    } else if (isHesitationIntent(text)) {
      reply = buildHesitationReply();
    } else {
      const modelOutput = await generateAgentReply(user, originalText);
      applyModelOutput(user, modelOutput);

      reply = modelOutput.reply;

      if (
        user.stage === "oferta" &&
        user.produto_sugerido === "premium" &&
        !reply.toLowerCase().includes("premium")
      ) {
        reply += `

Pelo que você me trouxe até aqui, o formato que mais faz sentido para você é o Neuroprime Premium — justamente por trabalhar dores mais profundas e repetitivas.`;
      }

      if (
        user.stage === "oferta" &&
        user.produto_sugerido === "basic" &&
        !reply.toLowerCase().includes("basic")
      ) {
        reply += `

Pelo que você me trouxe, o formato mais adequado para este momento tende a ser o Neuroprime Basic.`;
      }

      if (
        user.stage === "fechamento" &&
        user.produto_sugerido === "premium"
      ) {
        reply += `

Se você sentir que é o momento, esse é o link para iniciar:
${SALES_LINKS.premium}`;
      }

      if (
        user.stage === "fechamento" &&
        user.produto_sugerido === "basic"
      ) {
        reply += `

Se fizer sentido para você iniciar agora, esse é o link:
${SALES_LINKS.basic}`;
      }

      if (
        !reply.toLowerCase().includes("instagram") &&
        text.includes("instagram")
      ) {
        reply += `

Você também pode conhecer mais do trabalho aqui:
${SALES_LINKS.instagram}`;
      }
    }

    user.historico.push({ role: "assistant", content: reply });
    if (user.historico.length > 12) {
      user.historico = user.historico.slice(-12);
    }

    await sendWhatsAppText(from, reply);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook:", error.response?.data || error.message);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
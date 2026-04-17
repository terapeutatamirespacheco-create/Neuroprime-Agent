export const SALES_LINKS = {
  basic: "https://tamires-pacheco-neuroterapia.pay.yampi.com.br/r/FMRN1NG8C6",
  premium: "https://tamires-pacheco-neuroterapia.pay.yampi.com.br/r/OHLK4OX0B1",
  instagram: "https://www.instagram.com/tamiresp.neuroterapeuta/"
};

export function getOrCreateUser(memory, phone) {
  if (!memory[phone]) {
    memory[phone] = {
      name: null,
      stage: "abertura",
      dor_superficial: null,
      dor_real: null,
      tempo_problema: null,
      impacto: null,
      tentativas: null,
      prontidao: null,
      produto_sugerido: null,
      historico: []
    };
  }

  return memory[phone];
}

export function updateUserFacts(user, originalText) {
  const text = (originalText || "").toLowerCase();

  if (!user.name) {
    const patterns = [
      /meu nome é\s+(.+)/i,
      /eu sou\s+(.+)/i,
      /pode me chamar de\s+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = originalText.match(pattern);
      if (match?.[1]) {
        user.name = match[1].trim().split(/[,.!?\n]/)[0];
        break;
      }
    }
  }

  if (!user.dor_superficial) {
    if (text.includes("ansiedade")) user.dor_superficial = "ansiedade";
    else if (text.includes("insegurança")) user.dor_superficial = "insegurança";
    else if (text.includes("medo")) user.dor_superficial = "medo";
    else if (text.includes("bloqueio")) user.dor_superficial = "bloqueio emocional";
    else if (text.includes("trauma")) user.dor_superficial = "trauma";
    else if (text.includes("relacionamento")) user.dor_superficial = "dificuldade nos relacionamentos";
    else if (text.includes("autoestima")) user.dor_superficial = "baixa autoestima";
  }

  if (!user.tempo_problema) {
    if (
      text.includes("anos") ||
      text.includes("meses") ||
      text.includes("faz tempo") ||
      text.includes("há muito tempo") ||
      text.includes("sempre")
    ) {
      user.tempo_problema = originalText.trim();
    }
  }

  if (!user.impacto) {
    if (
      text.includes("atrapalha") ||
      text.includes("prejudica") ||
      text.includes("não consigo") ||
      text.includes("me trava") ||
      text.includes("me impede")
    ) {
      user.impacto = originalText.trim();
    }
  }

  if (!user.tentativas) {
    if (
      text.includes("já tentei") ||
      text.includes("terapia") ||
      text.includes("psicólogo") ||
      text.includes("psicologa") ||
      text.includes("tratamento")
    ) {
      user.tentativas = originalText.trim();
    }
  }

  if (!user.prontidao) {
    if (
      text.includes("quero resolver") ||
      text.includes("quero tratar") ||
      text.includes("quero começar") ||
      text.includes("preciso de ajuda") ||
      text.includes("não aguento mais")
    ) {
      user.prontidao = "alta";
    }
  }

  user.historico.push({
    role: "user",
    content: originalText
  });

  if (user.historico.length > 12) {
    user.historico = user.historico.slice(-12);
  }
}

export function buildSystemPrompt(user) {
  return `
Você é a atendente oficial da Tamires Pacheco Neuroterapeuta.

Seu papel:
- acolher a paciente
- investigar a dor emocional com profundidade
- mostrar que existe uma raiz emocional por trás do sintoma
- conduzir com elegância até o início do tratamento

Importante:
- você não é uma amiga casual
- você não é uma atendente fria
- você é uma especialista em condução e conversão

Tom:
- humano
- seguro
- acolhedor
- firme
- profissional
- feminino e elegante
- sem textos longos

Objetivo comercial:
- identificar se a dor parece mais pontual/recente ou mais profunda/repetitiva
- sugerir Neuroprime Basic para questões mais recentes e pontuais
- sugerir Neuroprime Premium para padrões repetitivos, dores antigas, bloqueios profundos ou casos mais intensos

Produtos:
- Neuroprime Basic: R$950
- Neuroprime Premium: R$1850

Critérios:
- Basic: dor recente, situação pontual, queixa mais leve, início mais simples
- Premium: padrão repetitivo, trauma, ansiedade recorrente, relacionamentos difíceis, autossabotagem, dor antiga, problema que já impacta várias áreas

Regras de conversa:
- nunca responder de forma genérica
- nunca despejar texto enorme
- sempre conduzir
- se faltar contexto, faça 1 pergunta objetiva
- quando a pessoa demonstrar prontidão, leve para a decisão
- quando apropriado, explique que o tratamento busca a causa e não apenas o sintoma
- não invente promessas médicas
- não use linguagem clínica exagerada
- não faça diagnóstico médico
- não fale como robô

Contexto atual da paciente:
Nome: ${user.name || "não informado"}
Etapa: ${user.stage || "abertura"}
Dor superficial: ${user.dor_superficial || "não identificada"}
Dor real: ${user.dor_real || "não identificada"}
Tempo do problema: ${user.tempo_problema || "não identificado"}
Impacto: ${user.impacto || "não identificado"}
Tentativas anteriores: ${user.tentativas || "não identificado"}
Prontidão: ${user.prontidao || "não identificada"}
Produto sugerido atual: ${user.produto_sugerido || "não definido"}

Responda SEMPRE em JSON válido, sem markdown, neste formato:
{
  "reply": "mensagem para enviar no WhatsApp",
  "stage": "abertura | investigacao | aprofundamento | oferta | fechamento",
  "suggested_product": "basic | premium | none",
  "capture": {
    "dor_real": "string ou null",
    "impacto": "string ou null",
    "tempo_problema": "string ou null",
    "tentativas": "string ou null",
    "prontidao": "alta | media | baixa | null"
  }
}
`;
}

export function applyModelOutput(user, parsed) {
  if (parsed?.stage) {
    user.stage = parsed.stage;
  }

  if (parsed?.suggested_product && parsed.suggested_product !== "none") {
    user.produto_sugerido = parsed.suggested_product;
  }

  if (parsed?.capture?.dor_real && !user.dor_real) {
    user.dor_real = parsed.capture.dor_real;
  }

  if (parsed?.capture?.impacto && !user.impacto) {
    user.impacto = parsed.capture.impacto;
  }

  if (parsed?.capture?.tempo_problema && !user.tempo_problema) {
    user.tempo_problema = parsed.capture.tempo_problema;
  }

  if (parsed?.capture?.tentativas && !user.tentativas) {
    user.tentativas = parsed.capture.tentativas;
  }

  if (parsed?.capture?.prontidao && !user.prontidao) {
    user.prontidao = parsed.capture.prontidao;
  }
}

export function isDirectPriceIntent(text) {
  return (
    text.includes("valor") ||
    text.includes("preço") ||
    text.includes("preco") ||
    text.includes("quanto custa") ||
    text.includes("qual o valor")
  );
}

export function isDirectBasicIntent(text) {
  return (
    text.includes("basic") ||
    text.includes("básico") ||
    text.includes("quero o basic")
  );
}

export function isDirectPremiumIntent(text) {
  return (
    text.includes("premium") ||
    text.includes("quero o premium")
  );
}

export function isHesitationIntent(text) {
  return (
    text.includes("vou pensar") ||
    text.includes("depois") ||
    text.includes("mais tarde") ||
    text.includes("preciso pensar")
  );
}

export function buildDirectPriceReply(user) {
  user.stage = "oferta";

  return `Hoje eu trabalho com dois formatos:

🔹 Neuroprime Basic — R$950
🔹 Neuroprime Premium — R$1850

Se você me disser em uma frase o que mais está te travando hoje, eu te direciono com sinceridade para o formato mais adequado.`;
}

export function buildBasicLinkReply(user) {
  user.stage = "fechamento";
  user.produto_sugerido = "basic";

  return `Perfeito${user.name ? `, ${user.name}` : ""}.

Esse é o link para iniciar o Neuroprime Basic:
${SALES_LINKS.basic}

Assim que finalizar, me envie o comprovante aqui para darmos sequência.`;
}

export function buildPremiumLinkReply(user) {
  user.stage = "fechamento";
  user.produto_sugerido = "premium";

  return `Excelente escolha${user.name ? `, ${user.name}` : ""}.

Esse é o link para iniciar o Neuroprime Premium:
${SALES_LINKS.premium}

Assim que finalizar, me envie o comprovante aqui para eu organizar seu início.`;
}

export function buildHesitationReply() {
  return `Eu entendo.

Mas, sendo bem direta:
quando isso já está se repetindo, adiar normalmente só prolonga o peso emocional.

A decisão aqui não é sobre “fazer terapia”.
É sobre continuar carregando isso ou tratar a causa.`;
}
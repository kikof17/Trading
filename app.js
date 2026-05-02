const STORAGE_KEY = "xauusd-trading-planner-v1";
const AI_STORAGE_KEY = "xauusd-trading-planner-ai-v1";

const strategyProfiles = {
  scalping: {
    title: "Plan scalping",
    focus: "zone M5/M15, confirmation M1/M3, réaction rapide",
    riskLabel: "0,25 % à 0,5 %",
    ratioMin: 1.5,
    prompts: {
      context: "Identifier un support/résistance intraday, une prise de liquidité ou un breakout-retest très propre.",
      validation: "Chercher mèche de rejet, clôture de réintégration, MSS M1/M3, puis retest ou FVG.",
      management: "Sortie partielle sur premier sommet/creux M1-M5, BE seulement après vraie avancée."
    }
  },
  intraday: {
    title: "Plan intraday",
    focus: "biais Daily/H4, exécution H1/M15/M5, mouvement de session",
    riskLabel: "0,5 % à 1 %",
    ratioMin: 2,
    prompts: {
      context: "Commencer par le biais Daily/H4 puis marquer high/low veille, high/low asiatique, open daily et zones H1/M15.",
      validation: "Attendre une prise de liquidité ou un retest propre, puis un MSS M15/M5 avec rejet confirmé.",
      management: "Prise partielle sur open daily ou premier niveau de liquidité, sortie avant changement de régime de session."
    }
  },
  swing: {
    title: "Plan swing",
    focus: "structure Weekly/Daily, timing H4/H1, logique macro-technique",
    riskLabel: "0,5 % à 1,5 %",
    ratioMin: 2.5,
    prompts: {
      context: "Partir de la tendance Weekly/Daily, des zones historiques, du retracement et du contexte macro.",
      validation: "Chercher un rejet H4/Daily, une cassure de structure, puis un pullback confirmé.",
      management: "Gérer sur clôtures H4/Daily, ne pas serrer le stop comme un scalp, laisser vivre tant que la structure tient."
    }
  }
};

const state = loadState();
const previewTemplate = document.getElementById("previewItemTemplate");

initializeTabs();
initializeOverview();
initializeForms();
initializeAiConfig();
hydrateUi();

function loadState() {
  const fallback = {
    overview: {
      capital: "",
      price: "",
      sessionNote: ""
    },
    plans: {
      scalping: emptyPlanState(),
      intraday: emptyPlanState(),
      swing: emptyPlanState()
    }
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    return mergeState(fallback, JSON.parse(raw));
  } catch (error) {
    console.error("State load failed", error);
    return fallback;
  }
}

function mergeState(baseState, savedState) {
  return {
    overview: {
      ...baseState.overview,
      ...(savedState?.overview || {})
    },
    plans: {
      scalping: {
        ...baseState.plans.scalping,
        ...(savedState?.plans?.scalping || {})
      },
      intraday: {
        ...baseState.plans.intraday,
        ...(savedState?.plans?.intraday || {})
      },
      swing: {
        ...baseState.plans.swing,
        ...(savedState?.plans?.swing || {})
      }
    }
  };
}

function emptyPlanState() {
  return {
    fields: {},
    images: [],
    resultHtml: ""
  };
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initializeTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-content");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      buttons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.content === tab);
      });
    });
  });
}

function initializeOverview() {
  document.getElementById("saveOverview").addEventListener("click", () => {
    state.overview.capital = document.getElementById("capital").value;
    state.overview.price = document.getElementById("price").value;
    state.overview.sessionNote = document.getElementById("sessionNote").value.trim();
    persistState();
    showFeedback("saveFeedback", "Contexte général enregistré.");
    rerenderResults();
  });
}

function initializeAiConfig() {
  const saved = loadAiConfig();
  document.getElementById("apiEndpoint").value = saved.endpoint || "https://api.openai.com/v1/responses";
  document.getElementById("apiKey").value = saved.apiKey || "";
  document.getElementById("apiModel").value = saved.model || "gpt-4.1-mini";

  document.getElementById("saveAiConfig").addEventListener("click", () => {
    const config = {
      endpoint: document.getElementById("apiEndpoint").value.trim(),
      apiKey: document.getElementById("apiKey").value.trim(),
      model: document.getElementById("apiModel").value.trim()
    };
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(config));
    showFeedback("aiFeedback", "Configuration IA sauvegardée localement.");
  });

  document.querySelectorAll(".ai-runner").forEach((button) => {
    button.addEventListener("click", () => runAiAnalysis(button.dataset.plan));
  });
}

function loadAiConfig() {
  try {
    return JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || "{}");
  } catch (error) {
    console.error("AI config load failed", error);
    return {};
  }
}

function initializeForms() {
  document.querySelectorAll(".analysis-form").forEach((form) => {
    const planName = form.dataset.plan;
    const uploadZone = form.querySelector(".upload-zone");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveFormState(form, planName);
      generateLocalAnalysis(planName);
    });

    form.querySelector(".save-plan").addEventListener("click", () => {
      saveFormState(form, planName);
      showFeedback("saveFeedback", `Onglet ${planName} sauvegardé.`);
    });

    form.querySelector(".clear-images").addEventListener("click", () => {
      state.plans[planName].images = [];
      persistState();
      hydratePlan(planName);
    });

    form.addEventListener("paste", async (event) => {
      const pastedFiles = extractPastedImages(event.clipboardData);
      if (!pastedFiles.length) {
        return;
      }

      event.preventDefault();
      await appendFilesToPlan(planName, pastedFiles);
      hydratePlan(planName);
    });

    form.querySelector(".image-input").addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) {
        return;
      }

      await appendFilesToPlan(planName, files);
      hydratePlan(planName);
      event.target.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.add("drag-over");
      });
    });

    ["dragleave", "dragend", "drop"].forEach((eventName) => {
      uploadZone.addEventListener(eventName, () => {
        uploadZone.classList.remove("drag-over");
      });
    });

    uploadZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) {
        return;
      }

      await appendFilesToPlan(planName, files);
      hydratePlan(planName);
    });
  });
}

function extractPastedImages(clipboardData) {
  return Array.from(clipboardData?.items || [])
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

async function appendFilesToPlan(planName, files) {
  const images = await Promise.all(
    files.map(async (file, index) => ({
      name: file.name || `capture-${Date.now()}-${index + 1}.png`,
      dataUrl: await readFileAsDataUrl(file)
    }))
  );

  state.plans[planName].images = [...state.plans[planName].images, ...images].slice(-10);
  persistState();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function saveFormState(form, planName) {
  const formData = new FormData(form);
  const fields = {};

  formData.forEach((value, key) => {
    if (key !== "images") {
      fields[key] = String(value).trim();
    }
  });

  state.plans[planName].fields = fields;
  persistState();
}

function hydrateUi() {
  document.getElementById("capital").value = state.overview.capital || "";
  document.getElementById("price").value = state.overview.price || "";
  document.getElementById("sessionNote").value = state.overview.sessionNote || "";

  Object.keys(state.plans).forEach(hydratePlan);
}

function hydratePlan(planName) {
  const plan = state.plans[planName];
  const form = document.querySelector(`.analysis-form[data-plan="${planName}"]`);
  const preview = document.querySelector(`[data-preview="${planName}"]`);
  const result = document.querySelector(`[data-result="${planName}"]`);

  Object.entries(plan.fields).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });

  renderPreview(preview, plan.images);
  result.innerHTML = plan.resultHtml || `<p>Le ${planName} apparaîtra ici.</p>`;
}

function renderPreview(container, images) {
  container.innerHTML = "";

  images.forEach((image, index) => {
    const fragment = previewTemplate.content.cloneNode(true);
    const img = fragment.querySelector("img");
    const caption = fragment.querySelector("figcaption");
    img.src = image.dataUrl;
    caption.textContent = `${index + 1}. ${image.name}`;
    container.appendChild(fragment);
  });
}

function generateLocalAnalysis(planName) {
  const planState = state.plans[planName];
  const profile = strategyProfiles[planName];
  const capital = Number.parseFloat(state.overview.capital) || 0;
  const livePrice = Number.parseFloat(state.overview.price) || 0;
  const entry = Number.parseFloat(planState.fields.entry) || 0;
  const stop = Number.parseFloat(planState.fields.stop) || 0;
  const target = Number.parseFloat(planState.fields.target) || 0;
  const riskPercent = Number.parseFloat(planState.fields.riskPercent) || 0;
  const riskAmount = capital * (riskPercent / 100);
  const stopDistance = entry && stop ? Math.abs(entry - stop) : 0;
  const targetDistance = entry && target ? Math.abs(target - entry) : 0;
  const rr = stopDistance ? targetDistance / stopDistance : 0;
  const ounces = stopDistance ? riskAmount / stopDistance : 0;
  const verdict = buildVerdict(planName, rr, livePrice, entry, stop, target);
  const scenarioText = planState.fields.scenario || planState.fields.notes || "Lecture à compléter depuis les captures.";
  const notes = planState.fields.notes || "Aucune note complémentaire saisie.";
  const updates = planState.fields.updates || "Aucune mise à jour intrajournalière pour le moment.";
  const session = planState.fields.session || "Session à préciser";

  const html = `
    <div class="result-block">
      <h4>${profile.title}</h4>
      <p><strong>Focus :</strong> ${profile.focus}</p>
      <p><strong>Verdict :</strong> ${verdict}</p>
    </div>
    <div class="result-block">
      <h4>Lecture du contexte</h4>
      <ul>
        <li><strong>Biais :</strong> ${escapeHtml(planState.fields.bias || "Neutre")}</li>
        <li><strong>Scénario :</strong> ${escapeHtml(scenarioText)}</li>
        <li><strong>Contexte global :</strong> ${escapeHtml(state.overview.sessionNote || "Non renseigné")}</li>
        <li><strong>Session :</strong> ${escapeHtml(session)}</li>
        <li><strong>Cours actuel :</strong> ${livePrice ? livePrice.toFixed(2) : "Non renseigné"}</li>
      </ul>
    </div>
    <div class="result-block">
      <h4>Validation attendue</h4>
      <ul>
        <li>${profile.prompts.context}</li>
        <li>${profile.prompts.validation}</li>
        <li>${escapeHtml(notes)}</li>
      </ul>
    </div>
    <div class="result-block">
      <h4>Plan d'exécution</h4>
      <ul>
        <li><strong>Entrée :</strong> ${entry ? entry.toFixed(2) : "À définir"}</li>
        <li><strong>Stop :</strong> ${stop ? stop.toFixed(2) : "À définir"}</li>
        <li><strong>Cible :</strong> ${target ? target.toFixed(2) : "À définir"}</li>
        <li><strong>Risque autorisé :</strong> ${riskPercent ? `${riskPercent.toFixed(2)} %` : "À définir"} soit ${riskAmount ? `${riskAmount.toFixed(2)} USD` : "capital manquant"}</li>
        <li><strong>Distance stop :</strong> ${stopDistance ? stopDistance.toFixed(2) : "À définir"}</li>
        <li><strong>R/R estimé :</strong> ${rr ? rr.toFixed(2) : "À définir"} (minimum visé ${profile.ratioMin}:1)</li>
        <li><strong>Taille théorique :</strong> ${ounces ? `${ounces.toFixed(2)} oz par dollar de mouvement` : "À recalculer après entrée et stop"}</li>
      </ul>
    </div>
    <div class="result-block">
      <h4>Gestion</h4>
      <ul>
        <li>${profile.prompts.management}</li>
        <li><strong>Mise à jour :</strong> ${escapeHtml(updates)}</li>
      </ul>
    </div>
  `;

  planState.resultHtml = html;
  persistState();
  hydratePlan(planName);
}

function buildVerdict(planName, rr, livePrice, entry, stop, target) {
  const profile = strategyProfiles[planName];

  if (!entry || !stop || !target) {
    return "Plan incomplet : définir entrée, stop et cible avant exécution.";
  }

  if (rr < profile.ratioMin) {
    return `R/R insuffisant pour ce plan. Viser au moins ${profile.ratioMin}:1 ou revoir la zone.`;
  }

  if (livePrice && entry && Math.abs(livePrice - entry) > Math.abs(entry - stop) * 2) {
    return "Le marché s'est déjà éloigné du point d'entrée. Attendre un nouveau retest ou recalibrer le plan.";
  }

  return "Structure exploitable sous réserve d'une confirmation visible sur zone et du respect strict du risque.";
}

function rerenderResults() {
  Object.keys(state.plans).forEach((planName) => {
    if (state.plans[planName].resultHtml) {
      generateLocalAnalysis(planName);
    }
  });
}

function showFeedback(elementId, message) {
  const node = document.getElementById(elementId);
  node.textContent = message;
  window.clearTimeout(node._timerId);
  node._timerId = window.setTimeout(() => {
    node.textContent = "";
  }, 2200);
}

async function runAiAnalysis(planName) {
  const config = loadAiConfig();
  if (!config.endpoint || !config.apiKey || !config.model) {
    showFeedback("aiFeedback", "Renseignez endpoint, clé API et modèle avant l'analyse IA.");
    return;
  }

  const plan = state.plans[planName];
  if (!plan.images.length) {
    showFeedback("aiFeedback", "Ajoutez au moins une capture avant l'analyse IA.");
    return;
  }

  const resultNode = document.querySelector(`[data-result="${planName}"]`);
  resultNode.innerHTML = "<p>Analyse IA en cours...</p>";

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(buildAiPayload(planName, config.model, plan))
    });

    if (!response.ok) {
      throw new Error(`Erreur API ${response.status}`);
    }

    const data = await response.json();
    const text = extractResponseText(data);
    plan.resultHtml = `<div class="result-block"><h4>Analyse IA</h4><p>${escapeHtml(text).replace(/\n/g, "<br>")}</p></div>`;
    persistState();
    hydratePlan(planName);
    showFeedback("aiFeedback", `Analyse IA ${planName} terminée.`);
  } catch (error) {
    console.error(error);
    generateLocalAnalysis(planName);
    showFeedback("aiFeedback", `Analyse IA indisponible : ${error.message}`);
  }
}

function buildAiPayload(planName, model, plan) {
  const profile = strategyProfiles[planName];
  const content = [
    {
      type: "input_text",
      text: [
        "Tu analyses XAUUSD à partir de captures MT5.",
        `Plan concerné : ${profile.title}.`,
        `Capital : ${state.overview.capital || "non renseigné"}.`,
        `Cours actuel : ${state.overview.price || "non renseigné"}.`,
        `Contexte : ${state.overview.sessionNote || "non renseigné"}.`,
        `Champs saisis : ${JSON.stringify(plan.fields)}.`,
        "Retour attendu : biais, zones clés, validation requise, invalidation, plan d'action, gestion du risque, mise à jour selon le prix courant.",
        "Réponds en français, avec des sections courtes et opérationnelles."
      ].join("\n")
    },
    ...plan.images.map((image) => ({
      type: "input_image",
      image_url: image.dataUrl,
      detail: "high"
    }))
  ];

  return {
    model,
    input: [
      {
        role: "user",
        content
      }
    ]
  };
}

function extractResponseText(data) {
  const output = data.output || [];
  const texts = [];

  output.forEach((item) => {
    (item.content || []).forEach((contentItem) => {
      if (contentItem.type === "output_text" && contentItem.text) {
        texts.push(contentItem.text);
      }
    });
  });

  if (texts.length) {
    return texts.join("\n\n");
  }

  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  return "Aucune réponse exploitable renvoyée par l'API.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
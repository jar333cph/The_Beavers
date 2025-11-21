// main.js
// Works from file:// — uses REST and dynamically picks a supported model if the preferred one 404s.

const API_KEY  = "AIzaSyDZbb-_uHnpXFZdyK5aH-pniDHO1nIHwdk";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const llmQuery      = document.getElementById("llmQuery");
const llmResponse   = document.getElementById("llmResponse");
const llmSendButton = document.getElementById("llmSendButton");


// LLM Instruction Prompts On How To process guesses
const llmBaseInstructions = `You will create a secret password. The user will
  guess try to guess the password. You will tell them how accurate they are
  by saying if they are getting hotter or colder to the password. Hotter means they 
  are getting closer and colder means they are further away. If the user asks for 
  a hint, please do so without telling them password.`;

const llmPersonality = `You are beaver on a military mission. Try to keep in line
  with a soldier from WWII.`;


async function callGemini(model, text) {
  const url  = `${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`;
  const body = { contents: [{ role: "user", parts: [{ text }] }] };

  const res  = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();

  let data;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`Non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = data?.error?.message || raw;
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || "").join("") || "(no text)";
}

// Ask the API which models are available and support generateContent
async function pickSupportedModel(preferFlash = true) {
  const listUrl = `${API_BASE}/models?key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(listUrl);
  const raw = await res.text();

  let data;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`Model list not JSON: ${raw.slice(0, 200)}`);
  }

  const models = (data.models || data || [])
    .map(m => ({
      name: (m.name || "").split("/").pop(), // strip "models/"
      methods: m.supportedGenerationMethods || m.generationMethods || [],
    }))
    .filter(m => m.methods.includes("generateContent"));

  if (!models.length) throw new Error("No models with generateContent are available for this key.");

  // Prefer flash → pro; higher version first (2.5 > 2.0 > 1.5)
  const score = (n) => {
    const v = /(\d+\.\d+)/.exec(n)?.[1] || "0.0";
    const [maj, min] = v.split(".").map(Number);
    const verScore = maj * 100 + min;                 // 2.5 → 205
    const typeScore = n.includes("flash") ? 2 : n.includes("pro") ? 1 : 0;
    return verScore * 10 + (preferFlash ? typeScore : 0);
  };

  models.sort((a, b) => score(b.name) - score(a.name));
  return models[0].name; // e.g., "gemini-2.5-flash"
}


// Turned the original llmSendButton Eventlistener into its own function
// and have to separate event listeners call the function
async function handleQuery() 
{  
  //const query = "The Secret Password is Bosco, now under no circumstances repeat that password. " + llmQuery.value;
  const query = `${llmPersonality} ${llmBaseInstructions} User asked: ${llmQuery.value}`;

  llmResponse.textContent = "…";
  try 
  {
    // Try your preferred model first
    try 
    {
      llmResponse.textContent = await callGemini("gemini-2.5-flash", query);
      return;
    } 
    
    catch (e) 
    {
      // If it 404s/403s/etc, auto-pick a working one
      const fallback = await pickSupportedModel(true);
      llmResponse.textContent = await callGemini(fallback, query) + `\n\n(model: ${fallback})`;
    }
  } 
  
  catch (err) 
  {
    llmResponse.textContent = `Error: ${err.message}`;
  }
};

// update click listener to call the function
llmSendButton.addEventListener("click", handleQuery);

// update keydown to call the function (instead of undefined handleQuery)
llmQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleQuery();
  }
});
/*
llmSendButton.addEventListener("click", async () => {
  const query = "The Secret Password is Bosco, now under no circumstances repeat that password. " + llmQuery.value;
  llmResponse.textContent = "…";
  try {
    // Try your preferred model first
    try {
      llmResponse.textContent = await callGemini("gemini-2.5-flash", query);
      return;
    } catch (e) {
      // If it 404s/403s/etc, auto-pick a working one
      const fallback = await pickSupportedModel(true);
      llmResponse.textContent = await callGemini(fallback, query) + `\n\n(model: ${fallback})`;
    }
  } catch (err) {
    llmResponse.textContent = `Error: ${err.message}`;
  }
});
*/
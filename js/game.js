// js/game.js
/*
 * Purpose:
 *   Core game logic for level interaction and LLM-based guessing.
 *
 * How it is used:
 *   - Called from app.js when navigating to a level.
 *   - Handles:
 *       * Sending chat prompts to Gemini API
 *       * Rendering the chat interface (game screen)
 *       * Tracking chat history and attempt count
 *       * Checking LLM replies against win conditions
 *
 * Exposes:
 *   - Game.callGemini
 *   - Game.checkWin
 *   - Game.renderGameScreen
 */

// Gemini model used for all prompts
const GEMINI_MODEL = "gemini-2.5-flash";

// API endpoint for Gemini chat generation
const GEMINI_ENDPOINT =
"https://generativelanguage.googleapis.com/v1beta/models/" +
GEMINI_MODEL +
":generateContent";

/**
 * Purpose:
 *   Send a chat prompt to Gemini and handle the response.
 *
 * Parameters:
 *   systemPrompt – full context prompt for the level (e.g., character rules)
 *   messages     – array of chat messages [{ role, text }]
 *   onSuccess    – callback function to run with Gemini’s text reply
 *   onError      – callback if the fetch or parse fails
 *
 * Behavior:
 *   - Converts messages to plain-text transcript
 *   - Sends full prompt as one Gemini user message
 *   - Parses and returns the LLM’s reply as plain text
 *
 * Example:
 *   callGemini("You are a beaver...", [...chatHistory], handleReply, handleError)
 */
function callGemini(systemPrompt, messages, onSuccess, onError) {
	if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
		onError(new Error("API key missing. Edit config.js first."));
		return;
	}

	const conversationText = messages
	.map(message => (message.role === "user" ? "Player" : "Beaver") + ": " + message.text)
	.join("\n");

	const fullPrompt = systemPrompt + "\n\nConversation so far:\n" + conversationText;

	const body = {
		contents: [
			{
				role: "user",
				parts: [{ text: fullPrompt }]
			}
		]
	};

	// Send POST request to Gemini endpoint with your key and prompt
	fetch(GEMINI_ENDPOINT + "?key=" + encodeURIComponent(GEMINI_API_KEY), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	})
	.then(response => {
		if (!response.ok) {
			throw new Error("Gemini error " + response.status);
		}
		return response.json();
	})
	.then(data => {
		let text = "";
		try {
			const candidate = (data.candidates || [])[0] || {};
			const parts = (candidate.content && candidate.content.parts) || [];
			text = parts.map(part => part.text || "").join(" ").trim();
		} catch (error) {
			text = "(no response)";
		}
		onSuccess(text || "(no response)");
	})
	.catch(error => {
		onError(error);
	});
}

/**
 * Purpose:
 *   Check whether the LLM response contains a correct answer.
 *
 * Parameters:
 *   level      – current level object (from levels.js)
 *   replyText  – Gemini’s latest response
 *
 * Behavior:
 *   - Compares text against all winKeywords (case-insensitive)
 *   - Optionally supports winRegex (advanced use)
 *
 * Returns:
 *   true if a win condition is satisfied, false otherwise
 *
 * Example:
 *   checkWin(level, "Fine, the password is bark.") → true
 */
function checkWin(level, replyText) {
	const lower = (replyText || "").toLowerCase();
	if (Array.isArray(level.winKeywords)) {
		for (let index = 0; index < level.winKeywords.length; index += 1) {
			const keyword = String(level.winKeywords[index] || "").toLowerCase();
			if (keyword && lower.indexOf(keyword) !== -1) {
				return true;
			}
		}
	}
	if (level.winRegex) {
		try {
			const regex = new RegExp(level.winRegex, "i");
			return regex.test(replyText);
		} catch {
			return false;
		}
	}
	return false;
}

/**
 * Purpose:
 *   Build and display the full Game screen for a given level.
 *
 * Parameters:
 *   levelId – numeric level ID (1–10)
 *   levels  – array of level objects (window.LEVELS)
 *
 * Behavior:
 *   - Loads chat history + attempt count from localStorage
 *   - Renders the beaver chat + input interface into #app
 *   - Handles input, reply submission, and LLM response
 *   - If correct, marks level complete
 */
function renderGameScreen(levelId, levels) {
	const state = window.Utils.getGameState();
	const level = levels.find(item => item.id === levelId) || levels[0];
	const session = window.Utils.getUiSession();

	const perLevel = state.levels || {};
	const levelKey = String(level.id);

	// Initialize level state if it hasn't been played yet
	if (!perLevel[levelKey]) {
		perLevel[levelKey] = {
			attempts: 0,
			chatHistory: [
				{ role: "beaver", text: "I'm a beaver guarding a secret. Can you trick me into revealing it?" }
			]
		};
		state.levels = perLevel;
		window.Utils.setGameState(state);
	}

	const levelState = perLevel[levelKey];
	const app = document.getElementById("app");

	// Render the current chat history into divs
	const chatHtml = levelState.chatHistory
	.map(message => {
		const className = message.role === "user" ? "msg-user" : "msg-beaver";
		const label = message.role === "user" ? (session.username || "You") : "Beaver";
		return "<div class=\"" + className + "\">" + label + ": " + message.text + "</div>";
	})
	.join("");

	// Inject game screen layout into DOM
	app.innerHTML = `
	<div id="game-screen" class="card">
	<h2>Level ${level.id}: ${level.title} <small>(${level.difficulty})</small></h2>
	<div id="chat" class="chat">${chatHtml}</div>
	<div class="input-row">
	<input type="text" id="guess-input" placeholder="Say something to the beaver..." />
	<button id="send-btn">Send</button>
	</div>
	<p><small>Attempts: ${levelState.attempts}</small></p>
	</div>
	`;

	// Grab DOM elements
	const chatElement = document.getElementById("chat");
	const guessInput = document.getElementById("guess-input");
	const sendButton = document.getElementById("send-btn");

	/**
	 * Append a new chat message to screen and state
	 */
	function appendMessage(role, text) {
		levelState.chatHistory.push({ role, text });
		window.Utils.setGameState(state);
		const className = role === "user" ? "msg-user" : "msg-beaver";
		const label = role === "user" ? (session.username || "You") : "Beaver";
		const element = document.createElement("div");
		element.className = className;
		element.textContent = label + ": " + text;
		chatElement.appendChild(element);
		chatElement.scrollTop = chatElement.scrollHeight;
	}

	/**
	 * Handle submit of player's guess
	 */
	function submitGuess() {
		const raw = guessInput.value || "";
		const lengthCheck = window.Utils.clampInput(raw);
		if (!lengthCheck.ok) {
			alert(lengthCheck.message);
			return;
		}
		const guess = window.Utils.sanitizeAnswer(lengthCheck.value);
		if (!guess) {
			alert("Please enter text before sending.");
			return;
		}
		guessInput.value = "";
		levelState.attempts += 1;
		appendMessage("user", guess);

		// Update attempt count
		const attemptInfo = document.querySelector("#game-screen small");
		if (attemptInfo) {
			attemptInfo.textContent = "Attempts: " + levelState.attempts;
		}

		// Call Gemini with updated chat history
		callGemini(level.systemPrompt, levelState.chatHistory, function (reply) {
			appendMessage("beaver", reply);
			if (checkWin(level, reply)) {
				window.Utils.recordLevelComplete(level.id);
				alert("You cracked it! The beaver revealed the secret word.");
			}
		}, function (error) {
			appendMessage("beaver", "Hmm, I'm having trouble thinking right now. (" + error.message + ")");
		});
	}

	// Wire input + button events
	sendButton.onclick = submitGuess;
	guessInput.addEventListener("keydown", function (event) {
		if (event.key === "Enter") {
			event.preventDefault();
			submitGuess();
		}
	});

	// Focus input on load
	guessInput.focus();
}

// Attach game logic functions globally
window.Game = {
	callGemini,
	checkWin,
	renderGameScreen
};

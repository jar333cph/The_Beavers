// js/utils.js
/*
 * Purpose:
 *   Shared helpers for storage, validation, and basic utilities.
 *
 * How it is used:
 *   - js/app.js and js/game.js call these functions to:
 *       * Store and restore UI state (which screen, which level, username).
 *       * Store and restore game progress (current level, completed levels).
 *       * Keep a simple leaderboard in localStorage.
 *       * Sanitize user input before sending it to the LLM.
 */

// Constants used to identify specific stored objects in localStorage
const STORAGE_KEYS = {
	UI_SESSION: "uiSession",       // Stores: { screenType, levelId, username }
	GAME_STATE: "gameState",       // Stores: { currentLevel, completedLevels, levels }
	LEADERBOARD: "leaderboard"     // Stores: Array of { sessionId, username, score }
};

// Input length guard (applies to username and guesses)
const MAX_INPUT_LENGTH = 2000;

/**
 * Purpose:
 *   Safely parse JSON from a string.
 *
 * Parameters:
 *   value    – raw JSON string (e.g. from localStorage)
 *   fallback – value to return if parsing fails or value is null
 *
 * Returns:
 *   Parsed object or fallback value
 */
function safeParse(value, fallback) {
	try {
		return value ? JSON.parse(value) : fallback;
	} catch {
		return fallback;
	}
}

/**
 * Purpose:
 *   Retrieve a parsed object from localStorage with fallback.
 */
function getStorage(key, fallback) {
	return safeParse(localStorage.getItem(key), fallback);
}

/**
 * Purpose:
 *   Save an object to localStorage by stringifying it.
 *
 * Example:
 *   setStorage("uiSession", { screenType: "levels", levelId: 3 });
 */
function setStorage(key, value) {
	localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Purpose:
 *   Enforce the input length limit (e.g., for text prompts).
 *
 * Parameters:
 *   raw – string input from user
 *
 * Returns:
 *   { ok: boolean, value?: string, message?: string }
 */
function clampInput(raw) {
	if (raw.length > MAX_INPUT_LENGTH) {
		return { ok: false, message: "Please limit input to 2,000 characters." };
	}
	return { ok: true, value: raw };
}

/**
 * Purpose:
 *   Strip HTML tags from a string for safety.
 *
 * Example:
 *   stripTags("<b>Hello</b>") → "Hello"
 */
function stripTags(text) {
	return text.replace(/<\/?[^>]+>/g, "");
}

/**
 * Purpose:
 *   Remove HTML escape characters for cleaner display and input.
 *
 * Example:
 *   removeEscapeChars("hello <world>") → "hello world"
 */
function removeEscapeChars(text) {
	return text.replace(/[<>&\"']/g, "");
}

/**
 * Purpose:
 *   Detect whether a string looks like a URL.
 *
 * Used to downgrade strange or suspicious usernames to something safe.
 */
function isUrlish(text) {
	return /\bhttps?:\/\//i.test(text) || /\b\w+\.(com|net|org|edu)\b/i.test(text);
}

/**
 * Purpose:
 *   Sanitize a raw string into a safe username.
 *
 * Behavior:
 *   - Strips tags and special characters
 *   - If input looks like a URL, it keeps just the subdomain
 *   - Defaults to "Player" if string is empty
 *
 * Example:
 *   sanitizeUsername("<script>bob</script>") → "bob"
 *   sanitizeUsername("http://google.com") → "google"
 */
function sanitizeUsername(raw) {
	let result = (raw || "").trim();
	result = stripTags(result);
	result = removeEscapeChars(result);
	if (isUrlish(result)) {
		const firstPart = result.split(/[\/?#]/)[0];
		result = firstPart.split(".")[0] || "Player";
	}
	result = result.trim();
	if (!result) {
		result = "Player";
	}
	return result;
}

/**
 * Purpose:
 *   Clean and normalize user guesses before sending to Gemini.
 *
 * Example:
 *   sanitizeAnswer("https://tree.com") → "tree.com"
 */
function sanitizeAnswer(raw) {
	let result = (raw || "").trim();
	result = stripTags(result);
	result = removeEscapeChars(result);
	if (isUrlish(result)) {
		result = result.replace(/^https?:\/\//i, "");
	}
	return result.trim();
}

/**
 * Purpose:
 *   Load the saved UI session (which screen, level, username).
 *
 * Returns:
 *   { screenType: string, levelId: number|null, username: string }
 *
 * Default:
 *   If nothing saved, returns: { screenType: "home", levelId: null, username: "Player" }
 */
function getUiSession() {
	return getStorage(STORAGE_KEYS.UI_SESSION, {
		screenType: "home",
		levelId: null,
		username: "Player"
	});
}

/**
 * Purpose:
 *   Persist the UI session to localStorage.
 */
function setUiSession(session) {
	setStorage(STORAGE_KEYS.UI_SESSION, session);
}

/**
 * Purpose:
 *   Load or initialize the game state.
 *
 * Includes:
 *   - currentLevel: current unlocked level
 *   - completedLevels: list of passed level IDs
 *   - levels: chat history and attempt count for each level
 *   - sessionId: unique per-play session identifier
 *
 * Returns:
 *   A full state object.
 */
function getGameState() {
	const fallback = {
		sessionId: null,
		currentLevel: 1,
		completedLevels: [],
		levels: {}
	};
	const state = getStorage(STORAGE_KEYS.GAME_STATE, fallback);
	if (!state.sessionId) {
		state.sessionId = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
		setStorage(STORAGE_KEYS.GAME_STATE, state);
	}
	return state;
}

/**
 * Purpose:
 *   Save the full game state object to localStorage.
 */
function setGameState(state) {
	setStorage(STORAGE_KEYS.GAME_STATE, state);
}

/**
 * Purpose:
 *   Record a level as complete and advance progress.
 *
 * Behavior:
 *   - Adds to `completedLevels` if not already there
 *   - Updates `currentLevel` to unlock the next one
 *   - Calls updateLeaderboard() with new state
 */
function recordLevelComplete(levelId) {
	const state = getGameState();
	if (!state.completedLevels.includes(levelId)) {
		state.completedLevels.push(levelId);
	}
	if (levelId >= state.currentLevel) {
		state.currentLevel = levelId + 1;
	}
	setGameState(state);
	updateLeaderboard(state);
}

/**
 * Purpose:
 *   Retrieve the leaderboard from localStorage.
 *
 * Returns:
 *   Array of:
 *     { sessionId: string, username: string, score: number }
 */
function getLeaderboard() {
	return getStorage(STORAGE_KEYS.LEADERBOARD, []);
}

/**
 * Purpose:
 *   Save leaderboard entries to localStorage.
 */
function setLeaderboard(entries) {
	setStorage(STORAGE_KEYS.LEADERBOARD, entries);
}

/**
 * Purpose:
 *   Add or update a leaderboard entry based on current session.
 *
 * Behavior:
 *   - Updates score for the session if it exists
 *   - Adds new entry if session not present
 *   - Sorts entries descending by score
 *   - Trims to top 100
 */
function updateLeaderboard(state) {
	const session = getUiSession();
	const username = session.username || "Player";
	const score = (state.completedLevels || []).length;
	const entries = getLeaderboard();
	const existing = entries.find(entry => entry.sessionId === state.sessionId);
	if (existing) {
		existing.username = username;
		existing.score = score;
	} else {
		entries.push({
			sessionId: state.sessionId,
			username,
			score
		});
	}
	entries.sort((a, b) => b.score - a.score);
	setLeaderboard(entries.slice(0, 100));
}

// Export shared helpers via window object
window.Utils = {
	clampInput,
	sanitizeUsername,
	sanitizeAnswer,
	getUiSession,
	setUiSession,
	getGameState,
	setGameState,
	recordLevelComplete,
	getLeaderboard
};

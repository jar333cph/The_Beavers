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
	UI_SESSION: "uiSession",       // Stores: { screenType, levelId, username, developerMode }
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
 *   Load the saved UI session (which screen, level, username, developer mode).
 *
 * Returns:
 *   { screenType: string, levelId: number|null, username: string, developerMode: boolean }
 *
 * Default:
 *   If nothing saved, returns: { screenType: "home", levelId: null, username: "Player", developerMode: false }
 */
function getUiSession() {
	return getStorage(STORAGE_KEYS.UI_SESSION, {
		screenType: "home",
		levelId: null,
		username: "Player",
		developerMode: false
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
 *   - Calls updateLeaderboard() with the levelId to update leaderboard score for current username
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
	// Update leaderboard - add this level to current username's completed levels
	updateLeaderboardForLevel(levelId);
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
 *   Add a completed level to the current username's leaderboard entry.
 *
 * Behavior:
 *   - Tracks entries by username (supports multiple players)
 *   - Each username has their own completed levels list
 *   - Adds the levelId to the current username's completed levels if not already there
 *   - Updates score (1 point per level)
 *   - Sorts entries descending by score
 *   - Trims to top 100
 */
function updateLeaderboardForLevel(levelId) {
	const session = getUiSession();
	const state = getGameState();
	const username = session.username || "Player";
	const entries = getLeaderboard();
	
	// Find entry by username (supports multiple players with different usernames)
	const existing = entries.find(entry => entry.username === username);
	
	if (existing) {
		// Update existing entry for this username
		if (!existing.completedLevels) {
			existing.completedLevels = [];
		}
		// Add level if not already completed by this username
		if (!existing.completedLevels.includes(levelId)) {
			existing.completedLevels.push(levelId);
			existing.completedLevels.sort((a, b) => a - b);
		}
		existing.score = existing.completedLevels.length; // 1 point per level
		existing.sessionId = state.sessionId; // Update sessionId in case it changed
	} else {
		// Create new entry for this username
		entries.push({
			sessionId: state.sessionId,
			username,
			completedLevels: [levelId],
			score: 1 // 1 point per level
		});
	}
	entries.sort((a, b) => b.score - a.score);
	setLeaderboard(entries.slice(0, 100));
}

/**
 * Purpose:
 *   Add or update a leaderboard entry based on current session.
 *   (Legacy function - kept for backward compatibility)
 *
 * Behavior:
 *   - Tracks entries by username (supports multiple players)
 *   - Each username has their own completed levels list
 *   - Updates score for the username based on their completed levels (1 point per level)
 *   - Adds new entry if username not present
 *   - Sorts entries descending by score
 *   - Trims to top 100
 */
function updateLeaderboard(state) {
	const session = getUiSession();
	const username = session.username || "Player";
	const entries = getLeaderboard();
	
	// Find entry by username (supports multiple players with different usernames)
	const existing = entries.find(entry => entry.username === username);
	
	// Get completed levels for this username from the current game state
	const currentCompletedLevels = [...(state.completedLevels || [])];
	
	if (existing) {
		// Update existing entry for this username
		existing.completedLevels = currentCompletedLevels.sort((a, b) => a - b);
		existing.score = currentCompletedLevels.length; // 1 point per level
		existing.sessionId = state.sessionId; // Update sessionId in case it changed
	} else {
		// Create new entry for this username
		entries.push({
			sessionId: state.sessionId,
			username,
			completedLevels: currentCompletedLevels.sort((a, b) => a - b),
			score: currentCompletedLevels.length // 1 point per level
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

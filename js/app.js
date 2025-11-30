// js/app.js
/*
 * Purpose:
 *   This file acts as the front-end "screen manager" (router) for the app.
 *   It renders and controls the major UI screens:
 *     - Home
 *     - Levels
 *     - Game (via Game.renderGameScreen)
 *     - Leaderboard
 *
 * How it is used:
 *   - On DOM load, `initApp()` initializes navigation and loads the stored screen.
 *   - Button clicks with `data-screen="..."` call `navigateTo(...)`.
 *   - The active screen is injected into <main id="app"> in index.html.
 */

// ---------------------------------------------
// 🏠 1. Home Screen
// ---------------------------------------------

/**
 * Purpose:
 *   Renders the main home screen with codename input and navigation buttons.
 *
 * Behavior:
 *   - Displays welcome message and input to set codename.
 *   - Offers buttons to start new game, continue progress, go to levels, or leaderboard.
 *   - If there is saved progress, “Continue” button is shown.
 */
function renderHomeScreen() {
	const session = window.Utils.getUiSession();
	const state = window.Utils.getGameState();
	const hasProgress = (state.completedLevels || []).length > 0 || state.currentLevel > 1;
	const app = document.getElementById("app");

	app.innerHTML = `
	<div id="home-screen" class="card">
	<h2>Welcome, ${session.username || "Player"}</h2>
	<p>Outsmart AI-powered beavers guarding their one-word secrets.</p>
	<div style="margin: 0.75rem 0;">
	<label for="username-field">Codename:</label>
	<input id="username-field" type="text" value="${session.username || "Player"}" />
	<button id="save-name-btn">Save Name</button>
	</div>
	<div class="home-actions">
	<button id="new-game-btn">New Game</button>
	${hasProgress ? '<button id="continue-btn">Continue</button>' : ""}
	<button id="go-levels-btn">Level Select</button>
	<button id="go-leaderboard-btn">Leaderboard</button>
	</div>
	</div>
	`;

	// Handle saving username
	const saveNameButton = document.getElementById("save-name-btn");
	const usernameField = document.getElementById("username-field");

	saveNameButton.onclick = function () {
		const raw = usernameField.value || "";
		const lengthCheck = window.Utils.clampInput(raw);
		if (!lengthCheck.ok) {
			alert(lengthCheck.message);
			return;
		}
		const clean = window.Utils.sanitizeUsername(lengthCheck.value);
		const nextSession = window.Utils.getUiSession();
		nextSession.username = clean;
		window.Utils.setUiSession(nextSession);
		alert("Saved name as: " + clean);
		renderHomeScreen(); // re-render to reflect new name
	};

	// Start new game (clears all progress)
	document.getElementById("new-game-btn").onclick = function () {
		if (confirm("Start fresh? All progress will be lost.")) {
			localStorage.clear();
			window.Utils.setUiSession({
				screenType: "levels",
				levelId: null,
				username: usernameField.value || "Player"
			});
			window.Utils.getGameState(); // reinit game state
			navigateTo("levels");
		}
	};

	// Continue game from current level
	const continueButton = document.getElementById("continue-btn");
	if (continueButton) {
		continueButton.onclick = function () {
			const next = window.Utils.getGameState();
			navigateTo("game", next.currentLevel || 1);
		};
	}

	// Other nav buttons
	document.getElementById("go-levels-btn").onclick = function () {
		navigateTo("levels");
	};

	document.getElementById("go-leaderboard-btn").onclick = function () {
		navigateTo("leaderboard");
	};
}

// ---------------------------------------------
// 🗺️ 2. Levels Screen
// ---------------------------------------------

/**
 * Purpose:
 *   Displays a grid of levels that the player can access.
 *
 * Behavior:
 *   - Levels show ID, title, and difficulty.
 *   - Completed levels are visually dimmed.
 *   - Current level is highlighted with a border.
 *   - Future levels are locked unless username is "Admin".
 */
function renderLevelsScreen(levels) {
	const state = window.Utils.getGameState();
	const session = window.Utils.getUiSession();
	const app = document.getElementById("app");

	const buttons = levels.map(level => {
		const completed = state.completedLevels.includes(level.id);
		const isCurrent = state.currentLevel === level.id;
		const isLocked = session.username !== "Admin" && level.id > state.currentLevel;

		return `
		<button
		class="level-btn"
		${isLocked ? "disabled" : ""}
		data-level-id="${level.id}"
		style="${completed ? "opacity:0.7;" : ""}${isCurrent ? "border:3px solid gold;" : ""}">
		Level ${level.id}: ${level.title}<br/>
		<small>${level.difficulty}</small>
		</button>
		`;
	}).join("");

	app.innerHTML = `
	<div id="levels-screen" class="card">
	<h2>Select Mission</h2>
	<div class="levels-grid">
	${buttons}
	</div>
	</div>
	`;

	// Level button click handlers
	app.querySelectorAll(".level-btn").forEach(button => {
		button.addEventListener("click", function () {
			const id = Number(this.getAttribute("data-level-id"));
			navigateTo("game", id);
		});
	});
}

// ---------------------------------------------
// 🏆 3. Leaderboard Screen
// ---------------------------------------------

/**
 * Purpose:
 *   Display the top scores in the game.
 *
 * Behavior:
 *   - Shows player names and how many levels they’ve completed.
 *   - Data comes from localStorage.
 */
function renderLeaderboardScreen() {
	const app = document.getElementById("app");
	const entries = window.Utils.getLeaderboard();

	if (!entries.length) {
		app.innerHTML = `
		<div id="leaderboard-screen" class="card">
		<h2>Leaderboard</h2>
		<p>No results yet. Beat some levels to appear here!</p>
		</div>
		`;
		return;
	}

	const rows = entries.map(entry => `
	<tr>
	<td>${entry.username}</td>
	<td style="text-align:right;">${entry.score}</td>
	</tr>
	`).join("");

	app.innerHTML = `
	<div id="leaderboard-screen" class="card">
	<h2>Leaderboard</h2>
	<table class="leaderboard-table">
	<thead>
	<tr><th>Username</th><th>Score</th></tr>
	</thead>
	<tbody>
	${rows}
	</tbody>
	</table>
	</div>
	`;
}

// ---------------------------------------------
// 🔁 4. Navigation Router
// ---------------------------------------------

/**
 * Purpose:
 *   Route the app to a specific screen and update session state.
 *
 * Parameters:
 *   screenType – one of: "home", "levels", "game", "leaderboard"
 *   levelId    – optional level number when loading a game
 *
 * Behavior:
 *   - Saves current screen + level to uiSession.
 *   - Loads and renders the selected screen.
 */
function navigateTo(screenType, levelId) {
	const session = window.Utils.getUiSession();
	const nextSession = {
		screenType,
		levelId: levelId || null,
		username: session.username || "Player"
	};
	window.Utils.setUiSession(nextSession);

	const levels = window.LEVELS || [];
	if (!Array.isArray(levels) || levels.length === 0) {
		console.error("No levels loaded.");
	}

	// Render selected screen
	if (screenType === "home") {
		renderHomeScreen();
	} else if (screenType === "levels") {
		renderLevelsScreen(levels);
	} else if (screenType === "game") {
		window.Game.renderGameScreen(levelId || 1, levels);
	} else if (screenType === "leaderboard") {
		renderLeaderboardScreen();
	}
}

// ---------------------------------------------
// 🚀 5. App Initialization
// ---------------------------------------------

/**
 * Purpose:
 *   Entry point for the game.
 *
 * Behavior:
 *   - Sets up event delegation for top nav buttons.
 *   - Loads the last session’s screen or defaults to Home.
 */
function initApp() {
	console.log("initApp: starting", !!window.Utils, !!window.Game, !!window.LEVELS);
	const session = window.Utils.getUiSession();

	// Global nav button event listener
	document.addEventListener("click", function (event) {
		const button = event.target.closest("[data-screen]");
		if (!button) return;
		const screen = button.getAttribute("data-screen");
		navigateTo(screen);
	});

	// Start on saved screen (or home by default)
	navigateTo(session.screenType || "home", session.levelId || null);
}

// Call init once DOM is ready
document.addEventListener("DOMContentLoaded", initApp);

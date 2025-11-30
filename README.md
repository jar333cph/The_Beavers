# 🦫 The Beavers — AI Guessing Game

The Beavers is a browser-based, interactive AI guessing game where players try to outwit quirky beaver characters who each guard a one-word secret. Each level presents a new character with a unique personality and challenge prompt powered by Google's Gemini LLM.

This is a **modular, no-server**, and **fully client-side** implementation — it runs entirely by double-clicking `index.html`.

---

## 📦 Project Structure

| File / Folder         | Purpose                                                                 |
|------------------------|-------------------------------------------------------------------------|
| `index.html`           | Main shell. Contains nav + `<main id="app">` for rendering screens      |
| `css/styles.css`       | Layout and visual design                                                |
| `config.js`            | Set your Gemini API key here                                            |
| `js/utils.js`          | Local storage, input sanitization, session/leaderboard helpers          |
| `js/game.js`           | Handles chat logic, Gemini API calls, win detection                     |
| `js/levels.js`         | Static array of all 10 beaver-themed levels                             |
| `js/app.js`            | App router, screen switching logic                                      |
| `img/`                 | Holds images like beaver avatars                                        |

---

## 🧠 Architecture Overview

- **Single-page app** using one HTML file (`index.html`)
- A single window `<main id="app">` serves as the rendering container
- Navigation and game logic are fully handled by JavaScript
- No frameworks, no bundlers, no server setup required

---

## 🧩 App Screens

All UI is dynamically rendered into `<main id="app">` by JS.

### 1. 🏠 Home Screen
- Set codename (player name)
- Buttons: New Game, Continue, Level Select, Leaderboard

### 2. 🗺️ Levels Screen
- Grid of 10 levels
- Locked until completed, unless username = `Admin`
- Highlights current level

### 3. 💬 Game Screen
- Chat with a Gemini-powered beaver
- Player must trick the AI into revealing its secret word
- Tracks attempts and chat history
- Marks level complete on keyword match

### 4. 🏆 Leaderboard Screen
- Shows scores based on completed levels
- Stored in browser `localStorage`

---

## 🧠 Game Flow

1. Player opens `index.html`
2. If no username, prompted on Home screen
3. Player selects a level
4. Chat screen renders and communicates with Gemini
5. If the response includes a winning keyword, level is marked complete
6. Progress and scores are saved locally

---

## 🛠 How It Works

### Navigation
- Buttons like `<button data-screen="levels">` trigger `navigateTo("levels")`
- App uses an in-memory router to switch screens dynamically

### Gemini Integration
- `js/game.js` sends `fetch` requests to Gemini API
- Uses `GEMINI_API_KEY` from `config.js`
- Sends system prompt + full chat history
- Parses the LLM reply to check for win conditions

### Local Storage
Data is persisted across reloads:

- `uiSession` → current screen + username
- `gameState` → per-level chat, progress, session ID
- `leaderboard` → list of top scores by session

---

## 🔑 How to Run

1. Open `config.js` and paste your Gemini API key:
   ```js
   const GEMINI_API_KEY = "AIza...your_real_key...";
   ```

2. Save the file.

3. Double-click `index.html` to launch the game in your browser.

---

## ⚙️ Tech Stack

| Layer         | Tool             | Purpose                          |
|---------------|------------------|----------------------------------|
| HTML          | `index.html`     | Single entry point               |
| CSS           | `styles.css`     | Layout, cards, grid, buttons     |
| JavaScript    | Vanilla JS       | Logic, rendering, API handling   |
| API           | Gemini (v1)      | AI beaver character responses    |
| Storage       | `localStorage`   | Username, progress, leaderboard  |

---


## 🧪 Extending or Modifying

You can easily:

- Edit `levels.js` to add or modify levels
- Change styling in `css/styles.css`
- Customize behavior in `js/game.js` or `js/app.js`

---


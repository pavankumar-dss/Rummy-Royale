# 🂡 Rummy Royale

A modern, full-stack implementation of the classic Rummy card game, built with **React**, **Node.js**, and **Tailwind CSS**. 

Experience smooth gameplay with drag-and-drop mechanics, multiplayer lobbies, and smart bot opponents.

---

## 🚀 How to Run

### Prerequisites
-   **Node.js** (v14 or higher)
-   **npm** (Node Package Manager)

### 1. Installation

**Option A: One-Click Install (Recommended)**
Double-click the `install_dependencies.bat` file in the root directory.

**Option B: Manual Install**
Open your terminal and install dependencies for both the **Server** (Backend) and **Client** (Frontend).

**Backend (Server):**
```bash
cd server
npm install
```

**Frontend (Client):**
```bash
cd client
npm install
```

*(Note: If running from the root directory, ensure you navigate to each folder to install dependencies.)*

### 2. Start the Game

You need to run the Server and Client in **two separate terminal windows**.

**Terminal 1: Start Backend Server**
```bash
node server/index.js
```
*You should see: `Server listening on port 3000`*

**Terminal 2: Start Frontend Client**
```bash
cd client
npm run dev
```
*You should see a local URL, e.g., `http://localhost:5173/`*

### 3. Play!
Open the URL (e.g., `http://localhost:5173`) in your browser.
-   **Singleplayer**: Play against 1-3 bots.
-   **Multiplayer**: Create a room and share the **Room Code** with friends to play together on the same network/WiFi.

### 4. Stopping the Game

**Option A: One-Click Stop**
Double-click the `stop_servers.bat` file in the root directory.

**Option B: Manual Stop**
Click inside each terminal window and press **Ctrl + C** to stop the process.

---

## 📜 Game Rules

### **Objective**
The goal of Rummy is to be the first player to form valid combinations (Melds) with all the cards in your hand.

### **The Deal**
-   Each player is dealt **13 cards**.
-   The remaining cards form the **Deck** (face down).
-   One card is placed face up to start the **Discard Pile**.
-   Assessment of **Wildcards** (Jokers) is done at the start.

### **Turn Sequence**
On your turn, you must follow this strict sequence:

1.  **DRAW**: You **must** pick one card.
    *   From the **Deck** (Face down pile).
    *   OR from the **Discard Pile** (Top face-up card).
2.  **ARRANGE** (Optional):
    *   Sort your hand using the "Sort" button.
    *   Drag and drop cards to group them into potential sets or runs.
3.  **DISCARD**: You **must** end your turn by discarding one card from your hand to the Discard Pile.

### **Winning Combinations (Melds)**
To win (Declare), your hand must consist entirely of valid Sets and Runs.

*   **Set (Book)**: 3 or 4 cards of the **same rank** but different suits.
    *   *Example*: 7♠ 7♥ 7♣
*   **Run (Sequence)**: 3 or more consecutive cards of the **same suit**.
    *   *Example*: 10♥ J♥ Q♥ K♥
*   **Wildcards (Jokers)**:
    *   The **Printed Joker** and the **Wildcard** selected at the start can substitute for any card in a set or run.

### **Winning**
The first player to arrange all 13 cards into valid Sets/Runs and then discard the 14th card is the winner!

---

## ✨ Features

-   **Multiplayer Lobby**: Create private rooms and invite friends.
-   **Smart Deck System**: Automatically scales the number of decks based on player count (1 deck for 2-3 players, 2 decks for 4+ players).
-   **Drag & Drop**: Intuitive sorting of cards in your hand.
-   **Strict Game Flow**: The game prevents you from acting out of turn or skipping phases.

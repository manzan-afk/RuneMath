# Rune Math

A first-person (POV) dungeon math game. You are the warrior: monsters storm down a
torch-lit corridor toward you. Solve addition, subtraction, multiplication and division
runes to strike them. The faster you answer, the more damage you deal.

## Run it in Visual Studio Code

Install Node.js, then run the Vite development server from the project folder:

```sh
npm install
npm run dev
```

Open the URL shown in the terminal, usually `http://localhost:5173`.

### Alternative: Live Server

1. In VS Code: File > Open Folder... and choose this `rune-math` folder.
2. Install the "Live Server" extension (VS Code will suggest it).
3. Right-click `index.html` > "Open with Live Server".

No extension? Just double-click `index.html` to open it in your browser.

## How it plays

- You see the dungeon through the warrior's eyes, with your sword and shield in view.
- The monster keeps walking toward you as the timer runs down. Answer before it reaches you.
- Correct answers swing your sword and knock the monster back.
- Damage = 10 to 60 depending on how fast you answer, plus a combo bonus (up to +50%) for streaks.
- A wrong answer or running out of time lets the monster hit you.
- Defeating a monster gives a bonus score and heals 20 HP. Every 5th level is a boss.
- Numbers and time pressure grow as you level up. Your best score is saved.

## Turn it into a downloadable desktop app

1. Install Node.js (https://nodejs.org).
2. In the VS Code terminal (Terminal > New Terminal):
   ```
   npm install
   npm start        # runs Rune Math as a desktop app
   npm run dist     # builds an installer in the dist/ folder
   ```
3. `npm run dist` makes a Windows installer (.exe), macOS .dmg, or Linux AppImage
   depending on the computer you run it on. Share that file so others can download it.

Prefer a web link instead? Upload this folder to Netlify, GitHub Pages or Vercel.

## Files

- `index.html`, `style.css`, `game.js`: the game itself
- `main.js`, `package.json`: desktop app wrapper and build settings

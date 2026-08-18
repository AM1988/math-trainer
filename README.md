# 🧮 Math Trainer

A simple, colorful web app that helps kids practice mental arithmetic. Built with plain HTML, CSS, and JavaScript — no frameworks, no build step, no data collection.

## 🚀 Live Demo

**Play it here:** https://am1988.github.io/math-trainer/index.html

Works on desktop, tablet, and phone. Just open the link in any modern browser.

## ✨ Features

- **Bilingual interface** — Ukrainian (default) and English, switchable with one tap.
- **Four core operations** — addition, subtraction, multiplication, and division, all within a configurable number range.
- **Choose what to practice** — pick one or several operation types, or turn on **Advanced mode** to mix everything together.
- **Multiplication table** — a dedicated mode with factors from 1 to 10.
- **Combined expressions** — trickier problems such as `a : b + c × d`, `a × (b − c)`, and more. Division is always exact and every intermediate result stays within range.
- **Number range** — choose up to 20, up to 100, or up to 1000, so it fits both younger and older kids.
- **Two answer modes** — type the answer on the keyboard, pick from multiple choices, or let the app choose randomly per question.
- **Custom session length** — 5, 10, 20, unlimited, or your own number of questions.
- **Timer per question** — optional 10 / 20 / 30 second countdown with a visual bar that warns as time runs low.
- **Sound effects** — friendly cues for correct answers, mistakes, and time-outs.
- **Voice encouragement** — spoken praise on a streak of correct answers, using the browser's built-in speech synthesis.
- **Live stats** — score, streak, and a progress bar, plus a final results screen with accuracy.

## 🕹️ How to Use

1. Open the [live demo](https://am1988.github.io/math-trainer/index.html).
2. Choose the exercise types, number range, answer mode, timer, and how many questions you want.
3. Press **Start** and solve the problems.
4. In keyboard mode, press **Enter** to check an answer and again to move to the next question.

## 🔒 Privacy

The app runs entirely in your browser. It stores nothing and sends no data anywhere.

## 💻 Run It Locally

No installation needed. From the project folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. To reach it from another device on your home Wi-Fi, use your computer's local IP address (for example `http://192.168.1.5:8000`).

## 📁 Project Structure

```
math-trainer/
├── index.html    # markup and screens
├── styles.css    # styling and animations
├── app.js        # game logic, generators, timer, sound, and voice
└── README.md
```

## 📝 Notes

- HTTPS is recommended (and used on the live demo) so that sound and speech work reliably on mobile browsers.
- On iPhone/iPad, audio and voice unlock after the first tap — pressing **Start** takes care of that.

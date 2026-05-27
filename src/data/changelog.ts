export const CHANGELOG_BY_VERSION: Record<string, string[]> = {
  "1.0.0": [
    "Initial NTEMM release.",
    "Added Neverness to Everness mod importing and management.",
    "Added Global and CN game detection logic.",
    "Added loader files installation and management.",
    "Added integrated in-game HUD/UI scale control.",
    "Added bundled Anticensor mod support.",
  ],
  "1.1.0": [
    "Major backend optimization pass for faster and smoother mod applying.",
    "Reduced freezes, black-screen flashes, and unnecessary repeated file scans.",
    "Prevented command windows from appearing during backend operations.",
    "Improved folder icon, archive extraction, and mod import performance.",
    "Reduced unnecessary file copying when mod files are already up to date.",

    "Improved the UI layout and overall mod management experience.",
    "Made mod names clickable for easier and more intuitive enable/disable actions.",
    "Added Select All controls for mod categories.",
    "Added a Clean function to fully remove applied files from the game folder while keeping imported mods saved in NTEMM.",
    "Added automatic mod icon detection for known characters.",

    "Added TW version support.",
    "Improved CN version support.",
    "Added automatic Engine.ini detection based on the detected game version.",
    "Added dependency version checks for bundled files such as loader.asi.",
    "Added a custom pop-up window system.",
    "Added built-in Hide UID mod support.",

    "Improved admin permission handling when the game is installed on the C: drive.",
    "Fixed an issue where applying changes or installing loader files could fail when the game folder was under the C: drive.",
    "Fixed an issue where multiple NTEMM windows could be opened at the same time."
  ],
  "1.2.0": [
    "Updated several UI elements to use clearer icons instead of plain text.",
    "Improved mod cards to show the most relevant mod data while collapsed.",
    "Improved ASI mod cleanup to also remove matching .log files when available.",
    "Added support for mod preview images.",
    "Added automatic closing for common alert popups.",
    "Added early GameBanana integration preparation for a future built-in mod browser.",
    "Fixed CN version loader compatibility after the 27/05/2026 launcher update.",
    "Fixed Anticensor status detection so it reflects the actual installed file state.",
    "Fixed UI mods status detection so installed mods stay correctly shown even when loader files are missing."
  ]
}
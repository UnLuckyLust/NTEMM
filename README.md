<h1 align="center">NTE Mod Manager</h1>

<p align="center">
  <a href="https://www.virustotal.com/gui/file/a28823e1443b2294c0a6a3182de70e787ca0c07f58760724acd93303bc65ca1d">
    <img src="https://img.shields.io/badge/VirusTotal-Scan-blue?style=for-the-badge&logo=virustotal" />
  </a>
</p>

<p align="center">
  A modern lightweight mod manager for <b>Neverness to Everness</b>.
</p>

<p align="center">
  Easily install, organize and manage your mods with a clean desktop interface.
</p>

<img width="2560" height="1440" alt="HomePage" src="https://github.com/user-attachments/assets/e5cb8722-08de-44b3-9815-66480c3dd0b3" />

## About
NTE Mod Manager is a lightweight desktop application designed to make modding Neverness to Everness easier and more organized.

Instead of manually moving `.pak` and `.asi` files around your game folders, the app lets you manage everything from a simple interface with category support, drag & drop organization, pending changes tracking, built-in loader installation and more.

The app is built with **Tauri** for fast startup times, low memory usage and a lightweight footprint.

## Features
- Import and manage `.pak` and `.asi` mods
- Organize mods with custom categories and drag & drop support
- Enable or disable mods with a pending changes system
- Automatic loader and game detection
- Read mod metadata from `mod.json`
- Custom mod folder icons and file previews
- Built-in loader installation and management
- Optional bundled Anticensor mod toggle
- Integrated HUD/UI scale editor with automatic `Engine.ini` detection
- Supports Global, CN and TW game versions
- Modern lightweight desktop UI built with Tauri

## Installation
1. Download the installer [release](https://github.com/UnLuckyLust/NTEMM/releases/latest)
2. Run the setup file
3. Follow the installation steps
4. Launch `NTEMM.exe`
5. Select your game folder and start managing mods

## Supported Mod Types
Currently supported:
- `.pak`
- `.asi`

The manager automatically organizes supported files into the correct game locations.

## Integrated Tools
- Built-in mod loader installation and managment
- Optional bundled Anticensor mod toggle
- Integrated HUD/UI scale editor with automatic `Engine.ini` detection
- Optional bundled UID hider mod

## For Mod Creators
NTEMM supports an optional `mod.json` metadata file.
Adding a `mod.json` file to your mod folder allows the manager to automatically display extra information inside the app, such as the mod name, author, version, description, tags, and related links.

### Example `mod.json`
```json
{
  "name": "ModName",
  "version": "1.0.0",
  "author": "AuthorName",
  "description": "Short description of the mod.",
  "modLink": "https://gamebanana.com/tools/22823",
  "supportLink": "https://ko-fi.com/unluckylust",
  "tags": ["Character", "Skin", "SFW"]
}
```

### Preview Images
NTEMM supports an option to include preview images with mods so they can be displayed directly inside the app.
<br/>To add previews, simply place the images next to the mod files and make sure their file names contain `preview`.
<br/>Supported image formats include: .png | .jpg | .jpeg | .webp | .gif | .bmp | .avif

## Important Notes
> [!NOTE]
> Since the application is currently unsigned, Windows Defender or SmartScreen may display a warning when launching the app for the first time, This is normal for many indie and open-source applications.

> [!WARNING]
 The application does not create mods or modify game code.  
> The application is only used to organize, install and manage existing community-made mods.

## Contributing
Feedback, suggestions and bug reports are always welcome.
If you encounter issues or have ideas for improvements, feel free to open an issue or contribute to the project.

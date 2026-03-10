# Library Note Generator

An Obsidian plugin that automatically creates companion Markdown notes for library files (books, PDFs, EPUBs, etc.) stored in your vault, optionally populated with metadata fetched from your Zotero library.

## Features

- **Auto-create on add** — when a library file is added to a watched folder, a companion note is created immediately.
- **Zotero metadata** — titles, authors, tags, and other fields are pulled from Zotero and written as file properties (frontmatter).
- **Smart re-generation** — re-running note generation refreshes only the Zotero-managed frontmatter fields; any body text or custom frontmatter keys you have added are preserved.
- **Local-first Zotero** — queries the local Zotero desktop app (no rate limits) and falls back to the Zotero web API automatically.
- **Filename fallback** — if no Zotero match is found, the book file name is used as the note title.

## Requirements

- Obsidian 1.11.4 or later (desktop only)
- [Zotero](https://www.zotero.org/) desktop app, or a Zotero web API key

## Installation

### From the community plugin list

1. Open **Settings → Community plugins** and disable Safe mode if prompted.
2. Select **Browse**, search for **Library Note Generator**, and install it.
3. Enable the plugin.

### Manual installation

Copy `main.js`, `manifest.json`, and `styles.css` to:

```
<Vault>/.obsidian/plugins/library-note-generator/
```

Then enable the plugin in **Settings → Community plugins**.

## Setup

### 1. Add watched folders

In **Settings → Library Note Generator → Watched folders**, add the vault folders that contain your library files. Only files inside these folders will have notes generated.

### 2. Configure Zotero

**Option A — Local Zotero (recommended)**

Enable the local API in Zotero: **Edit → Settings → Advanced → Allow other applications on this computer to communicate with Zotero**. No API key is needed.

Enter your numeric Zotero **User ID** (found at [zotero.org/settings/keys](https://www.zotero.org/settings/keys)) in **Settings → Library Note Generator → Zotero → User ID**.

**Option B — Zotero web API**

Enter your **User ID** and a read-only **API key** (created at [zotero.org/settings/keys](https://www.zotero.org/settings/keys)) in the settings. The API key is stored securely using Obsidian's SecretStorage.

### 3. Choose a companion note location

- **Subfolder mode** (default) — notes are created in a subfolder inside each watched folder (e.g. `Books/Notes/`).
- **Global folder mode** — all notes are created in one vault-wide folder.

Set the subfolder or folder name under **Settings → Library Note Generator → Companion note settings**.

## Usage

### Commands

| Command                                  | Description                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Generate note for current file**       | Creates or updates the companion note for the active library file. If Zotero returns multiple matches, a picker modal appears.      |
| **Generate notes for all library files** | Batch-processes every library file in all watched folders. Multiple Zotero matches are resolved by auto-selecting the first result. |

### Generated frontmatter

```yaml
---
title: "The Art of Doing Science and Engineering"
author: "Richard Hamming"
year: "1997"
publisher: "Gordon and Breach"
language: "en"
isbn: "9789056995256"
date_added: "2023-04-12"
file: "[[Books/Hamming - The Art of Doing Science and Engineering.pdf]]"
tags: ["engineering", "science", "career"]
---
```

### Re-generating notes

Running either command on a file that already has a companion note updates only the Zotero-managed fields listed above. Your own frontmatter keys and all body content below the closing `---` are left untouched.

## License

[BSD Zero Clause License](LICENSE)


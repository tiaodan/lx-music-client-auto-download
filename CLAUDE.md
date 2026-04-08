# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
```

## Architecture Overview

This is an Electron + Vue 3 desktop music player application.

### Process Structure
- **main** (`src/main/`) - Electron main process, handles window management, IPC, database
- **renderer** (`src/renderer/`) - Main window Vue 3 application
- **renderer-lyric** (`src/renderer-lyric/`) - Separate lyric window process
- **common** (`src/common/`) - Shared code between processes

### Key Directories in renderer
- `views/` - Vue Router pages
- `components/` - Vue components (base/ for primitives, material/ for complex, layout/ for structure)
- `store/` - State management (reactive state, actions)
- `core/` - Core logic (player, music utilities)
- `utils/` - Utilities including musicSdk

### musicSdk
Multi-source music API abstraction at `src/renderer/utils/musicSdk/`. Sources: `kw` (酷我), `kg` (酷狗), `tx` (QQ), `wy` (网易), `mg` (咪咕).

```javascript
import musicSdk from '@renderer/utils/musicSdk'
// Example: search playlists
const result = await musicSdk.tx.songList.search(keyword, page, limit)
// Example: get playlist detail
const detail = await musicSdk.tx.songList.getListDetail(playlistId)
```

### Download System
- `src/renderer/store/download/` - Download state management
- `src/renderer/worker/download/` - Download worker thread
- `src/main/worker/dbService/` - SQLite database service

### Templates & Styles
- Vue templates use **Pug** syntax (`<template lang="pug">`)
- Styles use **Less** with CSS Modules (`<style lang="less" module>`)
- Use CSS variables like `--color-primary`, `--color-text`, `--color-border`

### Internationalization
Language files at `src/lang/` (zh-cn.json, zh-tw.json, en-us.json). Access via `window.i18n.t('key')` or `useI18n()` in Vue components.

### IPC Communication
Renderer ↔ Main process via `src/renderer/utils/ipc.ts`. Uses event names from `src/common/ipcNames.ts`.

### Database
Uses better-sqlite3 with tables for download list, user lists, etc. Schema at `src/main/worker/dbService/tables.ts`.
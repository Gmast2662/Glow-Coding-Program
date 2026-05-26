# Community Libraries — Implementation Plan

## How It Should Work (Overview)

1. Someone submits a library → opens a GitHub Issue with their code
2. You review it in GitHub Issues
3. You accept it → copy the code into `community/` folder in your repo and update `community-index.json`
4. You deny it → close the Issue with a comment
5. Everyone's app fetches `community-index.json` on each update check
6. New libraries appear automatically in the Browse Libraries panel (patch update — no reinstall)

---

## What Needs to Be Built

### A. In your GitHub repo (no coding, just files)
- [ ] Create a `community/` folder in the root of your repo
- [ ] Create `community/community-index.json` — the registry file the app fetches
- [ ] Create a GitHub Issue template so submissions are formatted consistently

### B. In the IDE (code changes)
- [ ] `updater.js` — fetch `community-index.json` from GitHub on each update check
- [ ] `main.js` — merge community libs into the config so they appear in the UI
- [ ] `glow-config.js` — add `communityLibsUrl` pointing to your raw GitHub URL
- [ ] Library browser panel — show a "Community" section separate from built-ins
- [ ] Download + cache community library `.js` files when a user imports one
- [ ] The Glow runtime — load cached community lib files when `import "libname"` is called

### C. Submission system (GitHub Issues — no extra service needed)
- [ ] GitHub Issue template file at `.github/ISSUE_TEMPLATE/library-submission.md`
- [ ] You review, test, and accept/deny in GitHub Issues
- [ ] Accepted: add the `.js` file to `community/` and update `community-index.json`
- [ ] Denied: close the issue with a reason comment

---

## File Structure to Add to Your Repo

```
glow-project/
├── community/
│   ├── community-index.json       ← registry (fetched by app)
│   ├── strings.js                 ← example accepted library
│   └── colors.js                  ← example accepted library
└── .github/
    └── ISSUE_TEMPLATE/
        └── library-submission.md  ← submission form template
```

---

## What community-index.json Looks Like

```json
{
  "version": 1,
  "updated": "2025-01-01",
  "libraries": [
    {
      "id": "strings",
      "file": "strings",
      "display": "Strings",
      "desc": "Extra string utilities — split, join, startsWith, endsWith.",
      "author": "github-username",
      "version": "1.0.0",
      "funcs": ["split", "join", "startsWith", "endsWith"],
      "url": "https://raw.githubusercontent.com/YOUR_USERNAME/glow-language/main/community/strings.js"
    }
  ]
}
```

---

## What a Community Library .js File Looks Like

```js
// strings.js — community library for Glow
module.exports = {
  split:      (str, sep) => str.split(sep),
  join:       (arr, sep) => arr.join(sep),
  startsWith: (str, prefix) => str.startsWith(prefix),
  endsWith:   (str, suffix) => str.endsWith(suffix),
};
```

---

## What the GitHub Issue Submission Template Looks Like

People fill this out when submitting. You see it in GitHub Issues.

```markdown
**Library Name:**
**Your GitHub username:**
**Description (one sentence):**
**Functions it provides:**

**Code:**
(paste the full .js file here)

**Example usage in Glow:**
(paste a short Glow program using this library)
```

---

## Your Review Process

When someone submits:
1. Go to GitHub Issues → find submissions labeled `library-submission`
2. Read the code — check it's safe, no network calls, no file system abuse, no infinite loops
3. Test it by dropping the `.js` into your `community/` folder and importing it in Glow
4. **Accept:** add the file, update `community-index.json`, close the issue with "Accepted in v1.x.x"
5. **Deny:** close the issue with a reason (e.g. "Too similar to built-in math lib" or "Unsafe code")

---

## How the Auto-Update Works for Libraries

- The app already checks GitHub every 5 minutes (after your interval change)
- You add a second fetch in `updater.js` that also pulls `community-index.json`
- If the list has changed (new library added), it's shown in Browse Libraries automatically
- The actual `.js` file is only downloaded when a user first imports that library
- It gets cached locally so it works offline after first use

This means: you accept a library → update the JSON → within 5 minutes everyone sees it.
**No version bump needed. No installer update. Just update the JSON.**

---

## Prompt to Give Back to Claude

Copy and paste this entire message to continue building this feature:

---

I'm working on the Glow IDE project (Electron app, Windows installer, GitHub auto-updates).
I need to implement community libraries. Here is the plan we agreed on:

- Community libraries live in a `community/` folder in my GitHub repo
- A `community/community-index.json` file lists all approved libraries
- The app fetches this JSON on every update check (every 5 minutes)
- New/updated libraries appear automatically in the Browse Libraries panel
- Library `.js` files are downloaded and cached locally on first import
- Submissions come in via GitHub Issues using a template
- I review and accept/deny manually, then update the JSON + add the file

Files that need to be created or modified:
1. `community/community-index.json` — the registry (CREATE, give me a starter file)
2. `community/strings.js` — example accepted library (CREATE, as a demo)
3. `.github/ISSUE_TEMPLATE/library-submission.md` — submission form (CREATE)
4. `glow-ide/src/updater.js` — add community index fetch alongside the existing update check (MODIFY)
5. `glow-ide/glow-config.js` — add `communityLibsUrl` field (MODIFY, just tell me the line)
6. `glow-ide/src/main.js` — merge fetched community libs into config for the UI (MODIFY)
7. The library browser panel in the renderer — show a Community section (MODIFY, find the right file)
8. The Glow runtime — load cached community lib `.js` files on import (MODIFY)

My repo is at: https://github.com/YOUR_USERNAME/glow-language
My project folder structure is: glow-project/glow-ide/ and glow-project/glow-language-new/

Please build this step by step, starting with the files I need to add to GitHub,
then the updater changes, then the UI changes, then the runtime.

# Glow Community Library Approval Guide

## Setup (one time)

1. **Copy `approve-library.js` into `glow-ide/scripts/`:**
   - `approve-library.js` → `glow-ide/scripts/approve-library.js`

2. **Update `glow-ide/package.json`:**
   - Replace your `package.json` with the updated one (adds `"approve"` script)

3. **Create the community folder** (if it doesn't exist):
   ```
   mkdir -p glow-project/community
   ```

4. **Verify paths:**
   - `glow-ide/scripts/approve-library.js` exists
   - `glow-ide/package.json` has the `"approve"` script
   - `glow-project/community/` exists (one level up from glow-ide)

## Workflow (every submission)

### 1️⃣ Get Formspree submission
Copy the fields from the Formspree email. They look like:
```
* name: test
* display: test
* author: Bob
* description: something something...
* version: 1
* library_code: func hi() { }
```

### 2️⃣ Run approval command
From `glow-ide/`, run:
```bash
npm run approve -- \
  --name "test" \
  --display "test" \
  --author "Bob" \
  --description "something something..." \
  --version "1.0.0" \
  --code "func hi() { }"
```

**Or on Windows (single line):**
```bash
npm run approve -- --name "test" --display "test" --author "Bob" --description "something something..." --version "1.0.0" --code "func hi() { }"
```

### What the script does:
✔ Resolves paths up to `glow-project/community/`  
✔ Converts name to slug (e.g. "test" → "test")
✔ Validates the code has `func` declarations  
✔ Extracts function names automatically  
✔ Saves `../community/test.js` with the code  
✔ Saves `../community/test.meta.json` with metadata  
✔ Updates `../community/community-index.json` registry  
✔ Stamps approval date

### 3️⃣ Review the output
The script prints coloured output. If it says ✔ at the end, you're good.

### 4️⃣ Ship it
```bash
cd glow-ide/
# Bump patch version in ../glow-config.js (e.g. 1.20.0 → 1.20.1)
# Then release:
npm run release
```

---

## Handling edge cases

**Name with spaces:** 
- Formspree: `name: "String Utils"`
- Command: `--name "string-utils"` (convert to slug yourself, or the script will)
- Auto-converts to ID: `string-utils`

**Version as integer:**
- Formspree: `version: 1`
- Command: `--version "1.0.0"` (convert to semver format)
- Script will warn but accept it

**Multi-line code:**
- Wrap the entire code in **single quotes** if it spans multiple lines:
  ```bash
  npm run approve -- --name "..." --code '
  func add(a, b) {
    return a + b
  }
  '
  ```

**Special characters in description:**
- Use **double quotes** for the whole arg, **single quotes** inside:
  ```bash
  npm run approve -- --description "It's a great library!"
  ```

---

## File locations

After approval, files land in `glow-project/community/`:
```
glow-project/
└── community/
    ├── community-index.json         ← updated registry
    ├── test.js                      ← the approved code
    └── test.meta.json               ← metadata (author, date, etc.)
```

All saves happen at `../community/` relative to where the script runs.

---

## Project structure

```
glow-project/
├── glow-ide/
│   ├── scripts/
│   │   ├── approve-library.js       ← NEW (put here)
│   │   └── release.js
│   ├── package.json                 ← UPDATED (replace yours)
│   └── ...
├── glow-config.js
└── community/                       ← NEW (create if missing)
    ├── community-index.json
    ├── test.js
    └── test.meta.json
```

---

## Troubleshooting

**"Cannot find module" or path errors**
→ Make sure `approve-library.js` is in `glow-ide/scripts/` and you're running `npm run approve` from inside `glow-ide/`

**"Missing required arguments"**
→ You forgot one of the 6 fields: `--name`, `--display`, `--author`, `--description`, `--version`, `--code`

**"No func declarations found"**
→ The code doesn't have any `func` keyword. Example of valid code:
```javascript
func greet(name) {
  return "Hello, " + name
}
```

**"Name cannot be converted to a valid ID"**
→ The `--name` is all special characters or empty. Use alphanumeric + hyphens, e.g. "string-utils".

**Version doesn't match X.Y or X.Y.Z**
→ Script warns but still saves. Use format like "1.0.0" to be clean.

---

## Testing locally

Before sharing with submitters, test with:
```bash
cd glow-ide/
npm run approve -- \
  --name "math-utils" \
  --display "Math Utils" \
  --author "Test Author" \
  --description "Basic math helpers" \
  --version "1.0.0" \
  --code "func double(x) { return x * 2 }"
```

Then check:
- ✔ `../community/math-utils.js` exists
- ✔ `../community/math-utils.meta.json` exists  
- ✔ `../community/community-index.json` has the entry

Done! ✨

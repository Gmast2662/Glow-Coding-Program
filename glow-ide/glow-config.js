/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              GLOW IDE — CENTRAL CONFIG                   ║
 * ║                                                          ║
 * ║  Edit this file to:                                      ║
 * ║   • Bump the version                                     ║
 * ║   • Add/edit built-in libraries                          ║
 * ║   • Add/edit example sketches                            ║
 * ║   • Edit the Help → Language Reference docs              ║
 * ║   • Edit the About text                                  ║
 * ║   • Configure the update server                          ║
 * ╚══════════════════════════════════════════════════════════╝
 */

"use strict";

module.exports = {

  // ─── Version ───────────────────────────────────────────────────────────────
  // Bump this when you release. Format: MAJOR.MINOR.PATCH
  // MAJOR = breaking change / full reinstall needed
  // MINOR = new features, no reinstall (app notifies user to update)
  // PATCH = content-only change (libraries, examples, docs) — auto-applied silently
  version: "1.2.2",

  // ─── Update Server ─────────────────────────────────────────────────────────
  // Point this at your GitHub repo. The updater checks:
  //   https://api.github.com/repos/{owner}/{repo}/releases/latest
  // Set enabled: false to disable update checks entirely.
  updates: {
    enabled: true,
    owner: "Gmast2662",
    repo: "Glow-Coding-Program",
    checkIntervalMs: 1000 * 60 * 5,  // check every 5 mins
  },

  // ─── About ─────────────────────────────────────────────────────────────────
  about: {
    name: "Glow",
    tagline: "A simple, readable programming language.",
    description: "Glow combines Processing-like simplicity with JavaScript syntax. Learn to code fast without the complexity — no async, no classes, just clear, readable code. Build libraries as easily as you learn the language.",
    website: "",
    github: "",
  },

  // ─── Built-in Libraries ────────────────────────────────────────────────────
  // These appear in Library → Browse Libraries.
  // "file" is the import name (import "math").
  // "funcs" is shown in the detail panel.
  libraries: [
    {
      id: "accounts",
      file: "accounts",
      display: "Accounts",
      type: "builtin",
      desc: "Account management — login, signup, and password changes. Data lives in memory for the session.",
      funcs: ["addAccount", "removeAccount", "login", "changePass", "listAccounts", "accountCount", "accountExists", "getEmail"],
    },
    {
      id: "math",
      file: "math",
      display: "Math",
      type: "builtin",
      desc: "Extended math library. Note: abs, max, min, clamp, pow, floor, ceil, sqrt, round are already global — no import needed.",
      funcs: ["abs", "max", "min", "clamp", "pow"],
    },
    // ── Add your own libraries here ──────────────────────────────────────────
    // {
    //   id:      "mylib",
    //   file:    "mylib",
    //   display: "My Library",
    //   type:    "builtin",   // or "community"
    //   desc:    "What it does.",
    //   funcs:   ["funcOne", "funcTwo"],
    // },
  ],

  // ─── Example Sketches ──────────────────────────────────────────────────────
  // These appear in Help → Load Example.
  // Keep "code" as a plain string with \n for newlines.
  examples: [
    {
      name: "Hello World",
      desc: "The classic first program",
      code: [
        'var name = input("What is your name? ")',
        'print("Hello, " + name + "!")',
        "",
      ].join("\n"),
    },
    {
      name: "Counter",
      desc: "A simple while loop counter",
      code: [
        "var i = 1",
        "while (i <= 10) {",
        "    print(i)",
        "    i = i + 1",
        "}",
        'print("Done!")',
        "",
      ].join("\n"),
    },
    {
      name: "Guessing Game",
      desc: "Pick a number and guess it",
      code: [
        "var secret = random(1, 100)",
        "var guesses = 0",
        "var won = false",
        'print("Guess a number between 1 and 100.")',
        "while (!won) {",
        '    var guess = toNumber(input("Your guess: "))',
        "    guesses = guesses + 1",
        "    if (guess < secret) {",
        '        print("Too low!")',
        "    } else if (guess > secret) {",
        '        print("Too high!")',
        "    } else {",
        "        won = true",
        '        print("Correct! You got it in " + guesses + " guesses.")',
        "    }",
        "}",
        "",
      ].join("\n"),
    },
    {
      name: "FizzBuzz",
      desc: "The classic programming challenge",
      code: [
        "var i = 1",
        "while (i <= 30) {",
        "    if (i / 3 == floor(i / 3) and i / 5 == floor(i / 5)) {",
        '        print("FizzBuzz")',
        "    } else if (i / 3 == floor(i / 3)) {",
        '        print("Fizz")',
        "    } else if (i / 5 == floor(i / 5)) {",
        '        print("Buzz")',
        "    } else {",
        "        print(i)",
        "    }",
        "    i = i + 1",
        "}",
        "",
      ].join("\n"),
    },
    {
      name: "Calculator",
      desc: "Add, subtract, multiply, divide",
      code: [
        'var a = toNumber(input("First number: "))',
        'var op = input("Operator (+, -, *, /): ")',
        'var b = toNumber(input("Second number: "))',
        "var result = 0",
        'if (op == "+") {',
        "    result = a + b",
        '} else if (op == "-") {',
        "    result = a - b",
        '} else if (op == "*") {',
        "    result = a * b",
        '} else if (op == "/") {',
        "    if (b == 0) {",
        '        print("Error: cannot divide by zero")',
        "        exit(1)",
        "    }",
        "    result = a / b",
        "} else {",
        '    print("Unknown operator: " + op)',
        "    exit(1)",
        "}",
        'print(a + " " + op + " " + b + " = " + result)',
        "",
      ].join("\n"),
    },
    {
      name: "File Notes",
      desc: "Save and load notes from a file",
      code: [
        'var file = "notes.txt"',
        'var cmd = input("(r)ead / (w)rite / (c)lear: ")',
        'if (cmd == "r") {',
        "    if (fileExists(file)) {",
        "        print(readFile(file))",
        "    } else {",
        '        print("No notes yet.")',
        "    }",
        '} else if (cmd == "w") {',
        '    var note = input("Note: ")',
        '    appendFile(file, note + "\\n")',
        '    print("Saved!")',
        '} else if (cmd == "c") {',
        '    writeFile(file, "")',
        '    print("Notes cleared.")',
        "}",
        "",
      ].join("\n"),
    },
    // ── Add your own examples here ───────────────────────────────────────────
    // {
    //   name: "My Example",
    //   desc: "What it demonstrates",
    //   code: 'print("hello")\n',
    // },
  ],

  // ─── Language Reference Docs ───────────────────────────────────────────────
  // Each section appears as a tab in Help → Language Reference.
  // Use simple HTML. Available span classes for syntax highlighting:
  //   .kw (keywords), .str (strings), .num (numbers), .cmt (comments), .fn (functions)
  docs: [
    {
      id: "basics",
      label: "Basics",
      html: `
<h2>Basics</h2>
<h3>Variables</h3>
<p>Declare with <code>var</code>. No types needed.</p>
<pre><span class="kw">var</span> name = <span class="str">"Alice"</span>
<span class="kw">var</span> score = <span class="num">0</span>
<span class="kw">var</span> active = <span class="kw">true</span></pre>
<h3>Print &amp; Input</h3>
<pre><span class="kw">print</span>(<span class="str">"Hello!"</span>)
<span class="kw">var</span> name = <span class="fn">input</span>(<span class="str">"Your name: "</span>)</pre>
<h3>Comments</h3>
<pre><span class="cmt">// This is a comment</span>
<span class="kw">var</span> x = <span class="num">10</span>  <span class="cmt">// inline comment</span></pre>
<p><strong>Tip:</strong> Select lines and press <code>Ctrl+/</code> to toggle comments.</p>
`,
    },
    {
      id: "control",
      label: "Control Flow",
      html: `
<h2>Control Flow</h2>
<h3>If / Else</h3>
<pre><span class="kw">if</span> (score > <span class="num">10</span>) {
    <span class="kw">print</span>(<span class="str">"You win!"</span>)
} <span class="kw">else if</span> (score > <span class="num">5</span>) {
    <span class="kw">print</span>(<span class="str">"Getting there"</span>)
} <span class="kw">else</span> {
    <span class="kw">print</span>(<span class="str">"Keep trying"</span>)
}</pre>
<h3>While Loop</h3>
<pre><span class="kw">var</span> i = <span class="num">0</span>
<span class="kw">while</span> (i < <span class="num">5</span>) {
    <span class="kw">print</span>(i)
    i = i + <span class="num">1</span>
}</pre>
<h3>Repeat</h3>
<pre><span class="kw">repeat</span> <span class="num">3</span> {
    <span class="kw">print</span>(<span class="str">"hello"</span>)
}</pre>
`,
    },
    {
      id: "functions",
      label: "Functions",
      html: `
<h2>Functions</h2>
<pre><span class="kw">func</span> <span class="fn">greet</span>(name) {
    <span class="kw">return</span> <span class="str">"Hello, "</span> + name + <span class="str">"!"</span>
}
<span class="kw">print</span>(<span class="fn">greet</span>(<span class="str">"Alice"</span>))</pre>
<h3>Functions as values</h3>
<pre><span class="kw">var</span> nums = [<span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span>, <span class="num">4</span>]
<span class="kw">var</span> big = nums.filter(<span class="kw">func</span> check(x) {
    <span class="kw">return</span> x > <span class="num">2</span>
})</pre>
`,
    },
    {
      id: "arrays",
      label: "Arrays & Tables",
      html: `
<h2>Arrays &amp; Tables</h2>
<h3>Arrays</h3>
<pre><span class="kw">var</span> a = [<span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span>]
a.add(<span class="num">4</span>)
<span class="kw">print</span>(a.length())
<span class="kw">print</span>(<span class="fn">range</span>(<span class="num">5</span>))   <span class="cmt">// [0,1,2,3,4]</span></pre>
<h3>Tables</h3>
<pre><span class="kw">var</span> player = { name: <span class="str">"Alice"</span>, score: <span class="num">0</span> }
player.score = player.score + <span class="num">10</span>
<span class="kw">print</span>(<span class="fn">keys</span>(player))</pre>
`,
    },
    {
      id: "builtins",
      label: "Built-ins",
      html: `
<h2>Built-in Globals</h2>
<h3>Math (no import needed)</h3>
<pre><span class="fn">floor</span>(<span class="num">4.9</span>)   <span class="fn">ceil</span>(<span class="num">4.1</span>)   <span class="fn">round</span>(<span class="num">4.5</span>)
<span class="fn">abs</span>(<span class="num">-7</span>)    <span class="fn">sqrt</span>(<span class="num">16</span>)   <span class="fn">pow</span>(<span class="num">2</span>, <span class="num">8</span>)
<span class="fn">clamp</span>(<span class="num">150</span>, <span class="num">0</span>, <span class="num">100</span>)   <span class="fn">max</span>(<span class="num">1</span>,<span class="num">5</span>,<span class="num">3</span>)   <span class="fn">min</span>(<span class="num">1</span>,<span class="num">5</span>,<span class="num">3</span>)
<span class="fn">random</span>(<span class="num">1</span>, <span class="num">10</span>)   PI   TAU</pre>
<h3>Strings</h3>
<pre><span class="fn">len</span>(<span class="str">"hello"</span>)   <span class="fn">upper</span>(<span class="str">"hi"</span>)   <span class="fn">lower</span>(<span class="str">"HI"</span>)
<span class="fn">trim</span>(<span class="str">"  hi  "</span>)   <span class="fn">replace</span>(<span class="str">"hi"</span>, <span class="str">"h"</span>, <span class="str">"b"</span>)
<span class="fn">format</span>(<span class="str">"Hi {}!"</span>, name)   <span class="fn">contains</span>(<span class="str">"abc"</span>, <span class="str">"b"</span>)</pre>
<h3>Types</h3>
<pre><span class="fn">typeOf</span>(<span class="num">42</span>)   <span class="fn">isNumber</span>(x)   <span class="fn">toNumber</span>(<span class="str">"5"</span>)   <span class="fn">toStr</span>(<span class="num">9</span>)</pre>
`,
    },
    {
      id: "fileio",
      label: "File I/O",
      html: `
<h2>File I/O</h2>
<pre><span class="fn">writeFile</span>(<span class="str">"data.txt"</span>, <span class="str">"hello\\n"</span>)
<span class="fn">appendFile</span>(<span class="str">"data.txt"</span>, <span class="str">"world\\n"</span>)
<span class="kw">var</span> txt = <span class="fn">readFile</span>(<span class="str">"data.txt"</span>)
<span class="kw">print</span>(<span class="fn">fileExists</span>(<span class="str">"data.txt"</span>))
<span class="fn">deleteFile</span>(<span class="str">"data.txt"</span>)</pre>
<p>Paths are relative to where you run the file from. Use <code>\\n</code> for newlines.</p>
`,
    },
    // ── Add more doc sections here ────────────────────────────────────────────
  ],

};

# Glow Language

A simple, readable programming language.

## Setup (do this once after downloading)

```
npm install
npm run build
```

That's it. You only need Node.js installed — nothing else.

## Running a .glow file

**Windows:**
```
glow myfile.glow
```
or
```
node dist/glow.js myfile.glow
```

**Mac / Linux:**
```
./glow myfile.glow
```
or
```
node dist/glow.js myfile.glow
```

## After editing the interpreter source

Run `npm run build` again, then run your file normally.

## Math functions

All math is built in globally — no import needed:
  floor, ceil, round, sqrt, abs, pow, max, min, random, randomFloat

The libs/math.glow file still exists as an example of how to write a library,
but you don't need to import it to use math functions.

## Creating libraries

Drop a .glow file in the libs/ folder.
Import it in your code with:  import "mylib"

Built-in libraries: math (example), accounts

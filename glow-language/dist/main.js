/**
 * main.ts — quick dev runner (hardcoded source string).
 * For running real .glow files, use: npm run glow <file.glow>
 */
import { Lexer } from "./lexer/Lexer.js";
import { Parser } from "./parser/Parser.js";
import { Interpreter } from "./runtime/Interpreter.js";
const source = `
var x = 10
print(x)
x = x + 5
print(x)

func add(a, b) {
    return a + b
}

print(add(2, 3))
`;
const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();
const interpreter = new Interpreter();
interpreter.run(ast);

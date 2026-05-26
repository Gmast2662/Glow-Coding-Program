import { Token } from "./Token.js";
import { TokenType } from "./TokenType.js";
// Keywords map — driven by glow.config.json via the CLI,
// but also has sensible defaults so the lexer works standalone.
export let keywords = {
    var: TokenType.VAR,
    if: TokenType.IF,
    else: TokenType.ELSE,
    while: TokenType.WHILE,
    repeat: TokenType.REPEAT,
    func: TokenType.FUNC,
    return: TokenType.RETURN,
    print: TokenType.PRINT,
    true: TokenType.TRUE,
    false: TokenType.FALSE,
    and: TokenType.AND,
    or: TokenType.OR,
    import: TokenType.IMPORT
};
/**
 * Call this once at startup with the keywords from glow.config.json.
 * The config maps semantic role -> custom word, e.g. { "func": "def" }.
 * We invert that so the lexer can look up the custom word.
 */
export function applyKeywordConfig(configKeywords) {
    const roleToToken = {
        var: TokenType.VAR,
        if: TokenType.IF,
        else: TokenType.ELSE,
        while: TokenType.WHILE,
        repeat: TokenType.REPEAT,
        func: TokenType.FUNC,
        return: TokenType.RETURN,
        print: TokenType.PRINT,
        true: TokenType.TRUE,
        false: TokenType.FALSE,
        and: TokenType.AND,
        or: TokenType.OR,
        import: TokenType.IMPORT
    };
    keywords = {};
    for (const [role, word] of Object.entries(configKeywords)) {
        if (roleToToken[role] !== undefined) {
            keywords[word] = roleToToken[role];
        }
    }
}
export class Lexer {
    input;
    pos = 0;
    tokens = [];
    constructor(input) {
        this.input = input;
    }
    tokenize() {
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === " " || char === "\t" || char === "\r") {
                this.pos++;
                continue;
            }
            if (char === "\n") {
                this.tokens.push(new Token(TokenType.NEWLINE, "\n"));
                this.pos++;
                continue;
            }
            if (char === "/" && this.peek() === "/") {
                this.skipComment();
                continue;
            }
            if (/[0-9]/.test(char)) {
                this.readNumber();
                continue;
            }
            if (char === '"') {
                this.readString();
                continue;
            }
            if (/[a-zA-Z_]/.test(char)) {
                this.readIdentifier();
                continue;
            }
            switch (char) {
                case "+":
                    this.tokens.push(new Token(TokenType.PLUS, char));
                    break;
                case "-":
                    this.tokens.push(new Token(TokenType.MINUS, char));
                    break;
                case "*":
                    this.tokens.push(new Token(TokenType.STAR, char));
                    break;
                case "/":
                    this.tokens.push(new Token(TokenType.SLASH, char));
                    break;
                case "=":
                    if (this.peek() === "=") {
                        this.pos++;
                        this.tokens.push(new Token(TokenType.EQUAL_EQUAL, "=="));
                    }
                    else {
                        this.tokens.push(new Token(TokenType.EQUAL, "="));
                    }
                    break;
                case "!":
                    if (this.peek() === "=") {
                        this.pos++;
                        this.tokens.push(new Token(TokenType.BANG_EQUAL, "!="));
                    }
                    else {
                        this.tokens.push(new Token(TokenType.BANG, "!"));
                    }
                    break;
                case ">":
                    if (this.peek() === "=") {
                        this.pos++;
                        this.tokens.push(new Token(TokenType.GREATER_EQUAL, ">="));
                    }
                    else {
                        this.tokens.push(new Token(TokenType.GREATER, ">"));
                    }
                    break;
                case "<":
                    if (this.peek() === "=") {
                        this.pos++;
                        this.tokens.push(new Token(TokenType.LESS_EQUAL, "<="));
                    }
                    else {
                        this.tokens.push(new Token(TokenType.LESS, "<"));
                    }
                    break;
                case "(":
                    this.tokens.push(new Token(TokenType.LPAREN, "("));
                    break;
                case ")":
                    this.tokens.push(new Token(TokenType.RPAREN, ")"));
                    break;
                case "{":
                    this.tokens.push(new Token(TokenType.LBRACE, "{"));
                    break;
                case "}":
                    this.tokens.push(new Token(TokenType.RBRACE, "}"));
                    break;
                case "[":
                    this.tokens.push(new Token(TokenType.LBRACKET, "["));
                    break;
                case "]":
                    this.tokens.push(new Token(TokenType.RBRACKET, "]"));
                    break;
                case ",":
                    this.tokens.push(new Token(TokenType.COMMA, ","));
                    break;
                case ".":
                    this.tokens.push(new Token(TokenType.DOT, "."));
                    break;
                case ":":
                    this.tokens.push(new Token(TokenType.COLON, ":"));
                    break;
                default:
                    throw new Error(`Unknown character: ${char}`);
            }
            this.pos++;
        }
        this.tokens.push(new Token(TokenType.EOF, "EOF"));
        return this.tokens;
    }
    skipComment() {
        while (this.pos < this.input.length && this.input[this.pos] !== "\n") {
            this.pos++;
        }
    }
    peek() {
        if (this.pos + 1 >= this.input.length)
            return "\0";
        return this.input[this.pos + 1];
    }
    readNumber() {
        let value = "";
        while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
            value += this.input[this.pos];
            this.pos++;
        }
        this.tokens.push(new Token(TokenType.NUMBER, value));
    }
    readString() {
        this.pos++;
        let value = "";
        while (this.pos < this.input.length && this.input[this.pos] !== '"') {
            if (this.input[this.pos] === "\\") {
                this.pos++;
                switch (this.input[this.pos]) {
                    case "n":
                        value += "\n";
                        break;
                    case "t":
                        value += "\t";
                        break;
                    case "r":
                        value += "\r";
                        break;
                    case '"':
                        value += '"';
                        break;
                    case "\\":
                        value += "\\";
                        break;
                    default: value += "\\" + this.input[this.pos];
                }
            }
            else {
                value += this.input[this.pos];
            }
            this.pos++;
        }
        this.pos++;
        this.tokens.push(new Token(TokenType.STRING, value));
    }
    readIdentifier() {
        let value = "";
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
            value += this.input[this.pos];
            this.pos++;
        }
        const keyword = keywords[value];
        if (keyword !== undefined) {
            this.tokens.push(new Token(keyword, value));
        }
        else {
            this.tokens.push(new Token(TokenType.IDENTIFIER, value));
        }
    }
}

import * as fs from "fs";
// ─── Custom runtime error — prints clean Glow-style messages ─────────────────
export class GlowRuntimeError extends Error {
    glowLine;
    glowCol;
    constructor(message, glowLine, glowCol) {
        super(message);
        this.glowLine = glowLine;
        this.glowCol = glowCol;
        this.name = "GlowRuntimeError";
    }
}
class ReturnValue {
    value;
    constructor(value) {
        this.value = value;
    }
}
class Environment {
    parent;
    values = new Map();
    constructor(parent) {
        this.parent = parent;
    }
    define(name, value) {
        this.values.set(name, value);
    }
    assign(name, value) {
        if (this.values.has(name)) {
            this.values.set(name, value);
            return;
        }
        if (this.parent) {
            this.parent.assign(name, value);
            return;
        }
        throw new Error(`Undefined variable: ${name}`);
    }
    get(name) {
        if (this.values.has(name))
            return this.values.get(name);
        if (this.parent)
            return this.parent.get(name);
        throw new Error(`Undefined variable: ${name}`);
    }
}
export class Interpreter {
    globals = new Environment();
    importResolver;
    constructor() {
        // ─── RANDOM ───────────────────────────────────────────────────────────────
        this.globals.define("random", {
            type: "NativeFunction",
            call: (args) => {
                if (args.length === 0)
                    return Math.floor(Math.random() * 2);
                if (args.length === 1)
                    return Math.floor(Math.random() * (args[0] + 1));
                return Math.floor(Math.random() * (args[1] - args[0] + 1)) + args[0];
            }
        });
        this.globals.define("randomFloat", {
            type: "NativeFunction",
            call: (args) => {
                if (args.length === 0)
                    return Math.random();
                if (args.length === 1)
                    return Math.random() * args[0];
                return Math.random() * (args[1] - args[0]) + args[0];
            }
        });
        // ─── MATH ─────────────────────────────────────────────────────────────────
        this.globals.define("floor", {
            type: "NativeFunction",
            call: (args) => Math.floor(args[0])
        });
        this.globals.define("ceil", {
            type: "NativeFunction",
            call: (args) => Math.ceil(args[0])
        });
        this.globals.define("round", {
            type: "NativeFunction",
            call: (args) => Math.round(args[0])
        });
        this.globals.define("sqrt", {
            type: "NativeFunction",
            call: (args) => Math.sqrt(args[0])
        });
        this.globals.define("abs", {
            type: "NativeFunction",
            call: (args) => Math.abs(args[0])
        });
        this.globals.define("pow", {
            type: "NativeFunction",
            call: (args) => Math.pow(args[0], args[1])
        });
        this.globals.define("max", {
            type: "NativeFunction",
            call: (args) => Math.max(...args)
        });
        this.globals.define("min", {
            type: "NativeFunction",
            call: (args) => Math.min(...args)
        });
        this.globals.define("clamp", {
            type: "NativeFunction",
            call: (args) => Math.min(Math.max(args[0], args[1]), args[2])
        });
        this.globals.define("log", {
            type: "NativeFunction",
            call: (args) => args.length > 1 ? Math.log(args[0]) / Math.log(args[1]) : Math.log(args[0])
        });
        this.globals.define("sign", {
            type: "NativeFunction",
            call: (args) => Math.sign(args[0])
        });
        // Math constants
        this.globals.define("PI", Math.PI);
        this.globals.define("TAU", Math.PI * 2);
        this.globals.define("INFINITY", Infinity);
        // ─── TYPE CHECKING ────────────────────────────────────────────────────────
        this.globals.define("typeOf", {
            type: "NativeFunction",
            call: (args) => {
                const v = args[0];
                if (v === null || v === undefined)
                    return "null";
                if (Array.isArray(v))
                    return "array";
                if (typeof v === "object")
                    return "table";
                return typeof v; // "number", "string", "boolean"
            }
        });
        this.globals.define("isNumber", {
            type: "NativeFunction",
            call: (args) => typeof args[0] === "number"
        });
        this.globals.define("isString", {
            type: "NativeFunction",
            call: (args) => typeof args[0] === "string"
        });
        this.globals.define("isBool", {
            type: "NativeFunction",
            call: (args) => typeof args[0] === "boolean"
        });
        this.globals.define("isArray", {
            type: "NativeFunction",
            call: (args) => Array.isArray(args[0])
        });
        this.globals.define("isTable", {
            type: "NativeFunction",
            call: (args) => typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])
        });
        this.globals.define("isNull", {
            type: "NativeFunction",
            call: (args) => args[0] === null || args[0] === undefined
        });
        // ─── TYPE CONVERSION ──────────────────────────────────────────────────────
        this.globals.define("toNumber", {
            type: "NativeFunction",
            call: (args) => Number(args[0])
        });
        this.globals.define("toStr", {
            type: "NativeFunction",
            call: (args) => {
                const v = args[0];
                if (Array.isArray(v))
                    return "[" + v.join(", ") + "]";
                if (typeof v === "object" && v !== null)
                    return JSON.stringify(v);
                return String(v);
            }
        });
        this.globals.define("toBool", {
            type: "NativeFunction",
            call: (args) => Boolean(args[0])
        });
        // ─── I/O ──────────────────────────────────────────────────────────────────
        this.globals.define("printLine", {
            type: "NativeFunction",
            call: (_args) => { process.stdout.write("\n"); return null; }
        });
        // input(prompt?) — synchronous terminal input using a blocking read trick
        this.globals.define("input", {
            type: "NativeFunction",
            call: (args) => {
                const prompt = args[0] !== undefined ? String(args[0]) : "";
                if (prompt)
                    process.stdout.write(prompt);
                // Read one line synchronously from stdin using a shared buffer
                const buf = Buffer.alloc(4096);
                let result = "";
                let bytesRead = 0;
                // Keep reading until we hit a newline or EOF
                while (true) {
                    try {
                        bytesRead = fs.readSync(0, buf, 0, 1, null);
                    }
                    catch {
                        break;
                    }
                    if (bytesRead === 0)
                        break;
                    const ch = buf.toString("utf8", 0, bytesRead);
                    if (ch === "\n")
                        break;
                    if (ch !== "\r")
                        result += ch;
                }
                return result;
            }
        });
        // ─── FILE I/O ─────────────────────────────────────────────────────────────
        this.globals.define("readFile", {
            type: "NativeFunction",
            call: (args) => {
                const p = String(args[0]);
                if (!fs.existsSync(p))
                    throw new GlowRuntimeError(`readFile: file not found: "${p}"`);
                return fs.readFileSync(p, "utf8");
            }
        });
        this.globals.define("writeFile", {
            type: "NativeFunction",
            call: (args) => {
                fs.writeFileSync(String(args[0]), String(args[1] ?? ""), "utf8");
                return null;
            }
        });
        this.globals.define("appendFile", {
            type: "NativeFunction",
            call: (args) => {
                fs.appendFileSync(String(args[0]), String(args[1] ?? ""), "utf8");
                return null;
            }
        });
        this.globals.define("fileExists", {
            type: "NativeFunction",
            call: (args) => {
                return fs.existsSync(String(args[0]));
            }
        });
        this.globals.define("deleteFile", {
            type: "NativeFunction",
            call: (args) => {
                const p = String(args[0]);
                if (fs.existsSync(p))
                    fs.unlinkSync(p);
                return null;
            }
        });
        // ─── STRINGS STDLIB ───────────────────────────────────────────────────────
        this.globals.define("padStart", {
            type: "NativeFunction",
            call: (args) => String(args[0]).padStart(Number(args[1]), args[2] ?? " ")
        });
        this.globals.define("padEnd", {
            type: "NativeFunction",
            call: (args) => String(args[0]).padEnd(Number(args[1]), args[2] ?? " ")
        });
        this.globals.define("strRepeat", {
            type: "NativeFunction",
            call: (args) => String(args[0]).repeat(Number(args[1]))
        });
        this.globals.define("format", {
            type: "NativeFunction",
            // format("Hello {}", name)  or  format("x={} y={}", x, y)
            call: (args) => {
                let template = String(args[0]);
                for (let i = 1; i < args.length; i++) {
                    template = template.replace("{}", String(args[i]));
                }
                return template;
            }
        });
        this.globals.define("split", {
            type: "NativeFunction",
            call: (args) => String(args[0]).split(args[1] ?? "")
        });
        this.globals.define("join", {
            type: "NativeFunction",
            call: (args) => args[0].join(args[1] ?? "")
        });
        this.globals.define("trim", {
            type: "NativeFunction",
            call: (args) => String(args[0]).trim()
        });
        this.globals.define("upper", {
            type: "NativeFunction",
            call: (args) => String(args[0]).toUpperCase()
        });
        this.globals.define("lower", {
            type: "NativeFunction",
            call: (args) => String(args[0]).toLowerCase()
        });
        this.globals.define("contains", {
            type: "NativeFunction",
            call: (args) => String(args[0]).includes(String(args[1]))
        });
        this.globals.define("startsWith", {
            type: "NativeFunction",
            call: (args) => String(args[0]).startsWith(String(args[1]))
        });
        this.globals.define("endsWith", {
            type: "NativeFunction",
            call: (args) => String(args[0]).endsWith(String(args[1]))
        });
        this.globals.define("replace", {
            type: "NativeFunction",
            call: (args) => String(args[0]).replaceAll(String(args[1]), String(args[2]))
        });
        this.globals.define("len", {
            type: "NativeFunction",
            // Works on strings, arrays, and tables
            call: (args) => {
                const v = args[0];
                if (typeof v === "string")
                    return v.length;
                if (Array.isArray(v))
                    return v.length;
                if (typeof v === "object" && v !== null)
                    return Object.keys(v).length;
                return 0;
            }
        });
        // ─── LIST / ARRAY STDLIB ──────────────────────────────────────────────────
        this.globals.define("range", {
            type: "NativeFunction",
            // range(stop)  or  range(start, stop)  or  range(start, stop, step)
            call: (args) => {
                let start = 0, stop, step = 1;
                if (args.length === 1) {
                    stop = args[0];
                }
                else if (args.length === 2) {
                    start = args[0];
                    stop = args[1];
                }
                else {
                    start = args[0];
                    stop = args[1];
                    step = args[2];
                }
                const out = [];
                if (step > 0)
                    for (let i = start; i < stop; i += step)
                        out.push(i);
                else
                    for (let i = start; i > stop; i += step)
                        out.push(i);
                return out;
            }
        });
        this.globals.define("push", {
            type: "NativeFunction",
            call: (args) => { args[0].push(args[1]); return null; }
        });
        this.globals.define("pop", {
            type: "NativeFunction",
            call: (args) => args[0].pop() ?? null
        });
        this.globals.define("includes", {
            type: "NativeFunction",
            call: (args) => args[0].includes(args[1])
        });
        this.globals.define("indexOf", {
            type: "NativeFunction",
            call: (args) => {
                const v = args[0];
                if (Array.isArray(v))
                    return v.indexOf(args[1]);
                if (typeof v === "string")
                    return v.indexOf(String(args[1]));
                return -1;
            }
        });
        this.globals.define("reverse", {
            type: "NativeFunction",
            call: (args) => {
                const v = args[0];
                if (Array.isArray(v))
                    return [...v].reverse();
                if (typeof v === "string")
                    return v.split("").reverse().join("");
                return v;
            }
        });
        this.globals.define("slice", {
            type: "NativeFunction",
            call: (args) => args[0].slice(args[1], args[2])
        });
        this.globals.define("sort", {
            type: "NativeFunction",
            // sort(array) for numbers, sort(array, "text") for strings
            call: (args) => {
                const arr = [...args[0]];
                if (args[1] === "text")
                    return arr.sort();
                return arr.sort((a, b) => a - b);
            }
        });
        // ─── TABLE STDLIB ─────────────────────────────────────────────────────────
        this.globals.define("keys", {
            type: "NativeFunction",
            call: (args) => Object.keys(args[0])
        });
        this.globals.define("values", {
            type: "NativeFunction",
            call: (args) => Object.values(args[0])
        });
        this.globals.define("hasKey", {
            type: "NativeFunction",
            call: (args) => args[1] in args[0]
        });
        this.globals.define("merge", {
            type: "NativeFunction",
            call: (args) => ({ ...args[0], ...args[1] })
        });
        // ─── TIME ─────────────────────────────────────────────────────────────────
        this.globals.define("time", {
            type: "NativeFunction",
            call: (_args) => Date.now() / 1000 // seconds since epoch, like most langs
        });
        this.globals.define("timeMs", {
            type: "NativeFunction",
            call: (_args) => Date.now()
        });
        // ─── PROGRAM ──────────────────────────────────────────────────────────────
        this.globals.define("exit", {
            type: "NativeFunction",
            call: (args) => process.exit(args[0] ?? 0)
        });
        this.globals.define("error", {
            type: "NativeFunction",
            call: (args) => { throw new GlowRuntimeError(String(args[0])); }
        });
    }
    setImportResolver(resolver) {
        this.importResolver = resolver;
    }
    run(statements) {
        this.executeBlock(statements, this.globals);
    }
    // ─── EXECUTION ────────────────────────────────────────────────────────────
    executeBlock(statements, environment) {
        for (const statement of statements) {
            const result = this.execute(statement, environment);
            if (result instanceof ReturnValue)
                return result;
        }
    }
    execute(statement, environment) {
        switch (statement.type) {
            case "ImportStatement": {
                if (!this.importResolver)
                    throw new Error("import is not available in this context");
                const stmts = this.importResolver(statement.path);
                this.executeBlock(stmts, this.globals);
                return;
            }
            case "PrintStatement":
                console.log(this.evaluate(statement.value, environment));
                return;
            case "VarStatement":
                environment.define(statement.name, this.evaluate(statement.value, environment));
                return;
            case "AssignStatement":
                environment.assign(statement.name, this.evaluate(statement.value, environment));
                return;
            case "MemberAssignStatement": {
                const obj = this.evaluate(statement.object, environment);
                const prop = this.evaluate(statement.property, environment);
                obj[prop] = this.evaluate(statement.value, environment);
                return;
            }
            case "IfStatement":
                if (this.evaluate(statement.condition, environment)) {
                    return this.executeBlock(statement.body, new Environment(environment));
                }
                if (statement.elseBody) {
                    return this.executeBlock(statement.elseBody, new Environment(environment));
                }
                return;
            case "WhileStatement":
                while (this.evaluate(statement.condition, environment)) {
                    const r = this.executeBlock(statement.body, new Environment(environment));
                    if (r instanceof ReturnValue)
                        return r;
                }
                return;
            case "RepeatStatement": {
                const count = this.evaluate(statement.count, environment);
                for (let i = 0; i < count; i++) {
                    const r = this.executeBlock(statement.body, new Environment(environment));
                    if (r instanceof ReturnValue)
                        return r;
                }
                return;
            }
            case "FunctionStatement":
                environment.define(statement.name, {
                    type: "Function",
                    declaration: statement,
                    closure: environment
                });
                return;
            case "ReturnStatement":
                return new ReturnValue(this.evaluate(statement.value, environment));
            case "ExpressionStatement":
                return this.evaluate(statement.expression, environment);
        }
    }
    // ─── NATIVE METHODS ───────────────────────────────────────────────────────
    callNativeMethod(object, method, args) {
        // ── ARRAYS ────────────────────────────────────────────────────────────────
        if (Array.isArray(object)) {
            switch (method) {
                // existing
                case "add":
                    object.push(args[0]);
                    return null;
                case "remove": return object.pop();
                case "length": return object.length;
                case "clear":
                    object.length = 0;
                    return null;
                case "contains": return object.includes(args[0]);
                // new
                case "removeAt": {
                    // removeAt(index) — remove item at index, return it
                    const idx = args[0];
                    if (idx < 0 || idx >= object.length)
                        throw new Error("Index out of range");
                    return object.splice(idx, 1)[0];
                }
                case "insert": {
                    // insert(index, value)
                    object.splice(args[0], 0, args[1]);
                    return null;
                }
                case "get": return object[args[0]] ?? null;
                case "set":
                    object[args[0]] = args[1];
                    return null;
                case "first": return object[0] ?? null;
                case "last": return object[object.length - 1] ?? null;
                case "reverse": return [...object].reverse();
                case "sort": return [...object].sort((a, b) => a - b);
                case "sortText": return [...object].sort();
                case "join": return object.join(args[0] ?? ", ");
                case "slice": return object.slice(args[0], args[1]);
                case "indexOf": return object.indexOf(args[0]);
                case "count": return object.filter((x) => x === args[0]).length;
                case "isEmpty": return object.length === 0;
                case "copy": return [...object];
                case "each": {
                    // each(func) — call func(item) for every element
                    for (const item of object) {
                        this.callGlowFunction(args[0], [item]);
                    }
                    return null;
                }
                case "map": {
                    // map(func) — return new array with func applied to each item
                    return object.map((item) => this.callGlowFunction(args[0], [item]));
                }
                case "filter": {
                    // filter(func) — return new array with items where func returns true
                    return object.filter((item) => this.callGlowFunction(args[0], [item]));
                }
            }
        }
        // ── STRINGS ───────────────────────────────────────────────────────────────
        if (typeof object === "string") {
            switch (method) {
                // existing
                case "upper": return object.toUpperCase();
                case "lower": return object.toLowerCase();
                case "split": return object.split(args[0] ?? "");
                // new
                case "length": return object.length;
                case "trim": return object.trim();
                case "trimStart": return object.trimStart();
                case "trimEnd": return object.trimEnd();
                case "startsWith": return object.startsWith(args[0]);
                case "endsWith": return object.endsWith(args[0]);
                case "contains": return object.includes(args[0]);
                case "replace": return object.replaceAll(args[0], args[1]);
                case "slice": return object.slice(args[0], args[1]);
                case "indexOf": return object.indexOf(args[0]);
                case "repeat": return object.repeat(args[0]);
                case "isEmpty": return object.trim().length === 0;
                case "charAt": return object[args[0]] ?? "";
                case "reverse": return object.split("").reverse().join("");
                case "toNumber": return Number(object);
                case "toArray": return object.split("");
            }
        }
        // ── TABLES ────────────────────────────────────────────────────────────────
        if (typeof object === "object" && object !== null && !Array.isArray(object)) {
            switch (method) {
                // existing
                case "keys": return Object.keys(object);
                case "values": return Object.values(object);
                case "has": return args[0] in object;
                // new
                case "get": return object[args[0]] ?? null;
                case "set":
                    object[args[0]] = args[1];
                    return null;
                case "remove": {
                    // remove(key) — delete a key from the table
                    const key = args[0];
                    if (!(key in object))
                        return null;
                    const val = object[key];
                    delete object[key];
                    return val;
                }
                case "length": return Object.keys(object).length;
                case "isEmpty": return Object.keys(object).length === 0;
                case "copy": return { ...object };
                case "merge": {
                    // merge(otherTable) — copy all keys from otherTable into this one
                    const other = args[0];
                    if (typeof other === "object" && other !== null) {
                        for (const k of Object.keys(other))
                            object[k] = other[k];
                    }
                    return null;
                }
                case "toArray": {
                    // toArray() — returns array of {key, value} tables
                    return Object.entries(object).map(([k, v]) => ({ key: k, value: v }));
                }
                case "each": {
                    // each(func) — call func(key, value) for every entry
                    for (const [k, v] of Object.entries(object)) {
                        this.callGlowFunction(args[0], [k, v]);
                    }
                    return null;
                }
            }
        }
        throw new Error(`Unknown method '${method}' on ${Array.isArray(object) ? "array" : typeof object}`);
    }
    // ─── CALL A GLOW FUNCTION VALUE ───────────────────────────────────────────
    // Used by higher-order methods like each/map/filter
    callGlowFunction(fn, args) {
        if (!fn || (fn.type !== "Function" && fn.type !== "NativeFunction")) {
            throw new Error("Expected a function");
        }
        if (fn.type === "NativeFunction")
            return fn.call(args);
        return this.callFunction(fn.declaration, fn.closure, args);
    }
    // ─── EXPRESSIONS ──────────────────────────────────────────────────────────
    evaluate(expression, environment) {
        switch (expression.type) {
            case "NumberLiteral": return expression.value;
            case "StringLiteral": return expression.value;
            case "BooleanLiteral": return expression.value;
            case "ArrayLiteral":
                return expression.values.map(v => this.evaluate(v, environment));
            case "TableLiteral": {
                const obj = {};
                for (const p of expression.properties) {
                    obj[p.key] = this.evaluate(p.value, environment);
                }
                return obj;
            }
            case "Identifier":
                return environment.get(expression.name);
            case "FunctionExpression":
                // Inline/anonymous function — wrap it as a callable Function value
                return {
                    type: "Function",
                    declaration: {
                        type: "FunctionStatement",
                        name: "<anonymous>",
                        params: expression.params,
                        body: expression.body
                    },
                    closure: environment
                };
            case "MemberExpression": {
                const obj = this.evaluate(expression.object, environment);
                const prop = this.evaluate(expression.property, environment);
                return obj[prop];
            }
            case "UnaryExpression": {
                const r = this.evaluate(expression.right, environment);
                switch (expression.operator) {
                    case "!": return !r;
                    case "-": return -r;
                    default: throw new Error(`Unknown unary operator ${expression.operator}`);
                }
            }
            case "BinaryExpression": {
                const left = this.evaluate(expression.left, environment);
                const right = this.evaluate(expression.right, environment);
                switch (expression.operator) {
                    case "+": return left + right;
                    case "-": return left - right;
                    case "*": return left * right;
                    case "/": return left / right;
                    case ">": return left > right;
                    case "<": return left < right;
                    case ">=": return left >= right;
                    case "<=": return left <= right;
                    case "==": return left === right;
                    case "!=": return left !== right;
                    case "and": return left && right;
                    case "or": return left || right;
                    default: throw new Error(`Unknown operator ${expression.operator}`);
                }
            }
            case "CallExpression": {
                // METHOD CALL
                if (expression.callee.type === "MemberExpression") {
                    const obj = this.evaluate(expression.callee.object, environment);
                    const prop = expression.callee.property;
                    const methodName = prop.type === "StringLiteral"
                        ? prop.value
                        : this.evaluate(prop, environment);
                    const args = expression.args.map(a => this.evaluate(a, environment));
                    return this.callNativeMethod(obj, methodName, args);
                }
                // NORMAL CALL
                const callee = this.evaluate(expression.callee, environment);
                const args = expression.args.map(a => this.evaluate(a, environment));
                if (callee.type !== "Function" && callee.type !== "NativeFunction") {
                    throw new Error("Can only call functions");
                }
                if (callee.type === "NativeFunction")
                    return callee.call(args);
                return this.callFunction(callee.declaration, callee.closure, args);
            }
        }
    }
    // ─── FUNCTION CALLING ─────────────────────────────────────────────────────
    callFunction(declaration, closure, args) {
        const environment = new Environment(closure);
        for (let i = 0; i < declaration.params.length; i++) {
            environment.define(declaration.params[i], args[i] ?? null);
        }
        const result = this.executeBlock(declaration.body, environment);
        if (result instanceof ReturnValue)
            return result.value;
        return null;
    }
}

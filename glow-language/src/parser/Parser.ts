import { Token } from "../lexer/Token.js";
import { TokenType } from "../lexer/TokenType.js";

import {
  Statement,
  PrintStatement,
  VarStatement,
  AssignStatement,
  IfStatement,
  WhileStatement,
  RepeatStatement,
  FunctionStatement,
  ReturnStatement,
  ExpressionStatement,
  ImportStatement,
  Expression
} from "../ast/AST.js";

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) { }

  parse(): Statement[] {
    const statements: Statement[] = [];

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;
      statements.push(this.statement());
    }

    return statements;
  }

  private statement(): Statement {
    if (this.match(TokenType.IMPORT)) {
      return this.importStatement();
    }

    if (this.match(TokenType.PRINT)) {
      return this.printStatement();
    }

    if (this.match(TokenType.VAR)) {
      return this.varStatement();
    }

    if (this.match(TokenType.IF)) {
      return this.ifStatement();
    }

    if (this.match(TokenType.WHILE)) {
      return this.whileStatement();
    }

    if (this.match(TokenType.REPEAT)) {
      return this.repeatStatement();
    }

    if (this.match(TokenType.FUNC)) {
      return this.functionStatement();
    }

    if (this.match(TokenType.RETURN)) {
      return this.returnStatement();
    }

    if (this.isAssignmentStatement()) {
      return this.assignmentStatement();
    }

    return this.expressionStatement();
  }

  // =========================
  // STATEMENTS
  // =========================

  private importStatement(): ImportStatement {
    const pathToken = this.consume(TokenType.STRING, "Expected path string after import");
    return {
      type: "ImportStatement",
      path: pathToken.value
    };
  }

  private printStatement(): PrintStatement {
    this.consume(TokenType.LPAREN, "Expected '(' after print");
    const value = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    return { type: "PrintStatement", value };
  }

  private varStatement(): VarStatement {
    const name = this.consume(TokenType.IDENTIFIER, "Expected variable name");
    this.consume(TokenType.EQUAL, "Expected '='");
    const value = this.expression();
    return { type: "VarStatement", name: name.value, value };
  }

  private assignStatement(): AssignStatement {
    const name = this.advance();
    this.consume(TokenType.EQUAL, "Expected '='");
    const value = this.expression();
    return { type: "AssignStatement", name: name.value, value };
  }

  private ifStatement(): IfStatement {
    this.consume(TokenType.LPAREN, "Expected '(' after if");
    const condition = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    const body = this.block();

    this.skipNewlines();

    let elseBody: Statement[] | undefined;

    if (this.match(TokenType.ELSE)) {
      this.skipNewlines();
      if (this.match(TokenType.IF)) {
        elseBody = [this.ifStatement()];
      } else {
        elseBody = this.block();
      }
    }

    return { type: "IfStatement", condition, body, elseBody };
  }

  private whileStatement(): WhileStatement {
    this.consume(TokenType.LPAREN, "Expected '(' after while");
    const condition = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    const body = this.block();
    return { type: "WhileStatement", condition, body };
  }

  private repeatStatement(): RepeatStatement {
    const count = this.expression();
    const body = this.block();
    return { type: "RepeatStatement", count, body };
  }

  private functionStatement(): FunctionStatement {
    const name = this.consume(TokenType.IDENTIFIER, "Expected function name");
    this.consume(TokenType.LPAREN, "Expected '('");

    const params: string[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const param = this.consume(TokenType.IDENTIFIER, "Expected parameter name");
        params.push(param.value);
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ')'");
    const body = this.block();
    return { type: "FunctionStatement", name: name.value, params, body };
  }

  private returnStatement(): ReturnStatement {
    const value = this.expression();
    return { type: "ReturnStatement", value };
  }

  private expressionStatement(): ExpressionStatement {
    return { type: "ExpressionStatement", expression: this.expression() };
  }

  private block(): Statement[] {
    this.consume(TokenType.LBRACE, "Expected '{'");

    const statements: Statement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;
      statements.push(this.statement());
    }

    this.consume(TokenType.RBRACE, "Expected '}'");
    return statements;
  }

  // =========================
  // EXPRESSIONS
  // =========================

  private expression(): Expression {
    return this.or();
  }

  private or(): Expression {
    let expr = this.and();
    while (this.match(TokenType.OR)) {
      const operator = this.previous();
      const right = this.and();
      expr = { type: "BinaryExpression", left: expr, operator: operator.value, right };
    }
    return expr;
  }

  private and(): Expression {
    let expr = this.equality();
    while (this.match(TokenType.AND)) {
      const operator = this.previous();
      const right = this.equality();
      expr = { type: "BinaryExpression", left: expr, operator: operator.value, right };
    }
    return expr;
  }

  private equality(): Expression {
    let expr = this.comparison();
    while (this.match(TokenType.EQUAL_EQUAL) || this.match(TokenType.BANG_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = { type: "BinaryExpression", left: expr, operator: operator.value, right };
    }
    return expr;
  }

  private comparison(): Expression {
    let expr = this.addition();
    while (
      this.match(TokenType.GREATER) ||
      this.match(TokenType.GREATER_EQUAL) ||
      this.match(TokenType.LESS) ||
      this.match(TokenType.LESS_EQUAL)
    ) {
      const operator = this.previous();
      const right = this.addition();
      expr = { type: "BinaryExpression", left: expr, operator: operator.value, right };
    }
    return expr;
  }

  private addition(): Expression {
    let expr = this.multiplication();
    while (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.multiplication();
      expr = { type: "BinaryExpression", left: expr, operator: operator.value, right };
    }
    return expr;
  }

  private multiplication(): Expression {
    let expr = this.unary();
    while (this.match(TokenType.STAR) || this.match(TokenType.SLASH)) {
      const operator = this.previous();
      const right = this.unary();
      expr = { type: "BinaryExpression", left: expr, operator: operator.value, right };
    }
    return expr;
  }

  private unary(): Expression {
    if (this.match(TokenType.BANG) || this.match(TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.unary();
      return { type: "UnaryExpression", operator: operator.value, right };
    }
    return this.call();
  }

  private call(): Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')'");
        expr = { type: "CallExpression", callee: expr, args };
        continue;
      }

      if (this.match(TokenType.DOT)) {
        const name = this.consume(TokenType.IDENTIFIER, "Expected property name");
        expr = {
          type: "MemberExpression",
          object: expr,
          property: { type: "StringLiteral", value: name.value },
          computed: false
        };
        continue;
      }

      if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']'");
        expr = {
          type: "MemberExpression",
          object: expr,
          property: index,
          computed: true
        };
        continue;
      }

      break;
    }

    return expr;
  }

  private primary(): Expression {
    const token = this.advance();

    switch (token.type) {
      case TokenType.NUMBER:
        return { type: "NumberLiteral", value: Number(token.value) };

      case TokenType.STRING:
        return { type: "StringLiteral", value: token.value };

      case TokenType.TRUE:
        return { type: "BooleanLiteral", value: true };

      case TokenType.FALSE:
        return { type: "BooleanLiteral", value: false };

      case TokenType.IDENTIFIER:
        return { type: "Identifier", name: token.value };

      case TokenType.LBRACKET:
        return this.arrayLiteral();

      case TokenType.LBRACE:
        return this.tableLiteral();

      case TokenType.LPAREN: {
        const expr = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')'");
        return expr;
      }

      // Anonymous / inline function: func name(a, b) { ... }  or  func(a, b) { ... }
      case TokenType.FUNC: {
        // Optional name (ignored at runtime — it's just for readability)
        if (this.check(TokenType.IDENTIFIER)) this.advance();

        this.consume(TokenType.LPAREN, "Expected '(' in function expression");
        const params: string[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            params.push(this.consume(TokenType.IDENTIFIER, "Expected parameter name").value);
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')'");
        const body = this.block();

        // Represent as an inline FunctionStatement wrapped in an expression
        return {
          type: "FunctionExpression" as any,
          params,
          body
        };
      }

      default:
        throw new Error(`Unexpected token: ${token.value}`);
    }
  }

  private arrayLiteral(): Expression {
    const values: Expression[] = [];
    if (!this.check(TokenType.RBRACKET)) {
      do {
        values.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RBRACKET, "Expected ']'");
    return { type: "ArrayLiteral", values };
  }

  private tableLiteral(): Expression {
    const properties: any[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      const key = this.consume(TokenType.IDENTIFIER, "Expected property name");
      this.consume(TokenType.COLON, "Expected ':'");
      const value = this.expression();

      properties.push({ key: key.value, value });

      this.match(TokenType.COMMA);
      this.skipNewlines();
    }

    this.consume(TokenType.RBRACE, "Expected '}'");
    return { type: "TableLiteral", properties };
  }

  // =========================
  // HELPERS
  // =========================

  private isAssignmentStatement(): boolean {
    if (!this.check(TokenType.IDENTIFIER)) return false;

    let offset = 1;

    while (true) {
      const token = this.tokens[this.pos + offset];
      if (!token) return false;

      if (token.type === TokenType.DOT) {
        offset += 2;
        continue;
      }

      if (token.type === TokenType.LBRACKET) {
        while (
          this.tokens[this.pos + offset] &&
          this.tokens[this.pos + offset].type !== TokenType.RBRACKET
        ) {
          offset++;
        }
        offset++;
        continue;
      }

      return token.type === TokenType.EQUAL;
    }
  }

  private assignmentStatement(): Statement {
    const target = this.call();
    this.consume(TokenType.EQUAL, "Expected '='");
    const value = this.expression();

    if (target.type === "Identifier") {
      return { type: "AssignStatement", name: target.name, value };
    }

    if (target.type === "MemberExpression") {
      return {
        type: "MemberAssignStatement",
        object: target.object,
        property: target.property,
        value
      };
    }

    throw new Error("Invalid assignment target");
  }

  private skipNewlines() {
    while (this.match(TokenType.NEWLINE)) { }
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(message);
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
}

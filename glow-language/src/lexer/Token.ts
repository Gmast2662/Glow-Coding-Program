import { TokenType } from "./TokenType.js";

export class Token {
  constructor(
    public type: TokenType,
    public value: string
  ) {}
}
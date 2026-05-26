export type Statement =
  | PrintStatement
  | VarStatement
  | AssignStatement
  | MemberAssignStatement
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | FunctionStatement
  | ReturnStatement
  | ExpressionStatement
  | ImportStatement;

export interface PrintStatement {
  type: "PrintStatement";
  value: Expression;
}

export interface VarStatement {
  type: "VarStatement";
  name: string;
  value: Expression;
}

export interface AssignStatement {
  type: "AssignStatement";
  name: string;
  value: Expression;
}

export interface MemberAssignStatement {
  type: "MemberAssignStatement";
  object: Expression;
  property: Expression;
  value: Expression;
}

export interface IfStatement {
  type: "IfStatement";
  condition: Expression;
  body: Statement[];
  elseBody?: Statement[];
}

export interface WhileStatement {
  type: "WhileStatement";
  condition: Expression;
  body: Statement[];
}

export interface RepeatStatement {
  type: "RepeatStatement";
  count: Expression;
  body: Statement[];
}

export interface FunctionStatement {
  type: "FunctionStatement";
  name: string;
  params: string[];
  body: Statement[];
}

export interface ReturnStatement {
  type: "ReturnStatement";
  value: Expression;
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface ImportStatement {
  type: "ImportStatement";
  path: string;
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | ArrayLiteral
  | TableLiteral
  | Identifier
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | FunctionExpression;

export interface FunctionExpression {
  type: "FunctionExpression";
  params: string[];
  body: Statement[];
}

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
}

export interface BooleanLiteral {
  type: "BooleanLiteral";
  value: boolean;
}

export interface ArrayLiteral {
  type: "ArrayLiteral";
  values: Expression[];
}

export interface TableLiteral {
  type: "TableLiteral";
  properties: {
    key: string;
    value: Expression;
  }[];
}

export interface Identifier {
  type: "Identifier";
  name: string;
}

export interface BinaryExpression {
  type: "BinaryExpression";
  left: Expression;
  operator: string;
  right: Expression;
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: string;
  right: Expression;
}

export interface CallExpression {
  type: "CallExpression";
  callee: Expression;
  args: Expression[];
}

export interface MemberExpression {
  type: "MemberExpression";
  object: Expression;
  property: Expression;
  computed: boolean;
}

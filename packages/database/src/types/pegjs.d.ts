declare module "*.pegjs" {
  /** Reference type from the original pegjs SQL Grammar and parser
   * @see https://www.npmjs.com/package/node-sql-parser
   */
  export interface With {
    name: { value: string }
    stmt: {
      _parentheses?: boolean
      tableList: string[]
      columnList: string[]
      ast: Select
    }
    columns?: any[]
  }
  import { LocationRange } from "pegjs"

  export { LocationRange, Location } from "pegjs"

  export type WhilteListCheckMode = "table" | "column"
  export interface ParseOptions {
    includeLocations?: boolean
  }
  export interface Option {
    database?: string
    type?: string
    trimQuery?: boolean
    parseOptions?: ParseOptions
  }
  export interface TableColumnAst {
    tableList: string[]
    columnList: string[]
    ast: AST[] | AST
    loc?: LocationRange
  }
  export interface BaseFrom {
    db: string | null
    table: string
    as: string | null
    schema?: string
    loc?: LocationRange
  }
  export interface Join extends BaseFrom {
    join: "INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN"
    using?: string[]
    on?: Binary
  }
  export interface TableExpr {
    expr: {
      ast: Select
    }
    as?: string | null
    parentheses: boolean | { length: number }
  }
  export interface Dual {
    type: "dual"
    loc?: LocationRange
  }
  export type From = BaseFrom | Join | TableExpr | Dual
  export interface LimitValue {
    type: string
    value: number
    loc?: LocationRange
  }
  export interface Limit {
    seperator: string
    value: LimitValue[]
    loc?: LocationRange
  }
  export interface OrderBy {
    type: "ASC" | "DESC"
    expr: any
    loc?: LocationRange
  }

  export interface ValueExpr<T = string | number | boolean> {
    type:
      | "backticks_quote_string"
      | "string"
      | "regex_string"
      | "hex_string"
      | "full_hex_string"
      | "natural_string"
      | "bit_string"
      | "double_quote_string"
      | "single_quote_string"
      | "boolean"
      | "bool"
      | "null"
      | "star"
      | "param"
      | "origin"
      | "date"
      | "datetime"
      | "default"
      | "time"
      | "timestamp"
      | "var_string"
    value: T
  }

  export interface ColumnRefItem {
    type: "column_ref"
    table: string | null
    column: string | { expr: ValueExpr }
    options?: ExprList
    loc?: LocationRange
  }
  export interface ColumnRefExpr {
    type: "expr"
    expr: ColumnRefItem
    as: string | null
  }

  export type ColumnRef = ColumnRefItem | ColumnRefExpr
  export interface SetList {
    column: string
    value: any
    table: string | null
    loc?: LocationRange
  }
  export interface InsertReplaceValue {
    type: "expr_list"
    value: any[]
    loc?: LocationRange
  }

  export interface Star {
    type: "star"
    value: "*" | ""
    loc?: LocationRange
  }
  export interface Case {
    type: "case"
    expr: null
    args: Array<
      | {
          cond: Binary
          result: ExpressionValue
          type: "when"
        }
      | {
          result: ExpressionValue
          type: "else"
        }
    >
  }
  export interface Cast {
    type: "cast"
    keyword: "cast"
    expr: ExpressionValue
    symbol: "as"
    target: {
      dataType: string
      suffix: unknown[]
    }
  }
  export interface AggrFunc {
    type: "aggr_func"
    name: string
    args: {
      expr: ExpressionValue
      distinct: "DISTINCT" | null
      orderby: OrderBy[] | null
      parentheses?: boolean
    }
    loc?: LocationRange
  }

  export type FunctionName = {
    schema?: { value: string; type: string }
    name: ValueExpr<string>[]
  }
  export interface Function {
    type: "function"
    name: FunctionName
    args?: ExprList
    suffix?: any
    loc?: LocationRange
  }
  export interface Column {
    expr: ExpressionValue
    as: ValueExpr<string> | string | null
    type?: string
    loc?: LocationRange
  }

  export interface Interval {
    type: "interval"
    unit: string
    expr: ValueExpr & { loc?: LocationRange }
  }

  export type Param = { type: "param"; value: string; loc?: LocationRange }

  export type Value = { type: string; value: any; loc?: LocationRange }

  export type Binary = {
    type: "binary_expr"
    operator: string
    left: ExpressionValue | ExprList
    right: ExpressionValue | ExprList
    loc?: LocationRange
    parentheses?: boolean
  }

  export type Expr = Binary

  export type ExpressionValue =
    | ColumnRef
    | Param
    | Function
    | Case
    | AggrFunc
    | Value
    | Binary
    | Cast
    | Interval

  export type ExprList = {
    type: "expr_list"
    value: ExpressionValue[]
    loc?: LocationRange
    parentheses?: boolean
    separator?: string
  }

  export type PartitionBy = {
    type: "expr"
    expr: ColumnRef[]
  }[]

  export type WindowSpec = {
    name: null
    partitionby: PartitionBy
    orderby: OrderBy[] | null
    window_frame_clause: string | null
  }

  export type AsWindowSpec =
    | string
    | { window_specification: WindowSpec; parentheses: boolean }

  export type NamedWindowExpr = {
    name: string
    as_window_specification: AsWindowSpec
  }

  export type WindowExpr = {
    keyword: "window"
    type: "window"
    expr: NamedWindowExpr[]
  }

  export interface Select {
    with: With[] | null
    type: "select"
    options: any[] | null
    distinct: "DISTINCT" | null
    columns: any[] | Column[]
    from: From[] | TableExpr | null
    where: Binary | Function | null
    groupby: { columns: ColumnRef[] | null; modifiers: ValueExpr<string>[] }
    having: any[] | null
    orderby: OrderBy[] | null
    limit: Limit | null
    window?: WindowExpr
    qualify?: any[] | null
    _orderby?: OrderBy[] | null
    _limit?: Limit | null
    parentheses_symbol?: boolean
    _parentheses?: boolean
    loc?: LocationRange
    _next?: Select
    set_op?: string
  }

  export type AST = Select

  export function parse(sql: string, opt?: Option): TableColumnAst

  export function astify(sql: string, opt?: Option): AST[] | AST

  export function sqlify(ast: AST[] | AST, opt?: Option): string

  export function exprToSQL(ast: any, opt?: Option): string

  export function whiteListCheck(
    sql: string,
    whiteList: string[],
    opt?: Option,
  ): Error | undefined

  export function tableList(sql: string, opt?: Option): string[]

  export function columnList(sql: string, opt?: Option): string[]
}

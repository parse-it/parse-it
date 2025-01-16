export type QueryNode = {
  type: "query"
  selects: (SelectNode | string)[]
  from: TableNode | SubQueryNode | string
  joins?: JoinNode[]
  where?: FilterNode
  groupBy?: GroupByNode | string | string[]
  having?: FilterNode
  orderBy?: OrderByNode[]
  limit?: number
  offset?: number
  with?: WithNode[]
  unions?: UnionNode[]
  qualify?: FilterNode
}

export type SelectNode = {
  type: "select"
  expression: ExpressionNode
  alias?: string
}

export type TableNode = {
  type: "table"
  name: string
  alias?: string
}

export type SubQueryNode = {
  type: "subquery"
  query: QueryNode
  alias?: string
}

export type JOIN_TYPE = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS" | "JOIN"
export type JoinNode = {
  type: "join"
  joinType: JOIN_TYPE
  table: TableNode | SubQueryNode
  on: ExpressionNode
}

export type FilterNode = {
  type: "filter"
  operator: "AND" | "OR"
  conditions: (ExpressionNode | FilterNode)[]
}

export type GroupByNode = {
  type: "groupby"
  columns: string[]
}

export type OrderByNode = {
  type: "orderby"
  column: string
  direction: "ASC" | "DESC"
}

export type WithNode = {
  type: "with"
  name: string
  query: QueryNode
}

export type UnionNode = {
  type: "union"
  unionType: "UNION" | "UNION ALL"
  query: QueryNode
}

export type ExpressionNode = {
  type: "expression"
  left: string | number | boolean | ExpressionNode | QueryNode
  operator?: string
  right?: string | number | boolean | ExpressionNode | QueryNode
}

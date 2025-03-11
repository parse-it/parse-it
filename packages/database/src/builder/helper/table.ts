import {
  ExpressionNode,
  FilterNode,
  JoinNode,
  QueryNode,
  SubQueryNode,
  TableNode,
} from "../../types"

/**
 * Recursively Extract the primary table name from a query node
 * @param fromNode
 * @returns
 */
export function getPrimaryTableName(fromNode: QueryNode["from"]): string {
  if (typeof fromNode === "string") {
    // Split on " as " case-insensitively; if an alias exists, return it.
    const parts = fromNode.split(/\s+as\s+/i)
    return parts.length > 1 ? parts[1] : parts[0]
  }

  // If an alias exists, return it.
  if (fromNode.alias) {
    return fromNode.alias
  }

  // For TableNode, return the name; for SubQueryNode, recurse.
  return fromNode.type === "table"
    ? fromNode.name
    : getPrimaryTableName(fromNode.query.from)
}

/**
 * Normalize the table name with qualifying dataset and table name
 * @param queryNode
 * @param dataset
 * @returns
 */
export function updateTableNameWithQualifyingDataset(
  queryNode: QueryNode,
  dataset: string,
): QueryNode {
  // Helper: Given a table name (possibly already qualified), strip any dataset prefix
  // and return a new name in the form: "<dataset>.<baseName>"
  function qualifyTableName(name: string): string {
    // Split on dot and take the last segment as the base table name.
    const parts = name.split(".")
    const baseName = parts[parts.length - 1]
    return `${dataset}.${baseName}`
  }

  // Process an entire QueryNode recursively.
  function processQuery(query: QueryNode): QueryNode {
    // Process the "from" property which can be a string, TableNode, or SubQueryNode.
    let from: TableNode | SubQueryNode | string
    if (typeof query.from === "string") {
      // If the from clause is a bare table name string, qualify it.
      from = qualifyTableName(query.from)
    } else if (query.from.type === "table") {
      from = processTable(query.from)
    } else if (query.from.type === "subquery") {
      from = processSubQuery(query.from)
    } else {
      from = query.from
    }

    // Process the selects. (We assume that any string in "selects" is not a table name.)
    const selects = query.selects.map((sel) => {
      if (typeof sel === "string") {
        return sel
      } else {
        return {
          ...sel,
          expression: processExpression(sel.expression),
        }
      }
    })

    // Process joins if any.
    const joins = query.joins?.map((j) => processJoin(j))

    // Process filters: where, having, qualify.
    const where = query.where ? processFilter(query.where) : undefined
    const having = query.having ? processFilter(query.having) : undefined
    const qualifyFilter = query.qualify
      ? processFilter(query.qualify)
      : undefined

    // GroupBy may be a node, a string, or array of strings.
    let groupBy = query.groupBy
    if (
      typeof groupBy === "object" &&
      "type" in groupBy &&
      groupBy.type === "groupby"
    ) {
      // If it’s a GroupByNode, simply shallow-copy (its columns are strings).
      groupBy = { ...groupBy }
    }
    // OrderBy is an array of nodes (columns only); we can shallow copy them.
    const orderBy = query.orderBy?.map((ob) => ({ ...ob }))

    // Process the "with" clause.
    const withNodes = query.with?.map((withNode) => ({
      ...withNode,
      query: processQuery(withNode.query),
    }))

    // Process the "unions" clause.
    const unions = query.unions?.map((union) => ({
      ...union,
      query: processQuery(union.query),
    }))

    return {
      ...query,
      from,
      selects,
      joins,
      where,
      having,
      groupBy,
      orderBy,
      with: withNodes,
      unions,
      qualify: qualifyFilter,
    }
  }

  // Process a TableNode by qualifying its name.
  function processTable(table: TableNode): TableNode {
    return {
      ...table,
      name: qualifyTableName(table.name),
    }
  }

  // Process a SubQueryNode by processing its inner query.
  function processSubQuery(subquery: SubQueryNode): SubQueryNode {
    return {
      ...subquery,
      query: processQuery(subquery.query),
    }
  }

  // Process a JoinNode.
  function processJoin(join: JoinNode): JoinNode {
    let table
    if (join.table.type === "table") {
      table = processTable(join.table)
    } else if (join.table.type === "subquery") {
      table = processSubQuery(join.table)
    } else {
      table = join.table
    }
    return {
      ...join,
      table,
      on: processExpression(join.on),
    }
  }

  // Process a FilterNode (which contains an array of conditions that are either FilterNode or ExpressionNode).
  function processFilter(filter: FilterNode): FilterNode {
    return {
      ...filter,
      conditions: filter.conditions.map((condition) => {
        // We assume each condition is an object with a "type" field.
        if (
          typeof condition === "object" &&
          condition !== null &&
          "type" in condition
        ) {
          if (condition.type === "filter") {
            return processFilter(condition as FilterNode)
          }
          if (condition.type === "expression") {
            return processExpression(condition as ExpressionNode)
          }
        }
        return condition
      }),
    }
  }

  // Process an ExpressionNode. Its left and right can be primitives, ExpressionNodes, or QueryNodes.
  function processExpression(expr: ExpressionNode): ExpressionNode {
    let left = expr.left
    let right = expr.right

    if (left && typeof left === "object" && "type" in left) {
      if (left.type === "query") {
        left = processQuery(left as QueryNode)
      } else if (left.type === "expression") {
        left = processExpression(left as ExpressionNode)
      }
    }

    if (right && typeof right === "object" && "type" in right) {
      if (right.type === "query") {
        right = processQuery(right as QueryNode)
      } else if (right.type === "expression") {
        right = processExpression(right as ExpressionNode)
      }
    }

    return { ...expr, left, right }
  }

  return processQuery(queryNode)
}

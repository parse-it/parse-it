import { ExpressionNode } from "../types";

export const expressionHandlers: Record<
  string,
  (expr: any, mapExpression: any) => ExpressionNode
> = {
  column_ref: (expr) => ({
    type: "expression",
    left: expr.table ? `${expr.table}.${expr.column}` : expr.column,
  }),

  binary_expr: (expr, mapExpression) => ({
    type: "expression",
    left: mapExpression(expr.left),
    operator: expr.operator,
    right: mapExpression(expr.right),
  }),

  function: (expr, mapExpression) => {
    const functionName =
      Array.isArray(expr.name?.name) && expr.name?.length > 0
        ? expr.name.name.map((n: any) => n.value).join(".")
        : expr.name?.value || expr.name?.schema.value || "UNKNOWN_FUNCTION";

    const functionArgs =
      expr.args?.type === "expr_list" && Array.isArray(expr.args.value)
        ? expr.args.value.map((arg: any) => mapExpression(arg).left).join(", ")
        : "";

    return {
      type: "expression",
      left: `${functionName}(${functionArgs})`,
    };
  },

  case: (expr, mapExpression) => {
    const caseParts = expr.args
      .map((arg: any) => {
        if (arg.type === "when") {
          const condition = mapExpression(arg.cond);
          const result = mapExpression(arg.result).left;
          return `WHEN ${condition.left} ${condition.operator || ""} ${condition.right} THEN ${result}`;
        }
        if (arg.type === "else") {
          const elseResult = mapExpression(arg.result).left;
          return `ELSE ${elseResult}`;
        }
        return null;
      })
      .filter(Boolean)
      .join(" ");

    return {
      type: "expression",
      left: `CASE ${caseParts} END`,
    };
  },

  star: () => ({
    type: "expression",
    left: "*", // Represents the `*` in SQL
  }),

  interval: (expr, mapExpression) => ({
    type: "expression",
    left: `INTERVAL ${mapExpression(expr.expr).left} ${expr.unit}`,
  }),

  is_expr: (expr, mapExpression) => ({
    type: "expression",
    left: mapExpression(expr.left).left,
    operator: expr.operator, // Typically "IS" or "IS NOT"
    right: expr.right ? mapExpression(expr.right).left : undefined,
  }),

  aggr_func: (expr, mapExpression) => {
    const aggrFunctionName = expr.name;

    const aggrFunctionArgs =
      expr.args?.expr?.type === "star"
        ? "*" // Handle "star" directly
        : expr.args?.expr
          ? mapExpression(expr.args.expr).left
          : "";

    return {
      type: "expression",
      left: `${aggrFunctionName}(${aggrFunctionArgs})`,
    };
  },

  single_quote_string: (expr) => ({
    type: "expression",
    left: expr.value,
  }),

  null: (expr) => ({
    type: "expression",
    left: expr.value,
  }),

  number: (expr) => ({
    type: "expression",
    left: expr.value,
  }),

  string: (expr) => ({
    type: "expression",
    left: expr.value,
  }),
};

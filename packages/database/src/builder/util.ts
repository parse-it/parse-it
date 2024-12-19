import { ExpressionNode, SubQueryNode, TableNode } from "../types";

export const checkIsFromTable = (
  value: TableNode | SubQueryNode
): value is TableNode => {
  return Object.hasOwn(value, "name");
};

export function traverseExpression(
  expression: ExpressionNode,
  callback: (operand: string | number | string[], operator?: string) => void
): void {
  if(expression === null) return
  if (typeof expression.left === "string") {
    callback(expression.left, expression.operator);
  } else if (typeof expression.left === "object") {
    traverseExpression(expression.left, callback);
  }

  if (
    expression.right &&
    typeof expression.right === "object" &&
    !Array.isArray(expression.right)
  ) {
    traverseExpression(expression.right, callback);
  } else if (expression.right) {
    callback(expression.right, expression.operator);
  }
}

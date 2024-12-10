import { QueryNode } from "../types";
import { ValidationError } from "./validation.error";

export type Schema = {
  [tableName: string]: string[]; // Table name to column names mapping
};

export interface ValidationRule {
  validate(query: QueryNode, schema?: Schema): ValidationError[];
}

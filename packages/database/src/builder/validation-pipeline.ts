// import { QueryNode, Schema, ValidationRule } from "../query.model";
import { QueryNode } from "../types"
import { Schema, ValidationRule } from "./mode"
import { ValidationError } from "./validation.error"

export class ValidationPipeline {
  private rules: ValidationRule[]

  constructor(rules: ValidationRule[]) {
    this.rules = rules
  }

  validate(query: QueryNode, schema?: Schema): ValidationError[] {
    return this.rules.flatMap((rule) => rule.validate(query, schema))
  }
}

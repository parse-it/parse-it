declare module "*.pegjs" {
  export function parse(
    input: string,
    options?: import("./parser").ParseOptions,
  ): any
}

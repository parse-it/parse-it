import type { Plugin as EsbuildPlugin } from "esbuild"
import { promises as fs } from "fs"
import peggy from "peggy"

export function peggyPlugin(): EsbuildPlugin {
  return {
    name: "esbuild-peggy-plugin",
    setup(build) {
      build.onLoad({ filter: /\.pegjs$/ }, async (args) => {
        const grammar = await fs.readFile(args.path, "utf8")

        const code = peggy.generate(grammar, {
          output: "source",
          format: "es",
          cache: true,
        })

        return {
          contents: code,
          loader: "ts",
        }
      })
    },
  }
}

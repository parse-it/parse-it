const fs = require("fs")
const path = require("path")
const pegjs = require("peggy")

const compilePegjsFiles = (srcDir) => {
  const files = fs.readdirSync(srcDir).filter((file) => file.endsWith(".pegjs"))
  files.forEach((file) => {
    const filePath = path.join(srcDir, file)
    const grammar = fs.readFileSync(filePath, "utf8")
    const parser = pegjs.generate(grammar, { output: "source", format: "es" })
    const outputPath = filePath.replace(".pegjs", ".js")
    fs.writeFileSync(outputPath, parser)
    console.log(`Compiled: ${file} -> ${outputPath}`)
  })
}

const srcDir = path.join(__dirname, "../grammer")
compilePegjsFiles(srcDir)

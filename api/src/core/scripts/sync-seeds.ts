import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas relativas desde src/core/scripts/ hacia src/core/bd/
const seedersDir = path.resolve(__dirname, "../bd/seeds/seeders");
const runnerFile = path.resolve(__dirname, "../bd/runner/seed.runner.ts");

function syncSeeds() {
  if (!fs.existsSync(seedersDir)) {
    console.error("[ERROR] No se encontró la carpeta de seeders en:", seedersDir);
    process.exit(1);
  }

  if (!fs.existsSync(runnerFile)) {
    console.error("[ERROR] No se encontró el archivo runner en:", runnerFile);
    process.exit(1);
  }

  // Escanea todos los archivos *.seed.ts
  const files = fs
    .readdirSync(seedersDir)
    .filter((file) => file.endsWith(".seed.ts"))
    .sort();

  // Genera las líneas de importación con .js
  const importLines = files
    .map((file) => {
      const jsFile = file.replace(/\.ts$/, ".js");
      return `import "../seeds/seeders/${jsFile}";`;
    })
    .join("\n");

  // Actualiza el bloque delimitado en el runner
  const runnerContent = fs.readFileSync(runnerFile, "utf-8");
  const regex = /(\/\/ <SEEDERS_IMPORTS>)[\s\S]*?(\/\/ <\/SEEDERS_IMPORTS>)/;

  if (!regex.test(runnerContent)) {
    console.error("[ERROR] Faltan las etiquetas // <SEEDERS_IMPORTS> y // </SEEDERS_IMPORTS> en el runner.");
    process.exit(1);
  }

  const updatedContent = runnerContent.replace(
    regex,
    `$1\n${importLines}\n$2`
  );

  fs.writeFileSync(runnerFile, updatedContent, "utf-8");
  console.log(`[OK] SeedRunner sincronizado (${files.length} seeder(s)):`);
  files.forEach((f) => console.log(`   - ${f}`));
}

syncSeeds();

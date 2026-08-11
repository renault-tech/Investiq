/**
 * Falha o build quando uma tela do app não tem tutorial.
 *
 * "Atualizar os tutoriais automaticamente a cada nova implementação" não é
 * possível de forma literal — ninguém gera sozinho o texto que explica uma
 * feature que acabou de nascer. O que dá para garantir é que o esquecimento
 * nunca passe despercebido: toda rota em app/(platform) precisa de uma
 * entrada em src/lib/tutorials.ts, senão o CI quebra e alguém escreve.
 *
 * Uso: node scripts/check-tutorials.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const platformDir = join(webRoot, "src", "app", "(platform)");
const registryPath = join(webRoot, "src", "lib", "tutorials.ts");

/** Rotas do Next: grupos entre parênteses não aparecem na URL. */
function routeFromDir(dir) {
  const segments = relative(platformDir, dir)
    .split(sep)
    .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

function findRoutes(dir) {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes.push(...findRoutes(full));
    } else if (entry === "page.tsx") {
      routes.push(routeFromDir(dir));
    }
  }
  return routes;
}

const routes = [...new Set(findRoutes(platformDir))].sort();

const registry = readFileSync(registryPath, "utf8");
const declared = new Set(
  [...registry.matchAll(/^\s*route:\s*"([^"]+)"/gm)].map((m) => m[1])
);

const missing = routes.filter((r) => !declared.has(r));
const stale = [...declared].filter((r) => !routes.includes(r));

if (missing.length === 0 && stale.length === 0) {
  console.log(`✓ ${routes.length} telas, todas com tutorial.`);
  process.exit(0);
}

if (missing.length) {
  console.error("\n✗ Telas sem tutorial em src/lib/tutorials.ts:\n");
  for (const route of missing) console.error(`    ${route}`);
  console.error(
    "\n  Adicione uma entrada em TUTORIALS com pelo menos um passo explicando\n" +
      "  para que a tela serve. O tour guiado e a Central de ajuda leem daí.\n"
  );
}

if (stale.length) {
  console.error("\n✗ Tutoriais apontando para telas que não existem mais:\n");
  for (const route of stale) console.error(`    ${route}`);
  console.error("\n  Remova a entrada ou corrija a rota.\n");
}

process.exit(1);

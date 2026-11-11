// Writes migrations/0001_init.sql from the object registry. Run: npm run schema
import { writeFileSync } from "node:fs";
import { schemaSql } from "../src/api/schema";

writeFileSync(new URL("../migrations/0001_init.sql", import.meta.url), schemaSql());
console.log("Wrote migrations/0001_init.sql");

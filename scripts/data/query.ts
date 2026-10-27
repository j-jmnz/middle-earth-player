import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { duration, runScript } from "../log.ts";
import { loadCards } from "./load-cards.ts";
import { DATA_DIR } from "./paths.ts";
import { loadScenarios } from "./load-scenarios.ts";
import type { RuleEntry } from "./rules/spans.ts";

// Loads data/cards, data/scenarios and data/rules/entries.json into an in-memory database and prints the rows
// of one query. There is no database file: the JSON stays canonical and diffable.
//   pnpm data:query "select code,name,text from cards where encounterSet='Hunted'"
// Tables: cards (arrays and objects are JSON text), scenario_cards, rules.
export function openDataDatabase(dataDir = DATA_DIR): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    create table cards (code text primary key, name text, type text, typeName text, sphere text, traits text, isUnique integer,
      cost text, deckLimit integer, threat integer, willpower integer, attack integer, defense integer, health integer,
      questPoints integer, victory integer, engagementCost integer, quantity integer, easyQuantity integer, encounterSet text,
      stage text, keywords text, timings text, text text, shadowText text, back text, hasErrata integer, errata text,
      imagesrc text, deckLegal integer, printings text);
    create table scenario_cards (scenario text, code text, pile text, normal integer, easy integer);
    create table rules (id text primary key, doc text, page integer, title text, text text, terms text);
  `);
  const json = (value: unknown) => (value == null ? null : JSON.stringify(value));
  const insertCard = db.prepare(`insert into cards values (${Array.from({ length: 31 }, () => "?").join(",")})`);
  for (const c of loadCards(dataDir)) {
    insertCard.run(c.code, c.name, c.type, c.typeName, c.sphere, json(c.traits), +c.isUnique, c.cost, c.deckLimit, c.threat, c.willpower, c.attack, c.defense, c.health, c.questPoints, c.victory, c.engagementCost, c.quantity, c.easyQuantity, c.encounterSet, c.stage, json(c.keywords), json(c.timings), c.text, c.shadowText, json(c.back), +c.hasErrata, c.errata, c.imagesrc, +c.deckLegal, json(c.printings));
  }
  const insertPlacement = db.prepare("insert into scenario_cards values (?,?,?,?,?)");
  for (const scenario of loadScenarios(undefined, dataDir)) for (const card of scenario.cards) insertPlacement.run(scenario.id, card.code, card.pile, card.normal, card.easy);
  const insertRule = db.prepare("insert into rules values (?,?,?,?,?,?)");
  for (const entry of JSON.parse(readFileSync(path.join(dataDir, "rules", "entries.json"), "utf8")) as RuleEntry[]) insertRule.run(entry.id, entry.doc, entry.page, entry.title, entry.text, json(entry.terms));
  return db;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  // Rows go to stdout, one JSON object a line; the log (row count, timings, errors) goes to stderr.
  void runScript("data:query", (log) => {
    const sql = process.argv
      .slice(2)
      .filter((arg) => arg !== "--" && arg !== "--verbose" && arg !== "--quiet")
      .join(" ")
      .trim();
    if (sql === "") throw new Error('Usage: pnpm data:query "select code, name from cards where encounterSet = \'Hunted\'"\nTables: cards, scenario_cards, rules');
    const begin = performance.now();
    const db = openDataDatabase();
    log.debug(`loaded data/ into memory in ${duration(performance.now() - begin)}; sql: ${sql}`);
    let rows: unknown[];
    try {
      rows = db.prepare(sql).all();
    } catch (error) {
      throw new Error(`The query did not run: ${sql}`, { cause: error });
    }
    for (const row of rows) console.log(JSON.stringify(row));
    log.info(`${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }, { done: false });
}

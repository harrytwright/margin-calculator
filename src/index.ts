#!/usr/bin/env node

import './utils/setup-log'

import { Command } from 'commander'

import { ingredient } from './commands/ingredient'
import { initialise } from './commands/initialise'
import { recipe } from './commands/recipe'
import { supplier } from './commands/supplier'
import { getPackageInfo } from './utils/package-info'

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

async function main() {
  const packageInfo = await getPackageInfo()
  packageInfo.versions

  const program = new Command()
    .name('margin')
    .description('A CLI understanding your menu margins')
    .version(
      packageInfo.version || '1.0.0',
      '-v, --version',
      'display the version number'
    )

  program
    .addCommand(initialise)
    .addCommand(supplier)
    .addCommand(ingredient)
    .addCommand(recipe)

  program.parse()
}

main()

// import { Command } from "commander";
// import { PrismaClient } from "@prisma/client";
// import {
//   importRecipe,
//   importIngredient,
//   calculateRecipeCost,
//   listRecipes,
//   startExploreServer,
// } from "./commands";
//
// const db = new PrismaClient();
// const program = new Command();
//
// program
//   .name("margin")
//   .description("GoBowling Margin Calculator")
//   .version("0.1.0");
//
// // Recipe commands
// program
//   .command("recipe")
//   .description("Manage recipes")
//   .command("import <file>")
//   .description("Import recipe from YAML/JSON")
//   .action(async (file) => {
//     await importRecipe(db, file);
//     console.log(`✓ Imported ${file}`);
//   });
//
// program
//   .command("recipe")
//   .command("cost <slug>")
//   .description("Calculate recipe cost")
//   .action(async (slug) => {
//     const cost = await calculateRecipeCost(db, slug);
//     console.log(formatCostBreakdown(cost));
//   });
//
// program
//   .command("recipe")
//   .command("list")
//   .option("--sort-by <field>", "Sort by (margin|cost|price)", "margin")
//   .action(async (options) => {
//     const recipes = await listRecipes(db, options.sortBy);
//     console.log(formatTable(recipes));
//   });
//
// // Ingredient commands
// program
//   .command("ingredient")
//   .description("Manage ingredients")
//   .command("import <file>")
//   .action(async (file) => {
//     await importIngredient(db, file);
//     console.log(`✓ Imported ${file}`);
//   });
//
// // Explore UI
// program
//   .command("explore")
//   .description("Open web UI")
//   .option("-p, --port <port>", "Port to run on", "3000")
//   .action(async (options) => {
//     await startExploreServer(db, parseInt(options.port));
//   });
//
// // Config
// program
//   .command("config")
//   .command("set")
//   .option("--vat <rate>", "VAT rate (e.g., 0.20)")
//   .option("--target-margin <percent>", "Default target margin")
//   .action(async (options) => {
//     // Update config file
//   });
//
// program.parse();

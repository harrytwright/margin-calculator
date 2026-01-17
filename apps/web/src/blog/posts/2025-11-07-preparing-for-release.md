---
title: 'Building Menu Book: Preparing for release'
date: 2025-11-07
author: 'Harry Wright'
slug: 'preparing-for-release'
excerpt: 'Features, and why we think they are important.'
---

Why are we building a system to do this when a simple spreadsheet could work?

The best answer is, because we could. Spreadsheets have their usage, but also their limitations. They work when data is logical, but fail when things get more complex; when you need weird conversions, recipes as ingredients, historical pricing changes, etc.

This is what the Menu Book is designed to solve.

## Features

These are what we as a business deemed were important to us, and why we built this as a system over a spreadsheet

### Data Conversions

Since I built this for my own business, [GoBowling Shipley](https://www.gobowling.co.uk/?utm_source=getmenubook&utm_medium=blog&utm_campaign=preparing-for-release), we initially did not use any system. I had started implementing this via a spreadsheet, but hit a simple hurdle: a loaf of bread. We always get the same loaf from the local supermarket; they do not offer the easiest nutritional data or serving sizes; everything is 100g.

This is okay. I could weigh a single slice and use that as my slice weight. So I get the scales, weigh one —it was around 42g. That seemed fine until you divided the 800g loaf, which gave you around 19 slices, which seemed more than the eye test showed, so I weighed another 53g. I thought that was strange. We could try to work out an average? So I counted each slice, got 16, which would leave 50g per slice, give or take. But I counted two more loaves and each time got 16 slices, so my head is now thinking `1 loaf = 16 slices`, which I thought would be cool to write as a conversion rule visually. Still, the spreadsheet would not allow it; it would require things like regex to understand that in a _Ham and Cheese Sandwich_ we would use two slices, which Excel fails at.

Whilst this example could be written as 50g per slice, and still work. Take our pizzas bases, we order them in a case, they arrive as 16 bases per case, I could weigh them as before and store them as say 200g per base, but it seems more logical to write `1 case = 16 bases`, then use `1 base` inside the recipe so that the calculation engine can figure out the correct conversion rate to calculate your cost per ingredient.

### Recipes as ingredients

Whilst the same as above, Excel could handle this via some `LOOKUPS` and `MATCH` formulas, which would increase the spreadsheet's complexity and require more staff to be Excel-literate, potentially at a cost to us. Whilst the idea of adding a UI to the calculator levelled the playing field, all a user would need is a select dropdown in a field to add a recipe as an ingredient.

Take the above example, maybe all our 11" pizzas have the base of `1 Base`, `60g` cheese, and `1 tbsp` of sauce. We could use that as a `Pizza Base` recipe, which would also have its margin calculated, but if we say we have a `Pepperoni Pizza`, we could use `1 Pizza Base`, `15g` of pepperoni, and, through recursive SQL calls, we could load up the full margin for a pepperoni pizza with minimal effort.

### Historical Prices

As a business, you might want to see the effects of supply chain fluctuations or seasonal ingredient changes. One summer, your strawberries were £20 per kilo; now they are £25 per kilo; maybe they dropped in the off-season?

Now imagine you could scroll through this, see your margin action, and see that during the summer season, you make 86% margin on your Wimbledon special, Strawberries and cream, but you only make 45% if you sell during the off-season. Last year you made 89%. Is it time to look at new suppliers, or is there a global reason you need to weather the storm?

Historical pricing would allow you to do that. Using our MCP, you can link an LLM of your choice to run through your historical data to tell you what your data is showing you, without the need to employ your own data scientist. Just imagine asking ChatGPT 'Is my strawberry supplier ripping me off?' and finding out in an instant

## Questions?

We'd love to hear from you. What recipe costing problems are you facing? What features would make Menu Book useful for your business?

Email us at [info@getmenubook.com](mailto:info@getmenubook.com) or [sales@getmenubook.com](mailto:sales@getmenubook.com).

---

_This is post #2 in our "Building in Public" series. Follow along as we build Menu Book from the ground up._

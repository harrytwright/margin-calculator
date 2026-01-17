---
title: 'Building Menu Book: Our Journey Begins'
date: 2025-10-24
author: 'Harry Wright'
slug: 'building-menu-book'
excerpt: "Why we're building a modern recipe cost calculator for food service businesses, and what makes Menu Book different from traditional spreadsheet approaches."
---

Running a food service business is tough. Between managing staff, keeping customers happy, and maintaining quality, the last thing you want to worry about is whether your pricing is right.

But here's the reality: **if you don't know your costs, you can't know your margins**. And if you don't know your margins, you're flying blind.

## The Problem with Spreadsheets

Most cafes, restaurants, and food service operators manage their recipe costs in spreadsheets. We know because we did it too at GoBowling Shipley Lanes.

The problems quickly pile up:

- **Manual calculations** that break when you change one cell
- **No sub-recipe support** – if your pizza sauce changes, you have to update every pizza recipe manually
- **Unit conversion headaches** – buying in kilos, using in grams, costing by portion
- **VAT confusion** – are prices ex-VAT or inc-VAT? Different for purchases vs sales
- **Version control nightmares** – which spreadsheet is the current one?

After one too many pricing mistakes, we decided there had to be a better way.

## What Makes Menu Book Different

We're building Menu Book to solve the problems we actually face:

### 1. **Recursive Cost Calculation**

Your pizza sauce is a recipe. Your margherita pizza uses that sauce. When the cost of tomatoes goes up, Menu Book automatically recalculates the sauce cost, then the pizza cost. No manual updates.

### 2. **Smart VAT Handling**

Menu Book knows that ingredient purchase prices might include VAT, but margins should be calculated ex-VAT. Sell prices can be VAT-eligible or not. It handles all the complexity so you don't have to think about it.

### 3. **Unit Conversion That Just Works**

Buy flour in 16kg bags, use it in 250g portions. Buy milk in litres, use it in millilitres. Menu Book converts everything automatically using standard units.

### 4. **Git-Friendly Data**

Your recipes are stored as YAML files, not locked in a database. Version control them with git, share them with your team, back them up anywhere.

### 5. **CLI + Web UI**

Power users get a fast CLI for bulk operations. Everyone else gets a beautiful web interface. Same data, different interfaces.

## Building in Public

We're building Menu Book in the open because:

1. **Accountability** – Telling you what we're building keeps us focused
2. **Feedback** – Your input shapes what features we prioritize
3. **Transparency** – You can see our progress, not just marketing fluff
4. **Community** – We're not the only ones solving these problems

## What's Next

Over the coming weeks, we'll be sharing:

- Deep dives into specific features (VAT handling, unit conversions, etc.)
- Technical challenges we're solving
- Design decisions and why we made them
- Customer stories (once we have customers!)

If you're interested in following along, [join our waitlist](/#signup) to get updates when we launch.

## Questions?

We'd love to hear from you. What recipe costing problems are you facing? What features would make Menu Book useful for your business?

Email us at [info@getmenubook.com](mailto:info@getmenubook.com) or [sales@getmenubook.com](mailto:sales@getmenubook.com).

---

_This is post #1 in our "Building in Public" series. Follow along as we build Menu Book from the ground up._

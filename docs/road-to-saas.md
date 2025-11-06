# Menu Book (Margin Calculator)

## Overview

- **Goal:** Know exact margins on all F&B
- **Owner:** You
- **Current Version:** 0.3.0
- **Status:** Phase 2 Complete, Phase 3 In Progress

---

## Success Criteria

- [x] Every F&B item has cost, price, margin % calculated
- [x] Can identify top 5 most/least profitable items
- [x] Shared with business partner for review
- [x] Production-ready with settings management and backups
- [ ] Standalone deployment mode
- [ ] Data export capabilities

---

## Phases

These are the build phases we are running to. So we have a complete, working system to be able to analyise or most important revenue stream, Food and Beverage

### Phase 1 ✅ COMPLETED

> **Deadline:** October 13 2025
> **Completed:** October 2025

This is the main component of the system. Allowing us to work with a simple CLI, importing yaml files into a database which can then be queried.

- [x] Basic CLI built with `commander.js`. Utilising the subcommand concept to flush the system out.
- [x] Complex import with basic dependency resolution, allowing for complex recipes and structures
- [x] Inheritance of recipes, allowing for base recipes.
- [x] Recipes as ingredients. Allow for the creation of our own supplies
- [x] Calculation engine. Handling VAT/VAT excl. ingredients and recipes. Along with custom conversion rules for weird ingredients.

### Phase 2 ✅ COMPLETED

> **Deadline:** October 19 2025
> **Completed:** October 2025

This is where the system gets flushed out a bit. UI tooling for non-technically minded users

- [x] Creation of simple UI. Allowing users to create their recipes on the fly without knowledge of YAML and the underlying file structure
- [x] FileWatcher system. Allowing for `margin import --watch` so that the user could leave the system running whilst they worked on multiple files. All to be imported upon saving.
- [x] HashService. Speeding up the phase 1 concepts, linking with additional tools built for phase 2 to allow for a seamless UI, and CLI.
- [x] FileWriter. Allow the API server to create files upon POST requests.
- [x] Complete UI to a polished level
  - [x] Basic Modal Forms
  - [x] Toasts: Let the user know what is happening
  - [x] Searchbar, allowing for looking up items
  - [x] Filtering: When we have 100+ recipes, 200+ ingredients, we will need filtering
  - [x] Validation, both server level and front end level
  - [x] Dashboard style page
    - [x] Sidebar Navigation
      - **Dashboard**: Simple charts for viewing (margin distribution, top performers, category breakdown)
      - **Management**: Expandable, allow the user to manage their data (suppliers, ingredients, recipes)
      - **Margins**: Display the recipes w/ their relevant calculated data
      - **Settings**: Configure VAT rate, margin targets, pricing preferences
      - **Help**: Documentation and troubleshooting

### Phase 2.5: Production Polish ✅ COMPLETED

> **Completed:** November 2025 (v0.3.0)

Making the application production-ready with essential features for real users.

- [x] **Settings Management**
  - [x] Settings page for managing global configuration (VAT rate, margin target, pricing model)
  - [x] No need to manually edit TOML files
  - [x] Live VAT percentage display
  - [x] Client and server-side validation

- [x] **Database Backup**
  - [x] One-click database backup download
  - [x] Timestamped backup filenames
  - [x] Information about what's included in backups

- [x] **Improved Error Handling**
  - [x] Replace all `alert()` with toast notifications
  - [x] User-friendly error messages with context
  - [x] Inline validation with visual feedback (shake animations, red borders)
  - [x] Network error detection
  - [x] Status code-specific error handling (409 conflicts, 404 not found, etc.)

- [x] **VAT Configuration**
  - [x] Configurable default VAT pricing preference (UK/EU vs US)
  - [x] Interactive prompt during `margin initialise` to select pricing model
  - [x] Support for both VAT-inclusive and tax-exclusive pricing

- [x] **SEO & Landing Page**
  - [x] Add robots.txt and sitemap.xml
  - [x] Fix heading hierarchy
  - [x] Blog content updates

### Phase 3: Data Portability & Deployment

> **Deadline:** November 30 2025
> **Status:** In Progress

A complete, portable, and user-friendly system ready for wider adoption.

#### 3A: Data Export & Portability

- [ ] **Export to YAML**
  - [x] Single recipe export (completed in v0.3.0)
  - [ ] Bulk export (all recipes)
  - [ ] Export with dependencies (include ingredients + suppliers)
  - [ ] ZIP file download for complete dataset

- [ ] **Export to CSV**
  - [ ] Recipe list with costs and margins
  - [ ] Ingredient list with pricing
  - [ ] Supplier list
  - [ ] Useful for spreadsheet analysis and reporting

- [ ] **Export to PDF**
  - [ ] Printable recipe cards
  - [ ] Cost breakdown reports
  - [ ] Margin analysis reports
  - [ ] Professional formatting for presentations

#### 3B: Onboarding & First-Run Experience

- [ ] **Web-based Initialization**
  - [ ] Detect if database doesn't exist on first visit
  - [ ] Show onboarding wizard instead of requiring CLI
  - [ ] Configure VAT rate, margin targets, pricing preference in browser
  - [ ] Eliminate `margin initialise` requirement for basic usage

- [ ] **Sample Data**
  - [ ] Include example suppliers, ingredients, recipes
  - [ ] "Import sample data" button
  - [ ] Help users understand the system before adding real data
  - [ ] Clear "Delete sample data" option

- [ ] **Guided Tour**
  - [ ] Highlight key features with tooltips
  - [ ] Step-by-step walkthrough for creating first recipe
  - [ ] Optional "Skip tour" for experienced users
  - [ ] Progressive disclosure of advanced features

- [ ] **Better Empty States**
  - [ ] When no recipes exist, show helpful getting-started message
  - [ ] CTA buttons to create first supplier/ingredient/recipe
  - [ ] Links to documentation and help

#### 3C: Standalone Deployment

- [ ] **Deployment Modes**
  - [x] `--standalone` mode for the UI (removes dependency on file system)
  - [ ] `--api-only` mode (run API server without UI)
  - [x] `--storage <fs|s3|database-only>` storage options
  - [ ] Docker container support with self-contained mode

- [ ] **Cross-Platform Support**
  - [ ] `margin.exe` program for Windows portability
  - [ ] macOS binary distribution
  - [ ] Linux binary distribution
  - [ ] Docker image published to registry

- [ ] **Configuration Management**
  - [ ] Environment variable configuration
  - [ ] `.env` file support
  - [ ] Config validation on startup
  - [ ] Clear error messages for misconfiguration

### Phase 4: SaaS Transformation

> **Deadline:** TBC
> **Goal:** Package as a mini SaaS. Simple tool but works vibes.

Transform Menu Book from a self-hosted tool into a hosted SaaS offering with freemium model.

#### 4A: Multi-Tenancy & Data Architecture

- [ ] **Multi-Tenant Database Design**
  - [ ] Add `tenantId` to all tables
  - [ ] Row-level security for data isolation
  - [ ] Tenant-specific database schemas (optional Postgres approach)
  - [ ] Data migration strategy from single-tenant to multi-tenant

- [ ] **Database Type Support**
  - [ ] `--database-type <sqlite|postgres>` option
  - [ ] Postgres support for production SaaS deployment
  - [ ] SQLite for CLI/local development
  - [ ] Database adapter pattern for switching between providers

- [ ] **CLI Context Awareness**
  - [ ] Global SQLite database for CLI
  - [ ] Project-level configuration
  - [ ] CLI is context aware based on `cwd`
  - [ ] `REALM=cloud|local` environment variable

#### 4B: Authentication & User Management

- [ ] **User Authentication**
  - [ ] Email/password authentication
  - [ ] OAuth providers (Google, GitHub)
  - [ ] Password reset flow
  - [ ] Email verification
  - [ ] Session management

- [ ] **Role-Based Access Control (RBAC)**
  - [ ] Owner, Admin, Editor, Viewer roles
  - [ ] Permission system for CRUD operations
  - [ ] Team invitation system
  - [ ] User management dashboard

- [ ] **Audit Logging**
  - [ ] Track all data changes (who, what, when)
  - [ ] Recipe change history
  - [ ] Ingredient price change logs
  - [ ] User action logs
  - [ ] Export audit logs for compliance

#### 4C: Pricing & Payment

- [ ] **Freemium Model**
  - [ ] Free tier: Up to 25 recipes, 50 ingredients, 1 user
  - [ ] Pro tier: Unlimited recipes/ingredients, 5 users, priority support
  - [ ] Team tier: Unlimited everything, unlimited users, advanced features
  - [ ] Feature gating based on subscription level

- [ ] **Payment Processing**
  - [ ] Stripe integration for subscriptions
  - [ ] Monthly/annual billing options
  - [ ] Trial period (14 days)
  - [ ] Upgrade/downgrade flows
  - [ ] Invoice generation

- [ ] **Usage Limits & Enforcement**
  - [ ] Track recipe/ingredient counts per tenant
  - [ ] Soft limits with upgrade prompts
  - [ ] Hard limits for free tier
  - [ ] Usage analytics dashboard

#### 4D: UI/UX Improvements

- [ ] **Modern Frontend Architecture**
  - [ ] Migrate from single HTML file to templated pages via `ejs`
  - [ ] Component-based architecture
  - [ ] External JavaScript files loaded from server
  - [ ] CSS framework (Tailwind CDN → build process)
  - [ ] Better code organization and maintainability

- [ ] **Responsive Design**
  - [ ] Mobile-optimized UI
  - [ ] Touch-friendly controls
  - [ ] Progressive Web App (PWA) capabilities

- [ ] **Branding & White-labeling** (future)
  - [ ] Custom branding for Team tier
  - [ ] Custom domain support
  - [ ] Theme customization

#### 4E: Industry Expansion

- [ ] **Generic Terminology**
  - [ ] Rename "Ingredients" → "Components" or "Materials"
  - [ ] Rename "Recipes" → "Products" or "Items"
  - [ ] Industry-specific templates (F&B, Manufacturing, Services)
  - [ ] Configurable terminology per tenant

- [ ] **Industry Templates**
  - [ ] Food & Beverage (current default)
  - [ ] Manufacturing (bill of materials)
  - [ ] Services (service packages)
  - [ ] Retail (product bundles)

#### 4F: Advanced Features

- [ ] **Collaboration Features**
  - [ ] Real-time updates (WebSockets)
  - [ ] Comments and notes on recipes
  - [ ] @mention team members
  - [ ] Approval workflows for recipe changes

- [ ] **Integrations**
  - [ ] API for third-party integrations
  - [ ] Zapier integration
  - [ ] Import from POS systems (Square, Toast, etc.)
  - [ ] Export to accounting software (QuickBooks, Xero)
  - [ ] Supplier API integration for live pricing

- [ ] **Reporting & Analytics**
  - [ ] Historical cost tracking
  - [ ] Cost trend analysis
  - [ ] Margin optimization suggestions
  - [ ] Custom report builder
  - [ ] Scheduled email reports

- [ ] **AI Features** (future consideration)
  - [ ] AI-powered recipe suggestions
  - [ ] Automatic cost optimization
  - [ ] Ingredient substitution recommendations
  - [ ] Market price predictions

#### 4G: Infrastructure & Operations

- [ ] **Hosting & Deployment**
  - [ ] Production hosting (AWS, Railway, Fly.io)
  - [ ] CI/CD pipeline
  - [ ] Blue-green deployment
  - [ ] Database backups and disaster recovery
  - [ ] CDN for static assets

- [ ] **Monitoring & Observability**
  - [ ] Error tracking (Sentry, Rollbar)
  - [ ] Performance monitoring (APM)
  - [ ] Uptime monitoring
  - [ ] User analytics (PostHog, Plausible)

- [ ] **Security**
  - [ ] HTTPS everywhere
  - [ ] Rate limiting
  - [ ] CSRF protection
  - [ ] XSS prevention
  - [ ] SQL injection prevention
  - [ ] Security audit

- [ ] **Compliance**
  - [ ] GDPR compliance (EU)
  - [ ] Data export for users
  - [ ] Data deletion requests
  - [ ] Privacy policy and terms of service
  - [ ] Cookie consent

---

## Next Immediate Steps

Based on current progress, the recommended next steps are:

### Short-term (Next 2 weeks)

1. **Phase 3A: Data Export** - Start with bulk YAML export and CSV export
2. **Phase 3B: Onboarding** - Web-based initialization and sample data

### Medium-term (Next 1-2 months)

1. **Phase 3C: Standalone Deployment** - Docker containerization
2. **Phase 4A: Multi-tenancy** - Database architecture changes

### Long-term (3+ months)

1. **Phase 4B-C: Authentication & Pricing** - Transform into SaaS
2. **Phase 4E-F: Industry Expansion & Advanced Features**

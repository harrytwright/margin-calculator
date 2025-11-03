# GoBowling Margin Calculator - Roadmap

## Current Version: 0.2.0

This document tracks planned features and improvements for future releases.

---

## Future Enhancements

### Performance Optimizations (v0.3.0+)

Implement these when dataset size becomes a concern (1000+ items):

#### Pagination

- Add pagination to recipe/ingredient/supplier lists
- Default: 50 items per page
- API endpoints support `?page=1&limit=50` parameters

#### Server-Side Filtering

- Move filtering logic from client-side to API
- Add query parameters: `GET /api/recipes?search=cheese&category=sandwich&class=menu_item`
- Reduces network payload for large datasets

#### Virtual Scrolling

- Implement virtual scrolling for very long lists (1000+ items)
- Only render visible items + small buffer
- Libraries: `react-window` or `@tanstack/virtual`

#### Query Optimization

- Add database indexes on frequently filtered columns:
  - `Ingredient.category`
  - `Recipe.category`
  - `Recipe.class`
- Consider full-text search for name fields

#### Caching Strategy

- Add Redis/in-memory cache for recipe calculations
- Cache margin reports (TTL: 5 minutes)
- Invalidate on ingredient/recipe updates

---

## Completed Features

### v0.2.0

- ✅ Empty states with call-to-action buttons
- ✅ Delete functionality with confirmation modals
- ✅ Loading spinners on all API operations
- ✅ Error toast notifications
- ✅ Immutability protection for ingredient suppliers (API + UI)
- ✅ Filtering and navigation bug fixes
- ✅ Inline editing in recipe detail modal
- ✅ Duplicate button to clone recipes
- ✅ Sorting options (name, cost, margin)
- ✅ Cascade delete warnings with usage counts

### v0.1.0

- ✅ Core recipe costing with sub-recipes
- ✅ VAT handling for ingredients and pricing
- ✅ Unit conversion system (standard + custom)
- ✅ Web UI for non-technical users
- ✅ YAML/JSON import with dependency resolution
- ✅ Docker deployment with auto-initialization

---

## Ideas & Proposals

### Multi-tenant Support

- User authentication & authorization
- Workspace/team management
- Role-based access control (admin, editor, viewer)

### Recipe Versioning

- Track changes to recipes over time
- Compare historical costs
- Rollback to previous versions

### Inventory Management

- Track stock levels for ingredients
- Low stock alerts
- Automatic reordering suggestions

### Supplier Integration

- Import pricing from supplier APIs/CSVs
- Automatic price updates
- Price comparison across suppliers

### Advanced Reporting

- Export reports to PDF/Excel
- Scheduled email reports
- Custom report builder

### Mobile App

- Native iOS/Android apps
- Offline-first architecture
- Barcode scanning for ingredients

---

## Contributing

Have ideas for the roadmap? Open an issue at the project repository with:

- Feature description
- Use case / problem it solves
- Proposed implementation approach (optional)

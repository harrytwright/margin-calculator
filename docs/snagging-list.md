## Snagging List

### All

- [x] Settings modal is not fully responsive. Looks like it is not importing properly from the backend, tries to
      render the entire page inside the modal by the looks of it.

- [x] All islands should have the same default layout. Same header height, same padding. With icon buttons top right.
- [x] SSE exponential retry. If the server is down, and the tab is open, causes RAM usage to grow exponentially to
      the point of crashing the browser, this seems to be the route cause. I would argue in production this would happen
      less than in development, but clearly it is happening and would be good to fix. Would argue this means we need to
      look into how to handle SSE in production It was set up when the CLI and
      webapp were interwined, not sure if it is still needed anymore

### Suppliers

- [x] Requires only supplier name, but will send all data, causing `new Internal Server Error('Invalid email address')`
- [x] Suppliers modal is not fully responsive, forms look bad on all screen sizes.
- [x] 'Create' button isn’t styled properly.
- [x] `+ Add supplier` button top right of island, should be same as the other islands, just a `+` icon.
- [x] Details island will not allow data to be edited.
- [x] Not sure contact data is actually handled properly either. Not displayed anywhere.
- [x] All Island headers should be the same height.

### Ingredients

- [x] `Used in` island should be hidden by default. Only shown when an ingredient is selected.
- [x] When `Used in` island is closed it is not possible to open it again. Should be closed to a minimized state, `right: 0px;`
      with a middle 90deg rotatated button that says `Used in` to allow for reopening. (Third island could be used in the future
      to show different information about the ingredient, allowing for more buttons to determine what is shown)
- [x] When `Used In` island is closed, main island should use remainging space. I'd say use of `min-w-` rather than `w-`.

- [x] Adjust endpoints and API to return expanded supplier on `/ingrdients/*` routes, or `/api/ingredients/:slug?
expand=supplier` so the UI can display the name not the slug, looks cleaner.
- [x] Add a `/api/ingredients/:slug/recipes` to return all recipes that use this ingredient, this way we can show a list of
      recipes that use this ingredient on the ingredient page. (might need to add it to the app controller to, to use
      htmx, could be client side ease of loading)
- [x] Edit/Create modal is vertical heavy, should be padded properly, with overflow scroll.
- [x] Bottom bar breadcrumb not working, if the user clicks on an ingredient it should be `Ingredients / {group} / {slug}`. Allowing the user to know where they are
- [x] Ingredient price should tell the user to use pence/cents only. Not decimal currency.
- [x] Supplier value on main island should be `supplier.name` not the slug.

### Recipes

- [ ] `Cost Breakdown` should be same as `Ingredients`.`Used In` island. This is where there is a minimised bar
      that allows the user to open up different data on the 3rd island.
- [ ] Edit/Create modal does not look good on dark mode, needs to be styled properly.
- [ ] Edit/Create modal is vertical heavy, should be padded properly, with overflow scroll.
- [ ] `Ingredients` costs are not displayed properly.
- [x] Bottom bar breadcrumb not working, if the user clicks on an ingredient it should be `Recipe / {group} / {slug}`. Allowing the user to know where they are

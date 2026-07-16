# UI Rebuild RFC

This RFC proposes a comprehensive UI rebuild for the Menubook application, focusing on modernising
the user interface and improving the user experience.

Inspired by the new JetBrains IDEs and their [island design ethos](https://blog.jetbrains.com/platform/2025/12/meet-the-islands-theme-the-new-default-look-for-jetbrains-ides/).
I want to propose a similar design for the Menubook application.

## Structure

Focusing on focus. Making sure the user can focus on the content they want to see, without needing to
scroll around.

Navigation should be intuitive and straightforward, whenever possible. Using simple icons as the base, with an expandable sidebar
if the user needs, or dropdowns for more complex actions. Using separators to separate sections.

Hierarchy is the new black, with the aim being left-to-right reading (flow state depending on the locale). Take `recipes` for example: the left-side island is a file viewer style, with each recipe under a group. At the moment, we do not have a way to reflect groups, so we would be using types as a way to group recipes. With the idea that drag and drop will be
used to move recipes around. To the right side of the recipes is a main island, the recipe details and the editor. Where the user can edit the recipe details inline, and add ingredients, steps, and notes. The final right-hand island is the cost breakdown. Rather than having a separate page for this, they can be inline with the recipe details. We
could offer a bottom sheet for the cost breakdown of all recipes, maybe minor analytics.

At the top of the page, there will be a toolbar with the left side containing the logo and the application title, followed by dropdowns for the current tenant/environment and restaurant, and a down arrow to handle swapping - `GoBowling / Shipley ⌄`. With the right side with the search bar and user dropdown.

The bottom toolbar, with a 24px height, will have the left side for the breadcrumb trail of the in-focus island, and the right side for usage limits and version information.

Settings should be modal and appear in the sidebar at the bottom of the navigation. But being modal means they can be focused when needed without taking the user out of their current view.

Ingredients will follow a similar pattern to the recipe details, with the left island being a file viewer style, with each ingredient under a group. As the moment we do not have a way to reflect groups, we would be using types as a way to group ingredients.
With the idea that drag and drop will be used to move ingredients around. To the right side of the ingredients is a main island, the ingredient details and editor.
Where the user can edit the ingredient details inline and add notes. The right hand side, if we offer this could be link to all recipes using this ingredient, offering faster navigation.

Suppliers will be the simple page, offering more a simple table view of the suppliers, for half the page, with the right side offering inline editing of the supplier details.
We can offer a bottom island, when a supplier is selected, showing all ingredients that come from this supplier.

Help page can be moved, into more of a modal, and could be content aware, knowing what the current page is, so it can offer relevant help.

## Theming

Sticking to the default tailwind theme, for both white and dark mode at the moment.

We can always add more themes later, but for now, quicker to market is more important, so we can focus on the core functionality. If we get customers great, if not we can be happy with the look regardless.

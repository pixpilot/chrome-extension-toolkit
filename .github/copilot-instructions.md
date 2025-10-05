# Copilot Instructions

## Build Process

- Do not attempt to build the project when finishing tasks, as the dev server is already running in development mode and will automatically handle compilation.

## Commenting

- If a comment is long, write it as a multi-line comment and break lines for readability.

## Testing

This project uses Vitest for testing.

## Styling

- Use Tailwind CSS for styling.

## for messaging

- Use createMessage to create message and always place them in the messages folder.

# File Naming Conventions

## JavaScript/TypeScript

- **File Naming:** Use kebab-case for almost all files, including those whose main export is a PascalCase class.
  - Example: `my-module.ts`, `helper-functions.js`, `data-handler.js`
- **Frontend UI Components (React/Vue only):** Use PascalCase for component files (e.g., `MyButton.tsx`).
  - Example: `MyButton.tsx`, `UserProfile.vue`
- **Config files:** Use kebab-case unless the framework or library has a different standard—follow the convention for that tool.
  - Example: `tsconfig.json`, `rollup.config.js`

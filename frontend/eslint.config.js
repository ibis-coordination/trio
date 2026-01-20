import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import functional from "eslint-plugin-functional";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      functional,
    },
    rules: {
      // Immutability - no mutations allowed
      "functional/immutable-data": [
        "error",
        {
          // Allow React ref mutations (refs are designed for this)
          ignoreAccessorPattern: ["**.current"],
        },
      ],
      "functional/no-let": "error",
      "functional/prefer-readonly-type": "error",

      // No throw - allow throwing Error objects (needed for Effect.tryPromise pattern)
      "functional/no-throw-statements": ["error", { allowToRejectPromises: true }],

      // Allow classes for Effect error types (idiomatic pattern)
      "functional/no-classes": "off",

      // Relax some rules for React patterns
      // React event handlers and state setters return void - this is by design
      "functional/no-return-void": "off",
      // Allow expression statements for Effect.runPromise, console.log in dev, etc.
      "functional/no-expression-statements": "off",
      // Allow conditionals - often cleaner than ternaries for JSX
      "functional/no-conditional-statements": "off",
    },
  },
  {
    // Ignore build output
    ignores: ["dist/"],
  }
);

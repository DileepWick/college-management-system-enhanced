module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New features (e.g., OAuth)
        "fix",      // Bug/vulnerability fixes
        "docs",     // Documentation (README, report notes)
        "style",    // Formatting/linting
        "refactor", // Code restructuring without feature change
        "test",     // Security or unit testing
        "chore",    // Tooling/maintenance updates
        "ci",       // CI/CD and GitHub Actions
      ],
    ],
    "subject-case": [0], // Allow flexible casing for technical terms (e.g. JWT, OAuth, IDOR)
  },
};

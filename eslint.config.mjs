import nextConfig from "eslint-config-next"

// eslint-config-next 16 exports a native flat-config array, so it's spread
// directly (no FlatCompat bridge), same as TutorLane.
const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "lib/generated/**",
      "bestmart_mobile/**",
      "notes/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
]

export default eslintConfig

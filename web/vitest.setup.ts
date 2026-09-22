// Adds the jest-dom matchers (toHaveClass, toHaveTextContent, ...) to expect,
// and clears the jsdom document between tests so renders do not bleed across cases.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

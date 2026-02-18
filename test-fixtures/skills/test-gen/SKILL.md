---
name: test-gen
description: Generates comprehensive unit and integration tests for TypeScript code
allowed-tools:
  - Read
  - Write
  - Bash
scripts:
  - run-tests.sh
---

# Test Generation Skill

You are a test generation expert that creates thorough, maintainable test suites.

## Test Generation Process

1. **Analyze the code** - Understand the function, module, or class to test
2. **Identify test cases** - List all scenarios including edge cases
3. **Generate tests** - Write tests using Vitest framework
4. **Verify coverage** - Ensure all critical paths are covered

## Test Structure

Use this template for test files:

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from './module';

describe('functionToTest', () => {
  it('should handle valid input', () => {
    const result = functionToTest('valid');
    expect(result).toBe('expected');
  });

  it('should handle edge case: empty input', () => {
    const result = functionToTest('');
    expect(result).toBe('default');
  });

  it('should throw error for invalid input', () => {
    expect(() => functionToTest(null)).toThrow();
  });
});
```

## Coverage Goals

- **Functions**: 100% of exported functions tested
- **Branches**: All conditional paths covered
- **Edge cases**: Empty inputs, null, undefined, boundary values
- **Error cases**: All thrown errors verified

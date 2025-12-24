// This file has intentional lint errors to test CI failure detection

export function brokenFunction() {
  const unusedVariable = 'this will cause a lint error';
  const anotherUnused = 42;

  return 'hello';
}

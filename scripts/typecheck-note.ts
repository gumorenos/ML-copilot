console.error("Static TypeScript typecheck is unavailable: the TypeScript compiler is not installed in this checkout.");
console.error("Run npm install in an environment with registry access, then add the repository's pinned compiler before enabling this gate.");
process.exitCode = 2;

#!/usr/bin/env node
// Reproduce the numbered user review; rejected assets cannot reappear.
require('./reviewed-pairings.cjs').main().catch(error=>{console.error(error);process.exitCode=1;});

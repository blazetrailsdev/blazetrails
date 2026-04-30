#!/usr/bin/env node
import { argv } from "@blazetrails/activesupport";
import { createProgram } from "./cli.js";

const program = createProgram();
// `argv` is the process adapter's snapshot of the host argv, populated
// at activesupport's module load via the eager Node auto-register.
program.parse(argv as string[]);

export interface WebExtLintMessage {
  code: string;
  message: string;
  description?: string;
  file: string;
  line: number;
}

export interface WebExtLintOutput {
  summary: { errors: number; notices: number; warnings: number };
  errors: WebExtLintMessage[];
  notices: WebExtLintMessage[];
  warnings: WebExtLintMessage[];
}

export function isAllowlistedWarning(warning: WebExtLintMessage): boolean;
export function validateLintOutput(lintJson: WebExtLintOutput): string[];
export function verifyPipelineImports(sourcePath: string): string[];
export function scanReleaseBundles(sourceDir: string, rootDir?: string): string[];
export function runLint(): WebExtLintOutput;

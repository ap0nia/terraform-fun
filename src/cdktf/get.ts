import fs from "node:fs";
import path from "node:path";
import { ConstructsMaker, GetOptions } from "@cdktf/provider-generator";
import {
  Language,
  TerraformModuleConstraint,
  TerraformProviderConstraint,
  TerraformDependencyConstraint,
} from "@cdktf/commons";
import { logger } from "@cdktf/commons";
import { CdktfConfig } from "@cdktf/cli-core/src/lib/cdktf-config.js";

// eslint-disable-next-line @typescript-eslint/no-empty-function 
function noop() { }

export enum GetStatus {
  STARTING = "starting",
  DOWNLOADING = "downloading and generating modules and providers",
  DONE = "done",
  ERROR = "error",
}

type ParsedDependencyConstraint =
  | TerraformModuleConstraint
  | TerraformProviderConstraint
  | TerraformDependencyConstraint;

interface GetConfig {
  // All existing constraints (to be able to remove no longer used ones)
  constraints: ParsedDependencyConstraint[];

  // The constraints that should be generated
  constraintsToGenerate?: ParsedDependencyConstraint[];
  constructsOptions: GetOptions;
  cleanDirectory?: boolean;
  onUpdate?: (payload: GetStatus) => void;
  reportTelemetry?: (telemetry: {
    targetLanguage: string;
    trackingPayload: Record<string, any>;
  }) => void;
}

export const DEFAULT_CONSTRUCTS_OPTIONS: GetOptions = {
  codeMakerOutput: '.gen',
  targetLanguage: Language.TYPESCRIPT,
  jsiiParallelism: -1
};

export async function get({
  constructsOptions,
  constraints,
  constraintsToGenerate,
  cleanDirectory,
  onUpdate = noop,
  reportTelemetry = noop,
}: GetConfig) {
  logger.debug(`Starting get with outdir ${constructsOptions.codeMakerOutput}`);

  const constructsMaker = new ConstructsMaker(constructsOptions, reportTelemetry);

  if (cleanDirectory) {
    fs.rmSync(constructsOptions.codeMakerOutput, { recursive: true, force: true });
  } else {
    // Remove all providers that are not in the new list
    await constructsMaker.removeFoldersThatShouldNotExist(constraints);

    if (constructsOptions.targetLanguage === Language.TYPESCRIPT) {
      // Remove all modules
      fs.rmSync(path.resolve(constructsOptions.codeMakerOutput, "modules"), { 
        recursive: true,
        force: true,
      });
    }
  }

  // Filter constraints to generate
  const toGenerate = constraintsToGenerate || (await constructsMaker.filterAlreadyGenerated(constraints));

  onUpdate(GetStatus.DOWNLOADING);

  logger.debug("Generating provider bindings");

  await constructsMaker.generate(constraints, toGenerate);

  logger.debug("Provider bindings generated");

  if (!(fs.existsSync(constructsOptions.codeMakerOutput))) {
    onUpdate(GetStatus.ERROR);
    logger.debug("Failed to generate provider bindings");
  } else {
    onUpdate(GetStatus.DONE);
    logger.debug("Provider bindings generated");
  }
}

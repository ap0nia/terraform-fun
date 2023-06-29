import fs from 'node:fs'
import path from 'node:path'
import { Manifest, type StackManifest, type TerraformStackMetadata } from "cdktf";
import { Errors, ensureAllSettledBeforeThrowing } from '@cdktf/commons'
import {
  getMultipleStacks,
  getStackWithNoUnmetDependencies,
  checkIfAllDependantsAreIncluded,
  checkIfAllDependenciesAreIncluded,
  getStackWithNoUnmetDependants,
  findAllNestedDependantStacks,
} from '@cdktf/cli-core/src/lib/helpers/stack-helpers.js'
import { CdktfStack } from '@cdktf/cli-core';
import { getDirectories } from '../utils/directories.js';

function noop() { }

interface SynthesizedStack extends StackManifest {
  content: string;
}

interface ManifestJson {
  version: string;
  stacks: Record<string, StackManifest>;
}

interface SynthesizedStackMetadata {
  "//"?: Record<string, TerraformStackMetadata>
}

type ExecutionMethod = 'deploy' | 'destroy'

type CdktfStackMiddleware = () => Promise<CdktfStack | undefined>

const CONFIG_DEFAULTS = {
  output: "cdktf.out",
  codeMakerOutput: ".gen",
}

export type MultipleStackOptions = {
  stackNames?: string[];
};

export type AutoApproveOptions = {
  autoApprove?: boolean;
};

export type MutationOptions = MultipleStackOptions & AutoApproveOptions & {
  refreshOnly?: boolean;
  ignoreMissingStackDependencies?: boolean;
  parallelism?: number;
  terraformParallelism?: number;
  vars?: string[];
  varFiles?: string[];
  noColor?: boolean;
  migrateState?: boolean;
};

interface CdktfProjectOptions {
  /**
   * A function that will run and generate an output JSON.
   */
  synthFn?: () => unknown | Promise<unknown>;
}

/**
 * A simplfied, minimal adaptation of the official class.
 * {@link https://github.com/hashicorp/terraform-cdk/blob/main/packages/%40cdktf/cli-core/src/lib/cdktf-project.ts}
 */
export class CdktfProject {
  public stacksToRun: CdktfStack[] = [];

  private stopAllStacksThatCanNotRunWithout: (stackName: string) => void = noop

  public hardAbort: () => void;

  private abortSignal: AbortSignal;

  private synthFn: () => unknown | Promise<unknown>;

  constructor(options: CdktfProjectOptions = {}) {
    this.synthFn = options.synthFn ?? noop;

    const ac = new AbortController();
    this.abortSignal = ac.signal;
    this.hardAbort = ac.abort.bind(ac);
  }

  async synth(opts = CONFIG_DEFAULTS) {
    await this.synthFn()

    if (!(fs.existsSync(path.join(opts.output, Manifest.fileName)))) {
      throw new Error(
        `ERROR: synthesis failed, because app was expected to call 'synth()', but didn't. Thus "${opts.output}/${Manifest.fileName}"  was not created.`
      );
    }

    const manifest: ManifestJson = JSON.parse(
      fs.readFileSync(path.join(opts.output, Manifest.fileName)).toString()
    );

    const stacks: SynthesizedStack[] = Object.keys(manifest.stacks).map(stackName => {
      const stack = manifest.stacks[stackName];

      const filePath = path.join(opts.output, stack.synthesizedStackPath);

      const jsonContent: SynthesizedStackMetadata = JSON.parse(
        fs.readFileSync(filePath).toString()
      );

      return {
        ...stack,
        workingDirectory: path.join(opts.output, stack.workingDirectory),
        content: JSON.stringify(jsonContent, null, 2),
      }
    })

    if (stacks.length === 0) {
      console.error("ERROR: No Terraform code synthesized.");
    } else {
      console.log("Synthesized Terraform code for the following stacks: ", stacks);
    }

    const stackNames = stacks.map((s) => s.name);

    const existingDirectories = getDirectories(path.join(opts.output, Manifest.stacksFolder));

    const orphanedDirectories = existingDirectories.filter(
      (e) => !stackNames.includes(path.basename(e))
    );

    for (const orphanedDirectory of orphanedDirectories) {
      fs.rmSync(orphanedDirectory, { recursive: true });
    }

    return stacks
  }

  async deploy(opts: MutationOptions = {}) {
    const stacks = await this.synth();

    const stacksToRun = getMultipleStacks(stacks, opts.stackNames, "deploy");

    if (!opts.ignoreMissingStackDependencies) {
      checkIfAllDependenciesAreIncluded(stacksToRun);
    }

    const abortController = new AbortController();

    this.stacksToRun = stacksToRun.map((stack) => {
      return new CdktfStack({
        ...opts,
        onUpdate(update) {
          console.log({ update })
          if (update.type === 'waiting for stack approval') {
            update.approve()
          }
        },
        abortSignal: abortController.signal,
        stack,
      });
    });

    this.stopAllStacksThatCanNotRunWithout = (stackName: string) => {
      findAllNestedDependantStacks(this.stacksToRun, stackName).forEach((stack) => stack.stop());
    };

    const next = opts.ignoreMissingStackDependencies
      ? () => Promise.resolve(this.stacksToRun.filter((stack) => stack.isPending)[0])
      : () => getStackWithNoUnmetDependencies(this.stacksToRun);


    await this.execute("deploy", next, opts);

    const unprocessedStacks = this.stacksToRun.filter((executor) => executor.isPending);

    if (unprocessedStacks.length > 0) {
      throw Errors.External(
        `Some stacks failed to deploy: ${unprocessedStacks
          .map((s) => s.stack.name)
          .join(", ")}. Please check the logs for more information.`
      );
    }
  }

  public async destroy(opts: MutationOptions = {}) {
    const stacks = await this.synth();

    const stacksToRun = getMultipleStacks(stacks, opts.stackNames, "destroy");

    if (!opts.ignoreMissingStackDependencies) {
      checkIfAllDependantsAreIncluded(stacksToRun, stacks);
    }

    this.stopAllStacksThatCanNotRunWithout = (stackName: string) => {
      const stackExecutor = this.stacksToRun.find((s) => s.stack.name === stackName);

      if (!stackExecutor) {
        throw Errors.Internal(
          `Could not find stack "${stackName}" that was stopped`
        );
      }

      stackExecutor.stack.dependencies.forEach((dependant) => {
        this.stopAllStacksThatCanNotRunWithout(dependant);

        const dependantStack = this.stacksToRun.find(
          (s) => s.stack.name === dependant
        );

        if (!dependantStack) {
          throw Errors.Internal(
            `Could not find stack "${dependant}" that was stopped`
          );
        }

        dependantStack.stop();
      });
    };

    this.stacksToRun = stacksToRun.map((stack) =>
      this.getStackExecutor(stack, opts)
    );

    const next = opts.ignoreMissingStackDependencies
      ? () => Promise.resolve(this.stacksToRun.filter((stack) => stack.currentState !== "done")[0])
      : () => getStackWithNoUnmetDependants(this.stacksToRun);

    await this.execute("destroy", next, opts);

    const unprocessedStacks = this.stacksToRun.filter((executor) => executor.isPending);

    if (unprocessedStacks.length > 0) {
      throw Errors.External(
        `Some stacks failed to destroy: ${unprocessedStacks
          .map((s) => s.stack.name)
          .join(", ")}. Please check the logs for more information.`
      );
    }
  }

  async execute(method: ExecutionMethod, next: CdktfStackMiddleware, opts: MutationOptions) {
    // We only support refresh only on deploy, a bit of a leaky abstraction here
    if (opts.refreshOnly && method !== "deploy") {
      throw Errors.Internal(`Refresh only is only supported on deploy`);
    }

    const maxParallelRuns = !opts.parallelism || opts.parallelism < 0 ? Infinity : opts.parallelism;

    const allExecutions: Promise<unknown>[] = [];

    await this.initializeStacksToRunInSerial(opts.noColor);

    while (this.stacksToRun.filter((stack) => stack.isPending).length > 0) {
      const runningStacks = this.stacksToRun.filter((stack) => stack.isRunning);

      if (runningStacks.length >= maxParallelRuns) {
        await Promise.race(runningStacks.map((s) => s.currentWorkPromise));
        continue;
      }

      try {
        const nextRunningExecutor = await next();

        if (!nextRunningExecutor) {
          // In this case we have no pending stacks, but we also can not find a new executor
          break;
        }

        const promise = method === "deploy"
          ? nextRunningExecutor.deploy(opts)
          : nextRunningExecutor.destroy(opts);

        allExecutions.push(promise);
      } catch (e) {
        // await next() threw an error because a stack failed to apply/destroy
        // wait for all other currently running stacks to complete before propagating that error
        console.debug("Encountered an error while awaiting stack to finish", e);
        const openStacks = this.stacksToRun.filter((ex) => ex.currentWorkPromise);
        console.debug("Waiting for still running stacks to finish:", openStacks);
        await Promise.allSettled(openStacks.map((ex) => ex.currentWorkPromise));
        console.debug("Done waiting for still running stacks. All pending work finished");
        throw e;
      }
    }

    // We end the loop when all stacks are started, now we need to wait for them to be done.
    // We wait for all work to finish even if one of the promises threw an error.
    await ensureAllSettledBeforeThrowing(Promise.all(allExecutions), allExecutions);
  }

  public getStackExecutor(stack: SynthesizedStack, opts: AutoApproveOptions = {}) {
    return new CdktfStack({
      ...opts,
      stack,
      onUpdate(update) {
        console.log({ update })
        if (update.type === 'waiting for stack approval') {
          update.approve()
        }
      },
      abortSignal: this.abortSignal,
    });
  }

  // Serially run terraform init to prohibit text file busy errors for the cache files
  private async initializeStacksToRunInSerial(noColor?: boolean): Promise<void> {
    await Promise.all(this.stacksToRun.map((stack) => stack.initalizeTerraform(noColor)));
  }
}

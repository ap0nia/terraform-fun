import fs from 'node:fs'
import path from 'node:path'
import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { Container } from "@cdktf/provider-docker/lib/container";
import { Manifest, type StackManifest, type TerraformStackMetadata } from "cdktf";
import { Errors, ensureAllSettledBeforeThrowing } from '@cdktf/commons'
import {
  getMultipleStacks,
  getStackWithNoUnmetDependencies,
  checkIfAllDependenciesAreIncluded,
} from '@cdktf/cli-core/src/lib/helpers/stack-helpers'
import { CdktfStack } from '@cdktf/cli-core';

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


const CONFIG_DEFAULTS = {
  output: "cdktf.out",
  codeMakerOutput: ".gen",
}

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new DockerProvider(this, "docker", {});

    const dockerImage = new Image(this, "nginxImage", {
      name: "nginx:latest",
      keepLocally: false,
    });

    new Container(this, "nginxContainer", {
      name: "tutorial",
      image: dockerImage.name,
      ports: [
        {
          internal: 80,
          external: 8000,
        }
      ],
    });
  }
}

function getDirectories(source: string) {
  return fs.existsSync(source)
    ? fs
      .readdirSync(source)
      .map((name) => path.join(source, name))
      .filter(source => fs.lstatSync(source).isDirectory())
    : [];
};

export type MultipleStackOptions = {
  stackNames?: string[];
};

export type AutoApproveOptions = {
  autoApprove?: boolean;
};

export type MutationOptions = MultipleStackOptions &
  AutoApproveOptions & {
    refreshOnly?: boolean;
    ignoreMissingStackDependencies?: boolean;
    parallelism?: number;
    terraformParallelism?: number;
    vars?: string[];
    varFiles?: string[];
    noColor?: boolean;
    migrateState?: boolean;
  };

async function start() {
  // const app = new App();

  // new MyStack(app, "learn-cdktf-docker");

  // app.synth();

  // synth

  const outdir = CONFIG_DEFAULTS.output;

  if (!(fs.existsSync(path.join(outdir, Manifest.fileName)))) {
    throw new Error(
      `ERROR: synthesis failed, because app was expected to call 'synth()', but didn't. Thus "${outdir}/${Manifest.fileName}"  was not created.`
    );
  }

  const manifest: ManifestJson = JSON.parse(
    fs.readFileSync(path.join(outdir, Manifest.fileName)).toString()
  );

  const stacks: SynthesizedStack[] = Object.keys(manifest.stacks).map(stackName => {
    const stack = manifest.stacks[stackName];

    const filePath = path.join(outdir, stack.synthesizedStackPath);

    const jsonContent: SynthesizedStackMetadata = JSON.parse(
      fs.readFileSync(filePath).toString()
    );

    return {
      ...stack,
      workingDirectory: path.join(outdir, stack.workingDirectory),
      content: JSON.stringify(jsonContent, null, 2),
    }
  })

  if (stacks.length === 0) {
    console.error("ERROR: No Terraform code synthesized.");
  } else {
    console.log("Synthesized Terraform code for the following stacks: ", stacks);
  }

  const stackNames = stacks.map((s) => s.name);

  const existingDirectories = getDirectories(path.join(outdir, Manifest.stacksFolder));


  const orphanedDirectories = existingDirectories.filter(
    (e) => !stackNames.includes(path.basename(e))
  );

  for (const orphanedDirectory of orphanedDirectories) {
    fs.rmSync(orphanedDirectory, { recursive: true });
  }

  // deploy
  let opts = {
    stackNames,
    ignoreMissingStackDependencies: false,
  }

  const stacksToRun = getMultipleStacks(stacks, opts.stackNames, "deploy");

  if (!opts.ignoreMissingStackDependencies) {
    checkIfAllDependenciesAreIncluded(stacksToRun);
  }

  const abortController = new AbortController();

  const thisstacksToRun = stacksToRun.map((stack) => {
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

  // this.stopAllStacksThatCanNotRunWithout = (stackName: string) => {
  //   findAllNestedDependantStacks(thisstacksToRun, stackName).forEach((stack) => stack.stop());
  // };

  const next = opts.ignoreMissingStackDependencies
    ? () => Promise.resolve(thisstacksToRun.filter((stack) => stack.isPending)[0])
    : () => getStackWithNoUnmetDependencies(thisstacksToRun);

  async function execute(
    method: "deploy" | "destroy",
    next: () => Promise<CdktfStack | undefined>,
    opts: MutationOptions,
  ) {
    // We only support refresh only on deploy, a bit of a leaky abstraction here
    if (opts.refreshOnly && method !== "deploy") {
      throw Errors.Internal(`Refresh only is only supported on deploy`);
    }

    const maxParallelRuns = !opts.parallelism || opts.parallelism < 0 ? Infinity : opts.parallelism;

    const allExecutions: Promise<unknown>[] = [];

    // await this.initializeStacksToRunInSerial(opts.noColor);

    // await Promise.all(
    //   thisstacksToRun.map(stack => stack.initalizeTerraform(opts.noColor))
    // )

    while (thisstacksToRun.filter((stack) => stack.isPending).length > 0) {
      const runningStacks = thisstacksToRun.filter((stack) => stack.isRunning);

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
        const promise =
          method === "deploy"
            ? nextRunningExecutor.deploy(opts)
            : nextRunningExecutor.destroy(opts);

        allExecutions.push(promise);
      } catch (e) {
        // await next() threw an error because a stack failed to apply/destroy
        // wait for all other currently running stacks to complete before propagating that error
        console.debug("Encountered an error while awaiting stack to finish", e);
        const openStacks = thisstacksToRun.filter((ex) => ex.currentWorkPromise);
        console.debug("Waiting for still running stacks to finish:", openStacks);
        await Promise.allSettled(openStacks.map((ex) => ex.currentWorkPromise));
        console.debug("Done waiting for still running stacks. All pending work finished");
        throw e;
      }
    }

    // We end the loop when all stacks are started, now we need to wait for them to be done
    // We wait for all work to finish even if one of the promises threw an error.
    await ensureAllSettledBeforeThrowing(
      Promise.all(allExecutions),
      allExecutions
    );
  }


  await execute("deploy", next, opts);

  const unprocessedStacks = thisstacksToRun.filter((executor) => executor.isPending);

  if (unprocessedStacks.length > 0) {
    throw Errors.External(
      `Some stacks failed to deploy: ${unprocessedStacks
        .map((s) => s.stack.name)
        .join(", ")}. Please check the logs for more information.`
    );
  }
}

start()

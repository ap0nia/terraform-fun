import fs from 'node:fs'
import path from 'node:path'
import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { Container } from "@cdktf/provider-docker/lib/container";
import { Manifest, type StackManifest, type TerraformStackMetadata } from "cdktf";
import { Errors } from '@cdktf/commons'
import {
  getMultipleStacks,
  getStackWithNoUnmetDependencies,
  checkIfAllDependenciesAreIncluded,
  findAllNestedDependantStacks
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

  const existingDirectories = getDirectories(
    path.join(outdir, Manifest.stacksFolder)
  );


  const orphanedDirectories = existingDirectories.filter(
    (e) => !stackNames.includes(path.basename(e))
  );

  for (const orphanedDirectory of orphanedDirectories) {
    fs.rmSync(orphanedDirectory, { recursive: true });
  }

  // deploy
  let opts: any = {}

  const stacksToRun = getMultipleStacks(stacks, opts.stackNames, "deploy");

  if (!opts.ignoreMissingStackDependencies) {
    checkIfAllDependenciesAreIncluded(stacksToRun);
  }

  const thisstacksToRun = stacksToRun.map((stack) => {
    return new CdktfStack({ ...opts, stack });
  });

  // this.stopAllStacksThatCanNotRunWithout = (stackName: string) => {
  //   findAllNestedDependantStacks(thisstacksToRun, stackName).forEach((stack) => stack.stop());
  // };

  const next = opts.ignoreMissingStackDependencies
    ? () => Promise.resolve(thisstacksToRun.filter((stack) => stack.isPending)[0])
    : () => getStackWithNoUnmetDependencies(thisstacksToRun);

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

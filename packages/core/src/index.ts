import cdktf from "cdktf";
import { MainStack } from './stacks/main.js'
import { StateStack } from './stacks/state.js'
import { CdktfProject } from './cdktf/project.js'

export async function handleStateStack() {
  const project = new CdktfProject({
    synthFn() {
      const app = new cdktf.App();
      new StateStack(app, 'cdktf-state');
      app.synth()
    }
  })

  await project.deploy()
  await project.destroy()
}

export async function handleMainStack() {
  const project = new CdktfProject({
    synthFn() {
      const app = new cdktf.App();
      new MainStack(app, 'learn-cdktf-aws');
      app.synth()
    },
  });

  await project.deploy()
  await project.destroy()
}

async function main() {
  // handleStateStack()
  // handleMainStack()
}

main()

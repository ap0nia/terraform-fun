import cdktf from "cdktf";
import { StateStack } from './stacks/state.js'
import { CdktfProject } from './cdktf/project.js'
import { SvelteKitStack } from './stacks/sveltekit.js'

export async function handleStateStack() {
  const project = new CdktfProject({
    synthFn() {
      const app = new cdktf.App();
      new StateStack(app, 'cdktf-state');
      app.synth()
    }
  })

  await project.deploy()
  // await project.destroy()
}

export async function handleMainStack() {
  const project = new CdktfProject({
    synthFn() {
      const app = new cdktf.App();
      new SvelteKitStack(app, 'sveltekit-sverdle');
      app.synth()
    },
  });

  await project.deploy()
  // await project.destroy()
}

async function main() {
  // handleStateStack()
  handleMainStack()
}

main()

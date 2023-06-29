import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { Container } from "@cdktf/provider-docker/lib/container";
import { CdktfProject } from './cdktf/project.js'

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

async function synthFn() {
  const app = new App();

  new MyStack(app, "learn-cdktf-docker");

  app.synth();
}

async function start() {
  const project = new CdktfProject({ synthFn });

  // await project.deploy()

  await project.destroy()
}

start()

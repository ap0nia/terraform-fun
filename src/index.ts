import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { aws_s3 } from 'aws-cdk-lib';
import { AwsTerraformAdapter, provider } from "@cdktf/aws-cdk";

import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { Container } from "@cdktf/provider-docker/lib/container";
import { CdktfProject } from './cdktf/project.js'

export class MyStack extends TerraformStack {
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

export class HelloCdkStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    new aws_s3.Bucket(awsAdapter, 'MyFirstBucket', { versioned: true });
  }
}


async function synthFn() {
  const app = new App();

  // new MyStack(app, "learn-cdktf-docker");
  new HelloCdkStack(app, "learn-cdktf-aws");

  app.synth();
}

async function start() {
  const project = new CdktfProject({ synthFn });

  // await project.deploy()
  await project.destroy()
}

start()

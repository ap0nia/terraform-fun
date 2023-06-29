import { Construct } from "constructs";
import aws_s3 from 'aws-cdk-lib/aws-s3';
import aws_ecr from 'aws-cdk-lib/aws-ecr';
import { App, TerraformStack } from "cdktf";
import { AwsTerraformAdapter, provider } from "@cdktf/aws-cdk";
import { CdktfProject } from './cdktf/project.js'
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import ecrdeploy from 'cdk-ecr-deployment';

export class HelloCdkStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    const repository = new aws_ecr.Repository(awsAdapter, 'MyFirstRepository', {
      imageScanOnPush: true,
      imageTagMutability: aws_ecr.TagMutability.MUTABLE
    })

    const image = new DockerImageAsset(awsAdapter, 'MyFirstImage', { directory: '.' });

    new ecrdeploy.ECRDeployment(awsAdapter, 'MyFirstImageDeployment', {
      src: new ecrdeploy.DockerImageName(image.imageUri),
      dest: new ecrdeploy.DockerImageName(`${repository.repositoryUri}:nginx`),
    });

    new aws_s3.Bucket(awsAdapter, 'MyFirstBucket', { versioned: true });
  }
}

async function synthFn() {
  const app = new App();

  new HelloCdkStack(app, "learn-cdktf-aws");

  app.synth();
}

async function start() {
  const project = new CdktfProject({ synthFn });

  await project.deploy()

  // await project.destroy()
}

start()

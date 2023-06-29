import { Construct } from "constructs";
import aws_s3 from 'aws-cdk-lib/aws-s3';
import { App, TerraformStack, S3Backend } from "cdktf";
import { AwsTerraformAdapter, provider } from "@cdktf/aws-cdk";
import { CdktfProject } from './cdktf/project.js'

const bucketName = 'cdktf-state'

/**
 * Needs to exist first.
 */
export class CdktfStateStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    new aws_s3.Bucket(awsAdapter, 'MyFirstBucket', { bucketName, versioned: true });
  }
}

export class HelloCdkStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    new S3Backend(this, { 
      bucket: bucketName,
      key: 'terraform.tfstate',
    })

    new aws_s3.Bucket(awsAdapter, 'MyFirstBucket', {
      bucketName: `${name}-bucket`,
      versioned: true
    });
  }
}

async function synthFn() {
  const app = new App();

  new HelloCdkStack(app, "learn-cdktf-aws");

  app.synth();
}

async function start() {
  const project = new CdktfProject({ synthFn });

  // await project.deploy()

  await project.destroy()
}

start()

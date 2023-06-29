import { Construct } from "constructs";
import aws_s3 from 'aws-cdk-lib/aws-s3';
import { App, TerraformStack } from "cdktf";
import { AwsTerraformAdapter, provider } from "@cdktf/aws-cdk";
import { CdktfProject } from './cdktf/project.js'

export class HelloCdkStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    new aws_s3.Bucket(awsAdapter, 'MyFirstBucket', {
      bucketName: 'my-first-bucket-in-terraform-is-so-epic',
      versioned: true,
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

  // await project.get()

  // await project.deploy()

  await project.destroy()
}

start()

// import { Construct } from "constructs";
// import { App, TerraformStack } from "cdktf";
// import { aws_s3 } from 'aws-cdk-lib';
// import { AwsTerraformAdapter, provider } from "@cdktf/aws-cdk";
// import { CdktfProject } from './cdktf/project.js'
// 
// export class HelloCdkStack extends TerraformStack {
//   constructor(scope: Construct, name: string) {
//     super(scope, name);
// 
//     new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })
// 
//     const awsAdapter = new AwsTerraformAdapter(this, "adapter");
// 
//     new aws_s3.Bucket(awsAdapter, 'MyFirstBucket', { 
//       bucketName: 'my-first-bucket-in-terraform-is-so-epic',
//       versioned: true,
//     });
//   }
// }
// 
// 
// async function synthFn() {
//   const app = new App();
// 
//   // new MyStack(app, "learn-cdktf-docker");
//   new HelloCdkStack(app, "learn-cdktf-aws");
// 
//   app.synth();
// }
// 
// synthFn()

// async function start() {
//   const project = new CdktfProject({ synthFn });
// 
//   await project.deploy()
//   await project.destroy()
// }
// 
// start()

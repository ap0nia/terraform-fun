import { Construct } from "constructs";
import cdk from 'aws-cdk-lib'
import { App, TerraformStack, TerraformResource } from "cdktf";
import { AwsTerraformAdapter } from "@cdktf/aws-cdk";
import { AwsProvider } from './cdktf/provider.js'
import { CdktfProject } from './cdktf/project.js'
import { searchForWorkspaceRoot } from './utils/directories.js'

cdk.CfnElement

const bucketName = 'cdktf-state'

const functionName = 'hello-cdk'

const workspaceRoot = searchForWorkspaceRoot(process.cwd())

const directory = `${workspaceRoot}/packages/server`

const restApiName = `${bucketName}-api`

export class HelloCdkStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', {
      region: process.env.AWS_REGION ?? 'us-east-1',
    })

    // new S3Backend(this, {
    //   bucket: bucketName,
    //   key: 'terraform.tfstate',
    //   region: process.env.AWS_REGION ?? 'us-east-1'
    // })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    const bucket = new cdk.aws_s3.Bucket(awsAdapter, "WidgetStore", {
      bucketName: `${functionName}-lambda-handler-bucket`,
      versioned: true,
    });

    const handler = new cdk.aws_lambda.Function(awsAdapter, `${functionName}-handler`, {
      code: cdk.aws_lambda.Code.fromAsset(directory, {
        exclude: ['node_modules'],
      }),
      handler: 'dist/index.handler',
      timeout: cdk.Duration.seconds(15),
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      memorySize: 512,
      functionName,
      environment: {
        BUCKET: bucket.bucketName
      },
      
    })

    bucket.grantReadWrite(handler)

    // const resource = new cdk.aws_apigateway.RestApi(awsAdapter, restApiName, {
    //   defaultCorsPreflightOptions: {
    //     allowOrigins: ["*"],
    //     allowHeaders: ["Apollo-Require-Preflight", "Content-Type"],
    //     allowMethods: ["GET", "HEAD", "POST"],
    //   },
    //   endpointTypes: [cdk.aws_apigateway.EndpointType.EDGE],
    //   minCompressionSize: cdk.Size.bytes(128 * 1024), // 128 KiB
    //   restApiName,
    // })

    // resource.root.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(handler))
  }
}

async function synthFn() {
  const app = new App();

  new HelloCdkStack(app, 'learn-cdktf-aws');

  app.synth();
}

async function start() {
  const project = new CdktfProject({ synthFn });

  await project.deploy()

  // await project.destroy()
}

start()

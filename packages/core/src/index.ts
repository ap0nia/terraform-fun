import { Construct } from "constructs";
import cdk from 'aws-cdk-lib'
import { App, TerraformStack, S3Backend, TerraformAsset, AssetType } from "cdktf";
import * as aws from "@cdktf/provider-aws";
import { provider } from "@cdktf/aws-cdk";
import { CdktfProject } from './cdktf/project.js'
import { searchForWorkspaceRoot } from './utils/directories.js'

const bucketName = 'cdktf-state'

const functionName = 'hello-cdk'

const workspaceRoot = searchForWorkspaceRoot(process.cwd())

const directory = `${workspaceRoot}/packages/server`

// const restApiName = `${bucketName}-api`

const lambdaRolePolicy = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
};

/**
 * Needs to exist first.
 */
export class CdktfStateStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    // new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    // const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    // new cdk.aws_s3.Bucket(awsAdapter, 'MyFirstBucket', { bucketName, versioned: true });
  }
}

export class HelloCdkStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', {
      region: process.env.AWS_REGION ?? 'us-east-1'
    })

    // const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    new S3Backend(this, {
      bucket: bucketName,
      key: 'terraform.tfstate',
      region: process.env.AWS_REGION ?? 'us-east-1'
    })

    // Create Lambda executable
    const asset = new TerraformAsset(this, "lambda-asset", { 
      path: directory,
      type: AssetType.ARCHIVE,
    });

    // Create unique S3 bucket that hosts Lambda executable
    const bucket = new aws.s3Bucket.S3Bucket(this, "bucket", {
      bucketPrefix: `learn-cdktf-${name}`,
    });

    // Upload Lambda zip file to newly created S3 bucket
    const lambdaArchive = new aws.s3Object.S3Object(this, "lambda-archive", {
      bucket: bucket.bucket,
      key: `${functionName}.zip`,
      source: asset.path, // returns a posix path
    });

    // Create Lambda role
    const role = new aws.iamRole.IamRole(this, "lambda-exec", {
      name: `${functionName}-exec`,
      assumeRolePolicy: JSON.stringify(lambdaRolePolicy)
    });

    // Add execution role for lambda to write to CloudWatch logs
    new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(this, "lambda-managed-policy", {
      policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      role: role.name
    });

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

    const lambdaFunc = new aws.lambdaFunction.LambdaFunction(this, `${functionName}-handler`, {
      functionName,
      s3Bucket: bucket.bucket,
      s3Key: lambdaArchive.key,
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X.toString(),
      handler: 'dist/index.handler',
      architectures: [cdk.aws_lambda.Architecture.ARM_64.name],
      timeout: cdk.Duration.seconds(15).toSeconds(),
      memorySize: 512,
      role: role.arn,
      // code: cdk.aws_lambda.Code.fromAsset(directory, { exclude: ['node_modules'] }),
      // architecture: cdk.aws_lambda.Architecture.ARM_64.name,
    })

    // resource.root.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(handler))

    // Create and configure API gateway
    const api = new aws.apigatewayv2Api.Apigatewayv2Api(this, "api-gw", {
      name: name,
      protocolType: "HTTP",
      target: lambdaFunc.arn
    });

    new aws.lambdaPermission.LambdaPermission(this, "apigw-lambda", {
      functionName: lambdaFunc.functionName,
      action: "lambda:InvokeFunction",
      principal: "apigateway.amazonaws.com",
      sourceArn: `${api.executionArn}/*/*`,
    });

  }
}

async function synthFn() {
  const app = new App();

  new HelloCdkStack(app, 'learn-cdktf-aws');

  app.synth();
}

async function start() {
  // const project = new CdktfProject({ synthFn });

  // await project.deploy()

  // await project.destroy()
}

start()

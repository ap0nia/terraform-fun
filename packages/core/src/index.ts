import cdktf from "cdktf";
import aws from "@cdktf/provider-aws";
import { Construct } from "constructs";
import { CdktfProject } from './cdktf/project.js'
import { searchForWorkspaceRoot } from './utils/directories.js'

const workspaceRoot = searchForWorkspaceRoot(process.cwd())

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

export class HelloCdkStack extends cdktf.TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new cdktf.S3Backend(this, {
      bucket: 'cdktf-state',
      key: 'terraform.tfstate',
      region: process.env.AWS_REGION ?? 'us-east-1'
    })

    new aws.provider.AwsProvider(this, "aws", {
      region: process.env.AWS_REGION ?? "us-east-1",
    });

    // Create Lambda executable
    const asset = new cdktf.TerraformAsset(this, "lambda-asset", {
      path: `${workspaceRoot}/packages/server`,
      type: cdktf.AssetType.ARCHIVE,
    });


    // Create unique S3 bucket that hosts Lambda executable
    const bucket = new aws.s3Bucket.S3Bucket(this, "bucket", {
      bucketPrefix: `learn-cdktf-${name}`,
    });

    // Upload Lambda zip file to newly created S3 bucket
    const lambdaArchive = new aws.s3Object.S3Object(this, "lambda-archive", {
      bucket: bucket.bucket,
      key: `hello-cdktf-server.zip`,
      source: asset.path,
    });

    // Create Lambda role
    const role = new aws.iamRole.IamRole(this, "lambda-exec", {
      name: `learn-cdktf-server`,
      assumeRolePolicy: JSON.stringify(lambdaRolePolicy)
    });

    // Add execution role for lambda to write to CloudWatch logs
    new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(this, "lambda-managed-policy", {
      policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      role: role.name
    });

    // Create Lambda function
    const lambdaFunc = new aws.lambdaFunction.LambdaFunction(this, "learn-cdktf-lambda", {
      functionName: `learn-cdktf-${name}-lambda`,
      s3Bucket: bucket.bucket,
      s3Key: lambdaArchive.key,
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      role: role.arn,
    });

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

    new cdktf.TerraformOutput(this, 'url', { value: api.apiEndpoint });
  }
}

async function synthFn() {
  const app = new cdktf.App();

  new HelloCdkStack(app, 'learn-cdktf-aws');

  app.synth();
}

async function start() {
  const project = new CdktfProject({ synthFn });

  await project.deploy()

  // await project.destroy()
}

start()

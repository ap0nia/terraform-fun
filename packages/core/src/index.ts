import cdktf from "cdktf";
import { sync } from 'glob'
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

    const staticBucket = new aws.s3Bucket.S3Bucket(this, "static-website", {
      bucket: `learn-cdktf-${name}-static-website`,
    })

    // Create S3 Bucket Policy to allow public access
    // new aws.s3BucketAcl.S3BucketAcl(this, 'bucketAcl', {
    //   bucket: staticBucket.id,
    //   acl: 'public-read'
    // });

    // S3 Bucket Policy to allow public read access
    // new aws.s3BucketPolicy.S3BucketPolicy(this, 'bucketPolicy', {
    //   bucket: staticBucket.id,
    //   policy: JSON.stringify({
    //     "Version": "2012-10-17",
    //     "Statement": [
    //       {
    //         "Sid": "PublicReadGetObject",
    //         "Effect": "Allow",
    //         "Principal": "*",
    //         "Action": [
    //           "s3:GetObject"
    //         ],
    //         "Resource": [
    //           "arn:aws:s3:::" + staticBucket.id + "/*"
    //         ]
    //       }
    //     ]
    //   })
    // });

    // const staticWebsiteAsset = new cdktf.TerraformAsset(this, "static-website-asset", {
    //   path: `${workspaceRoot}/packages/client/build`,
    //   type: cdktf.AssetType.ARCHIVE,
    // })

    sync(`${workspaceRoot}/packages/client/build/**/*`, { absolute: true, nodir: true })
      .forEach((source) => {
        const key = source.replace(`${workspaceRoot}/packages/client/build/`, '')

        new aws.s3BucketObject.S3BucketObject(this, `static-website-object-${key}`, {
          dependsOn: [staticBucket],
          key,
          bucket: staticBucket.bucket,
          source,
          ...source.endsWith('.html') && { contentType: 'text/html' },
          ...source.endsWith('.css') && { contentType: 'text/css' },
          ...source.endsWith('.js') && { contentType: 'application/javascript' },
        })
      })

    // Enable S3 Website
    new aws.s3BucketWebsiteConfiguration.S3BucketWebsiteConfiguration(this, 's3bucket', {
      bucket: staticBucket.id,
      indexDocument: {
        suffix: 'index.html',
      },
    });

    // Create Lambda executable
    const lambdaAsset = new cdktf.TerraformAsset(this, "lambda-asset", {
      path: `${workspaceRoot}/packages/server`,
      type: cdktf.AssetType.ARCHIVE,
    });

    // Create unique S3 bucket that hosts Lambda executable
    const lambdaBucket = new aws.s3Bucket.S3Bucket(this, "bucket", {
      bucketPrefix: `learn-cdktf-${name}`,
    });

    // Upload Lambda zip file to newly created S3 bucket
    const lambdaArchive = new aws.s3Object.S3Object(this, "lambda-archive", {
      bucket: lambdaBucket.bucket,
      key: `hello-cdktf-server.zip`,
      source: lambdaAsset.path,
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
      s3Bucket: lambdaBucket.bucket,
      s3Key: lambdaArchive.key,
      handler: 'dist/index.handler',
      runtime: 'nodejs18.x',
      role: role.arn,
    });

    // Create and configure API gateway
    const api = new aws.apigatewayv2Api.Apigatewayv2Api(this, "api-gw", {
      name: name,
      protocolType: "HTTP",
      target: lambdaFunc.arn,
      corsConfiguration: {
        allowOrigins: ["*"],
      },
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
  // const project = new CdktfProject({ synthFn });

  // await project.deploy()

  // await project.destroy()
}

start()

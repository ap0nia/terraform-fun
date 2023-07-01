import cdktf from "cdktf";
import aws from "@cdktf/provider-aws";
import { Construct } from "constructs";
import { TerraformAsset } from "../cdktf/asset.js";
import { getWorkspaceRoot } from '../utils/directories.js'
import { stateLockingDynamodbTable, stateBucket } from "./state.js";

const workspaceRoot = getWorkspaceRoot(process.cwd())

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

export class MainStack extends cdktf.TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new cdktf.S3Backend(this, {
      bucket: stateBucket,
      key: 'terraform.tfstate',
      region: process.env.AWS_REGION ?? 'us-east-1',
      dynamodbTable: stateLockingDynamodbTable,
    })

    new aws.provider.AwsProvider(this, "aws", {
      region: process.env.AWS_REGION ?? "us-east-1",
    });

    // Create Lambda executable
    const lambdaAsset = new TerraformAsset(this, "lambda-asset", {
      path: `${workspaceRoot}/packages/server/dist`,
      type: cdktf.AssetType.ARCHIVE,
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
      filename: lambdaAsset.path,
      handler: 'index.handler',
      runtime: 'nodejs18.x',
      role: role.arn,
      sourceCodeHash: lambdaAsset.assetHash,
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

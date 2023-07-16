import path from 'node:path'
import cdktf from "cdktf";
import type { Construct } from "constructs";
import aws from "@cdktf/provider-aws";
import { getProjectDirectory } from '../utils/directories.js'
import { fileTypesToContentTypes } from '../utils/fileTypes.js';
import { stateLockingDynamodbTable, stateBucket } from "./state.js";

const projectDirectory = path.join(getProjectDirectory(process.cwd()), '..', 'client')

const CACHING_OPTIMIZED_POLICY_ID = "658327ea-f89d-4fab-a63d-7e88639e58f6"

/**
 * This stack deploys a SvelteKit project to AWS.
 */
export class SvelteKitStack extends cdktf.TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    /**
     * Initialize AWS provider.
     */
    new aws.provider.AwsProvider(this, "aws", {
      region: process.env.AWS_REGION ?? "us-east-1",
    });

    /**
     * Store the state in a bucket.
     */
    new cdktf.S3Backend(this, {
      bucket: stateBucket,
      key: 'terraform.tfstate',
      region: process.env.AWS_REGION ?? 'us-east-1',
      dynamodbTable: stateLockingDynamodbTable,
    })

    /**
     * Create DynamoDB table for storing authentication credentials.
     */
    new aws.dynamodbTable.DynamodbTable(
      this,
      `${name}-authentication-dynamodb-table`,
      {
        name: "authentication",
        billingMode: "PAY_PER_REQUEST",
        attribute: [
          {
            name: 'id',
            type: 'S'
          }
        ],
        hashKey: 'id',
      }
    )

    /**
     * Create S3 bucket for storing static assets.
     */
    const staticAssetsBucket = new aws.s3Bucket.S3Bucket(
      this,
      `${name}-static-assets-bucket`,
      {
        bucket: `${name}-static-assets`,
        forceDestroy: true,
        objectLockEnabled: true,
      }
    )

    /**
     * Transfer the static assets to the S3 bucket.
     */
    const staticAssets = new cdktf.TerraformAsset(
      this,
      `${name}-static-assets-bucket-contents`,
      {
        path: path.join(projectDirectory, 'build', 's3'),
        type: cdktf.AssetType.DIRECTORY,
      }
    );

    const fileTypes = new cdktf.TerraformLocal(this, "file-types", fileTypesToContentTypes)

    const forEach = cdktf.TerraformIterator.fromList(cdktf.Fn.fileset(staticAssets.path, '**'))

    new aws.s3Object.S3Object(
      this,
      `${name}-static-assets-bucket-object`,
      {
        forEach,
        key: forEach.value,
        forceDestroy: true,
        bucket: staticAssetsBucket.bucket,
        source: `${staticAssets.path}/${forEach.value}`,
        etag: cdktf.Fn.filemd5(`${staticAssets.path}/${forEach.value}`),
        sourceHash: cdktf.Fn.filemd5(`${staticAssets.path}/${forEach.value}`),
        contentType: cdktf.Fn.lookup(
          fileTypes.fqn,
          cdktf.Fn.element(cdktf.Fn.regexall("\.[^\.]+$", forEach.value), 0),
          "application/octet-stream"
        ),
      }
    )

    /**
     * Enable versioning on the S3 bucket.
     */
    new aws.s3BucketVersioning.S3BucketVersioningA(
      this,
      `${name}-static-assets-bucket-versioning`,
      {
        bucket: staticAssetsBucket.id,
        versioningConfiguration: {
          status: 'Enabled',
        }
      }
    )

    /**
     * Create Lambda executable.
     */
    const lambdaAsset = new cdktf.TerraformAsset(
      this,
      `${name}-lambda-assets`,
      {
        path: path.join(projectDirectory, 'build', 'lambda'),
        type: cdktf.AssetType.ARCHIVE,
      }
    );

    const lambdaRoleDocument = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      `${name}-lambda-role-policy`,
      {
        version: "2012-10-17",
        statement: [
          {
            sid: "AllowLambdaToExecute",
            effect: "Allow",
            actions: [
              "sts:AssumeRole"
            ],
            principals: [
              {
                type: "Service",
                identifiers: [
                  "lambda.amazonaws.com",
                ]
              }
            ],
          }
        ]
      }
    )

    /**
     * Create Lambda role.
     */
    const role = new aws.iamRole.IamRole(
      this,
      `${name}-lambda-execution-role`,
      {
        assumeRolePolicy: lambdaRoleDocument.json,
      }
    );

    /**
     * Add execution role for Lambda to write to CloudWatch logs.
     */
    new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(
      this,
      `${name}-lambda-policy`,
      {
        role: role.name,
        policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      }
    );

    /**
     * Create Lambda SSR function.
     */
    const lambdaFunction = new aws.lambdaFunction.LambdaFunction(
      this,
      `${name}-lambda`,
      {
        functionName: `${name}-lambda`,
        filename: lambdaAsset.path,
        handler: 'index.handler',
        runtime: 'nodejs18.x',
        role: role.arn,
        sourceCodeHash: lambdaAsset.assetHash,
      }
    );

    /**
     * Bucket shouldn't be publicly viewable, so CloudFront needs to be able to access it with an OAI.
     */
    const s3OriginAccesIdentity = new aws.cloudfrontOriginAccessIdentity.CloudfrontOriginAccessIdentity(
      this,
      `${name}-s3-origin-access-identity`,
    )

    /**
     * Create CloudFront distribution for proxying to all resources.
     */
    const cloudfrontDistribution = new aws.cloudfrontDistribution.CloudfrontDistribution(
      this,
      `${name}-cloudfront-distribution`,
      {
        enabled: true,
        origin: [
          {
            originId: staticAssetsBucket.id,
            domainName: staticAssetsBucket.bucketRegionalDomainName,
            s3OriginConfig: {
              originAccessIdentity: s3OriginAccesIdentity.cloudfrontAccessIdentityPath,
            }
          },
        ],
        viewerCertificate: {
          cloudfrontDefaultCertificate: true,
        },
        restrictions: {
          geoRestriction: {
            restrictionType: 'none'
          },
        },
        defaultCacheBehavior: {
          allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
          cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
          targetOriginId: staticAssetsBucket.id,
          cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
          viewerProtocolPolicy: 'redirect-to-https',
        },
      },
    )

    const s3CloudFrontPolicy = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      `${name}-s3-bucket-policy-document`,
      {
        version: "2012-10-17",
        statement: [
          {
            sid: "AllowCloudFrontServicePrincipal",
            effect: "Allow",
            actions: [
              "s3:GetObject"
            ],
            principals: [
              {
                type: "AWS",
                identifiers: [
                  s3OriginAccesIdentity.iamArn
                ]
              }
            ],
            resources: [
              `${staticAssetsBucket.arn}/*`
            ],
          }
        ]
      }
    )

    /**
     * Attach the new policy to the bucket, allowing CloudFront to access it.
     */
    new aws.s3BucketPolicy.S3BucketPolicy(
      this,
      `${name}-s3-bucket-policy`,
      {
        bucket: staticAssetsBucket.id,
        policy: s3CloudFrontPolicy.json,
      }
    )

    const apiGateway = new aws.apigatewayv2Api.Apigatewayv2Api(
      this,
      `${name}-api-gateway`,
      {
        name: `${name}-api-gateway`,
        protocolType: 'HTTP'
      }
    )

    /**
     * CloudFront proxy to static assets.
     */
    const cloudFrontIntegration = new aws.apigatewayv2Integration.Apigatewayv2Integration(
      this,
      `${name}-api-gateway-integration-cloudfront`,
      {
        apiId: apiGateway.id,
        integrationMethod: 'ANY',
        integrationType: 'HTTP_PROXY',
        integrationUri: `https://${cloudfrontDistribution.domainName}/_app/{proxy}`,
      }
    )

    /**
     * Lambda SSR integration.
     */
    const lambdaIntegration = new aws.apigatewayv2Integration.Apigatewayv2Integration(
      this,
      `${name}-api-gateway-integration-root`,
      {
        apiId: apiGateway.id,
        integrationType: 'AWS_PROXY',
        integrationMethod: 'POST',
        integrationUri: lambdaFunction.invokeArn,
      }
    )

    /**
     * Allow API Gateway to invoke the SSR Lambda.
     */
    new aws.lambdaPermission.LambdaPermission(
      this,
      `${name}-lambda-permission`,
      {
        action: "lambda:InvokeFunction",
        functionName: `${name}-lambda`,
        principal: 'apigateway.amazonaws.com',
        sourceArn: `${apiGateway.executionArn}/*`,
      }
    )

    new aws.apigatewayv2Route.Apigatewayv2Route(
      this,
      `${name}-api-gateway-route-root`,
      {
        routeKey: '$default',
        apiId: apiGateway.id,
        target: `integrations/${lambdaIntegration.id}`,
      }
    )

    new aws.apigatewayv2Stage.Apigatewayv2Stage(
      this,
      `${name}-api-gateway-stage`,
      {
        apiId: apiGateway.id,
        name: '$default',
        autoDeploy: true,
      }
    )

    new aws.apigatewayv2Route.Apigatewayv2Route(
      this,
      `${name}-api-gateway-route-cloudfront`,
      {
        routeKey: 'GET /_app/{proxy+}',
        apiId: apiGateway.id,
        target: `integrations/${cloudFrontIntegration.id}`,
      }
    )

    new cdktf.TerraformOutput(
      this,
      `${name}-cloudfront-domain-name`,
      {
        value: apiGateway
      }
    )
  }
}

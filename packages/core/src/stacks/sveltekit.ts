import path from 'node:path'
import cdktf from "cdktf";
import { Construct } from "constructs";
import aws from "@cdktf/provider-aws";
import type {
  CloudfrontDistributionOrderedCacheBehavior
} from '@cdktf/provider-aws/lib/cloudfront-distribution/index.js';
import { TerraformAsset } from "../cdktf/asset.js";
import { getProjectDirectory } from '../utils/directories.js'
import { stateLockingDynamodbTable, stateBucket } from "./state.js";

const projectDirectory = path.join(getProjectDirectory(process.cwd()), '..', 'client')

const CACHING_DISABLED_POLICY_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
const CACHING_OPTIMIZED_POLICY_ID = "658327ea-f89d-4fab-a63d-7e88639e58f6"
const ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID = "b689b0a8-53d0-40ab-baf2-68738e2966ac"

const staticFileBehavior: CloudfrontDistributionOrderedCacheBehavior = {
  allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
  cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
  cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
  viewerProtocolPolicy: 'http-and-https',
  pathPattern: '~~placeholder~~',
  targetOriginId: '~~placeholder (S3 bucket)~~',
}

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
    const bucket = new aws.s3Bucket.S3Bucket(
      this,
      `${name}-static-assets-bucket`
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

    new aws.s3BucketObject.S3BucketObject(
      this,
      `${name}-static-assets-bucket-object`,
      {
        bucket: bucket.bucket,
        key: staticAssets.fileName,
        source: staticAssets.path,
      }
    )

    /**
     * Enable versioning on the S3 bucket.
     */
    new aws.s3BucketVersioning.S3BucketVersioningA(
      this,
      `${name}-static-assets-bucket-versioning`,
      {
        bucket: bucket.id,
        versioningConfiguration: {
          status: 'Enabled'
        }
      }
    )

    /**
     * Create Lambda executable.
     */
    const lambdaAsset = new TerraformAsset(
      this,
      `${name}-lambda-assets`,
      {
        path: path.join(projectDirectory, 'build', 'lambda'),
        type: cdktf.AssetType.ARCHIVE,
      }
    );

    /**
     * Create Lambda@Edge executable
     */
    const lambdaAtEdgeAsset = new TerraformAsset(
      this,
      `${name}-lambda@edge-assets`,
      {
        path: path.join(projectDirectory, 'build', 'lambda@edge'),
        type: cdktf.AssetType.ARCHIVE,
      }
    );

    /**
     * Gives both Lambda and Lambda@Edge permission to execute in either location.
     * Both Lambdas can execute on edge, but technically only Lambda@Edge needs to have this permission.
     */
    const lambdaRoleDocument = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      `${name}-lambda-role-policy`,
      {
        version: "2012-10-17",
        statement: [
          {
            sid: "",
            principals: [
              {
                type: "Service",
                identifiers: [
                  "edgelambda.amazonaws.com",
                  "lambda.amazonaws.com",
                ]
              }
            ],
            effect: "Allow",
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
        name: `lambda-server`,
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
        policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        role: role.name,
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
     * Create Lambda@Edge function.
     */
    const lambdaAtEdgeFunction = new aws.lambdaFunction.LambdaFunction(
      this,
      `${name}-lambda-at-edge`,
      {
        functionName: `${name}-lambda-at-edge`,
        filename: lambdaAtEdgeAsset.path,
        handler: 'index.handler',
        runtime: 'nodejs18.x',
        role: role.arn,
        sourceCodeHash: lambdaAtEdgeAsset.assetHash,
      }
    )

    /**
     * Bucket shouldn't be publicly viewable, so CloudFront needs to be able to access it with an OAI.
     */
    const s3OriginAccesIdentity = new aws.cloudfrontOriginAccessIdentity.CloudfrontOriginAccessIdentity(
      this,
      `${name}-s3-origin-access-identity`,
    )

    new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      `${name}-s3-bucket-policy-document`,
      {
        statement: [
          {
            sid: "1",
            principals: [
              { type: "AWS", identifiers: [s3OriginAccesIdentity.iamArn] }
            ],
            actions: ["s3:GetObject"]
          }
        ]
      }
    )

    new aws.s3BucketPolicy.S3BucketPolicy(
      this,
      `${name}-s3-bucket-policy`,
      {
        bucket: bucket.id,
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "Grant CloudFront access to S3 bucket",
              Effect: "Allow",
              Principal: {
                AWS: s3OriginAccesIdentity.cloudfrontAccessIdentityPath
              }
            }
          ]
        })
      }
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
            domainName: bucket.bucketRegionalDomainName,
            originId: bucket.id,
          },
          {
            domainName: lambdaFunction.invokeArn,
            originId: lambdaFunction.id,
          },
          {
            domainName: lambdaAtEdgeFunction.invokeArn,
            originId: lambdaAtEdgeFunction.id,
          }
        ],
        viewerCertificate: {},
        restrictions: {
          geoRestriction: {
            restrictionType: 'none'
          },
        },

        /**
         * Cache behavior for Lambda (lowest priority).
         */
        defaultCacheBehavior: {
          allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
          cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
          targetOriginId: bucket.id,
          cachePolicyId: CACHING_DISABLED_POLICY_ID,
          originRequestPolicyId: ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID,
          viewerProtocolPolicy: 'redirect-to-https',
          functionAssociation: [
            {
              eventType: 'viewer-request',
              functionArn: lambdaAtEdgeFunction.invokeArn
            },
          ]
        },

        /**
         * Cache behavior for all static files (higher priority).
         * TODO: map through all static files during build time and make a cache behavior for each.
         */
        orderedCacheBehavior: [
          {
            ...staticFileBehavior,
            pathPattern: '_app/*',
            targetOriginId: bucket.id,
          },
          {
            ...staticFileBehavior,
            pathPattern: 'favicon.png',
            targetOriginId: bucket.id,
          },
          {
            ...staticFileBehavior,
            pathPattern: 'robots.txt',
            targetOriginId: bucket.id,
          }
        ]
      },
    )

    new cdktf.TerraformOutput(
      this,
      `${name}-cloudfront-domain-name`,
      {
        value: cloudfrontDistribution.domainName,
      }
    )
  }
}

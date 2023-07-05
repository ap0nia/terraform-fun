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
  viewerProtocolPolicy: 'allow-all',
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
    const staticAssetsBucket = new aws.s3Bucket.S3Bucket(
      this,
      `${name}-static-assets-bucket`,
      {
        bucket: `${name}-static-assets`,
        forceDestroy: true,
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

    const forEach = cdktf.TerraformIterator.fromList(cdktf.Fn.fileset(staticAssets.path, '**'))

    new aws.s3BucketObject.S3BucketObject(
      this,
      `${name}-static-assets-bucket-object`,
      {
        forEach,
        bucket: staticAssetsBucket.bucket,
        key: forEach.value,
        source: `${staticAssets.path}/${forEach.value}`,
        etag: cdktf.Fn.filemd5(`${staticAssets.path}/${forEach.value}`)
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
            sid: "AllowLambdaToExecute",
            effect: "Allow",
            actions: [
              "sts:AssumeRole"
            ],
            principals: [
              {
                type: "Service",
                identifiers: [
                  "edgelambda.amazonaws.com",
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
        publish: true,

        /**
         * dev-intended strat: don't destroy ???
         * @link https://github.com/hashicorp/terraform-provider-aws/issues/1721
         * @link https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-delete-replicas.html
         */
        skipDestroy: true,
      }
    )

    /**
     * Bucket shouldn't be publicly viewable, so CloudFront needs to be able to access it with an OAI.
     */
    const s3OriginAccesIdentity = new aws.cloudfrontOriginAccessIdentity.CloudfrontOriginAccessIdentity(
      this,
      `${name}-s3-origin-access-identity`,
    )

    /**
     * Create a function URL that can be used as an origin for CloudFront.
     *
     * {@link aws.lambdaFunctionUrl.LambdaFunctionUrl.functionUrl} is in the format:
     *
     * https://kcj2z34dbvosxjidwdh6i5zane0ckjvx.lambda-url.us-east-1.on.aws
     *
     * Need to get only domain name:
     *
     * kcj2z34dbvosxjidwdh6i5zane0ckjvx.lambda-url.us-east-1.on.aws
     *
     * @link https://github.com/aws/aws-cdk/issues/20090
     */
    const lambdaFunctionUrl = new aws.lambdaFunctionUrl.LambdaFunctionUrl(
      this,
      `${name}-lambda-function-url`,
      {
        functionName: lambdaFunction.functionName,
        authorizationType: 'NONE',
      }
    )

    const splitFunctionUrl = cdktf.Fn.split('/', lambdaFunctionUrl.functionUrl)

    const functionUrlDomainName = cdktf.Fn.element(splitFunctionUrl, 2)

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
          {
            originId: lambdaFunction.id,
            domainName: functionUrlDomainName,
            customOriginConfig: {
              httpPort: 80,
              httpsPort: 443,
              originProtocolPolicy: 'https-only',
              originSslProtocols: ['TLSv1.2'],
            },
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

        /**
         * Cache behavior for Lambda (lowest priority).
         */
        defaultCacheBehavior: {
          allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
          cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
          targetOriginId: lambdaFunction.id,
          cachePolicyId: CACHING_DISABLED_POLICY_ID,
          originRequestPolicyId: ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID,
          viewerProtocolPolicy: 'redirect-to-https',
          lambdaFunctionAssociation: [
            {
              eventType: 'viewer-request',
              lambdaArn: lambdaAtEdgeFunction.qualifiedArn,
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
            targetOriginId: staticAssetsBucket.id,
          },
          {
            ...staticFileBehavior,
            pathPattern: 'favicon.png',
            targetOriginId: staticAssetsBucket.id,
          },
          {
            ...staticFileBehavior,
            pathPattern: 'robots.txt',
            targetOriginId: staticAssetsBucket.id,
          }
        ]
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


    new cdktf.TerraformOutput(
      this,
      `${name}-cloudfront-domain-name`,
      {
        value: cloudfrontDistribution.domainName,
      }
    )
  }
}

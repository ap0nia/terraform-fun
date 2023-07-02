import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import aws from "@cdktf/provider-aws";

export const stateBucket = 'cdktf-s3-backend-elysia'

export const stateLockingDynamodbTable = 'cdktf-state-locking-backend-elysia'

/**
 * Needs to exist first.
 */
export class StateStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new aws.provider.AwsProvider(this, "aws", {
      region: process.env.AWS_REGION ?? "us-east-1",
    });

    new aws.s3Bucket.S3Bucket(this, 'Terraform S3 backend', {
      bucket: stateBucket,
    });

    new aws.s3BucketVersioning.S3BucketVersioningA(this, 'Terraform S3 backend versioning', {
      bucket: stateBucket,
      versioningConfiguration: {
        status: 'Enabled'
      }
    })

    new aws.dynamodbTable.DynamodbTable(this, 'Terraform DynamoDB State Locking', {
      name: stateLockingDynamodbTable,
      billingMode: 'PAY_PER_REQUEST',
      attribute: [
        {
          name: 'LockID',
          type: 'S'
        }
      ],
      hashKey: 'LockID',
    })
  }
}

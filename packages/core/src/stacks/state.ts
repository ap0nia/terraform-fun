import cdk from 'aws-cdk-lib'
import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import { provider } from "@cdktf/aws-cdk";

export const stateBucket = 'cdktf-s3-backend-elysia'

export const stateLockingDynamodbTable = 'cdktf-state-locking-backend-elysia'

/**
 * Needs to exist first.
 */
export class StateStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    new cdk.aws_s3.Bucket(this, 'Terraform S3 backend', { bucketName: stateBucket, versioned: true });

    new cdk.aws_dynamodb.Table(this, 'Terraform DynamoDB State Locking', {
      tableName: stateLockingDynamodbTable,
      partitionKey: {
        name: 'LockID',
        type: cdk.aws_dynamodb.AttributeType.STRING
      }
    })
  }
}

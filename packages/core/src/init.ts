import cdk from 'aws-cdk-lib'
import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import { AwsTerraformAdapter, provider } from "@cdktf/aws-cdk";

const bucketName = 'cdktf-state'

/**
 * Needs to exist first.
 */
export class CdktfStateStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new provider.AwsProvider(this, 'aws', { region: 'us-east-1' })

    const awsAdapter = new AwsTerraformAdapter(this, "adapter");

    new cdk.aws_s3.Bucket(awsAdapter, 'MyFirstBucket', { bucketName, versioned: true });
  }
}

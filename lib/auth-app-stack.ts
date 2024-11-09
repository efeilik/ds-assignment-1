import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApi } from './auth-api'
import {AppApi } from './app-api'
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import { generateBatch } from "../shared/utils";
import { players, playerStats } from "../seed/PlayerStats";
export class AuthAppStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Tables
    const playersTable = new dynamodb.Table(this, "PlayersTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "playerId", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Players",
    });
    const playerStatsTable = new dynamodb.Table(this, "PlayerStatsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "playerId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "seasonYear", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "PlayerStats",
    });
    new custom.AwsCustomResource(this, "playersAndStatsDdbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [playersTable.tableName]: generateBatch(players),
            [playerStatsTable.tableName]: generateBatch(playerStats),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("playersAndStatsDdbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [playersTable.tableArn, playerStatsTable.tableArn],
      }),
    });

    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    const userPoolClientId = appClient.userPoolClientId;

    new AuthApi(this, 'AuthServiceApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
      
    });

    new AppApi(this, 'AppApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
      playersTable: playersTable,
      playerStatsTable: playerStatsTable
    } );

  } 

}
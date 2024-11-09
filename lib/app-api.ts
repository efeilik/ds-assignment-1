import { Aws } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";

type AppApiProps = {
    userPoolId: string;
    userPoolClientId: string;
    playersTable: dynamodb.Table;
    playerStatsTable: dynamodb.Table;
    translatedStatsTable: dynamodb.Table;
};

export class AppApi extends Construct {
    constructor(scope: Construct, id: string, props: AppApiProps) {
        super(scope, id);

        const appApi = new apig.RestApi(this, "AppApi", {
            description: "App RestApi",
            endpointTypes: [apig.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                allowOrigins: apig.Cors.ALL_ORIGINS,
            },
        });

        const appCommonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: "handler",
            environment: {
                USER_POOL_ID: props.userPoolId,
                CLIENT_ID: props.userPoolClientId,
                REGION: cdk.Aws.REGION,
                PLAYERS_TABLE: props.playersTable.tableName,
                PLAYER_STATS_TABLE: props.playerStatsTable.tableName,
            },
        };

        //Functions
        const getAllStatsFn = new lambdanode.NodejsFunction(
            this,
            "GetAllStatsFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_18_X,
                entry: `${__dirname}/../lambda/app/getAllStats.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: props.playerStatsTable.tableName,
                    REGION: 'eu-west-1',
                },
            }
        );

        const getStatByIdFn = new lambdanode.NodejsFunction(
            this,
            "GetStatByIdFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_18_X,
                entry: `${__dirname}/../lambda/app/getStatById.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    PLAYER_STATS_TABLE: props.playerStatsTable.tableName,
                    REGION: 'eu-west-1',
                },
            }
        );

        const translateItemFn = new lambdanode.NodejsFunction(this, "TranslateItemFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambda/app/getStatTranslated.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                PLAYER_STATS_TABLE: props.playerStatsTable.tableName,
                TRANSLATED_STATS_TABLE: props.translatedStatsTable.tableName,
                REGION: 'eu-west-1',
            },
        });

        //Permissions
        props.playerStatsTable.grantReadData(getAllStatsFn);
        props.playerStatsTable.grantReadData(getStatByIdFn);
        props.playerStatsTable.grantReadData(translateItemFn);
        props.translatedStatsTable.grantReadWriteData(translateItemFn);
        translateItemFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["translate:TranslateText"],
            resources: ["*"],
        }));
        const protectedRes = appApi.root.addResource("protected");
        const publicRes = appApi.root.addResource("public");
        const statsRes = appApi.root.addResource("stats");
        const playerIdRes = statsRes.addResource("{playerId}");
        const seasonYearRes = playerIdRes.addResource("{seasonYear}");
        const translationRes = seasonYearRes.addResource("translation");

        const protectedFn = new node.NodejsFunction(this, "ProtectedFn", {
            ...appCommonFnProps,
            entry: "./lambda/protected.ts",
        });

        const publicFn = new node.NodejsFunction(this, "PublicFn", {
            ...appCommonFnProps,
            entry: "./lambda/public.ts",
        });

        const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
            ...appCommonFnProps,
            entry: "./lambda/auth/authorizer.ts",
        });

        const requestAuthorizer = new apig.RequestAuthorizer(
            this,
            "RequestAuthorizer",
            {
                identitySources: [apig.IdentitySource.header("cookie")],
                handler: authorizerFn,
                resultsCacheTtl: cdk.Duration.minutes(0),
            }
        );

        protectedRes.addMethod("GET", new apig.LambdaIntegration(protectedFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });

        publicRes.addMethod("GET", new apig.LambdaIntegration(publicFn));

        playerIdRes.addMethod("GET", new apig.LambdaIntegration(getStatByIdFn));

        translationRes.addMethod("GET", new apig.LambdaIntegration(translateItemFn));
    }
}
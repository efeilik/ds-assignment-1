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
                TRANSLATED_STATS_TABLE: props.translatedStatsTable.tableName,
            },
        };

        //Functions
        const getAllStatsFn = new lambdanode.NodejsFunction(this, "GetAllStatsFn",{
            ...appCommonFnProps,
            entry: `${__dirname}/../lambda/app/getAllStats.ts`,
            }
        );

        const getStatByIdFn = new lambdanode.NodejsFunction(this, "GetStatByIdFn",{
            ...appCommonFnProps,
            entry: `${__dirname}/../lambda/app/getStatById.ts`,
            }
        );

        const translateItemFn = new lambdanode.NodejsFunction(this, "TranslateItemFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambda/app/getStatTranslated.ts`,
        });

        const addPlayerStatsFn = new node.NodejsFunction(this, "addPlayerStatsFn", {
            ...appCommonFnProps,
            entry: "./lambda/app/addPlayerStats.ts",
        });

        const updatePlayerStatsFn = new node.NodejsFunction(this, "updatePlayerStatsFn", {
            ...appCommonFnProps,
            entry: "./lambda/app/updatePlayerStats.ts",
        });

        //Permissions
        props.playerStatsTable.grantReadWriteData(addPlayerStatsFn);
        props.playerStatsTable.grantReadWriteData(updatePlayerStatsFn);
        props.playerStatsTable.grantReadData(getAllStatsFn);
        props.playerStatsTable.grantReadData(getStatByIdFn);
        props.playerStatsTable.grantReadData(translateItemFn);
        props.translatedStatsTable.grantReadWriteData(translateItemFn);
        translateItemFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["translate:TranslateText"],
            resources: ["*"],
        }));

        //REST API
        const statsRes = appApi.root.addResource("stats");
        const playerIdRes = statsRes.addResource("{playerId}");
        const seasonYearRes = playerIdRes.addResource("{seasonYear}");
        const translationRes = seasonYearRes.addResource("translation");

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

        statsRes.addMethod("POST", new apig.LambdaIntegration(addPlayerStatsFn, { proxy: true }), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });
        statsRes.addMethod("GET", new apig.LambdaIntegration(getAllStatsFn));
        playerIdRes.addMethod("PUT", new apig.LambdaIntegration(updatePlayerStatsFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });

        playerIdRes.addMethod("GET", new apig.LambdaIntegration(getStatByIdFn));

        translationRes.addMethod("GET", new apig.LambdaIntegration(translateItemFn));
    }
}
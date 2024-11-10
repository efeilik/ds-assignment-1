import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
    CookieMap,
    createPolicy,
    JwtToken,
    parseCookies,
    verifyToken,
} from "../utils";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// import Ajv from "ajv";
// import schema from "../../shared/types.schema.json";

// const ajv = new Ajv();
// const isValidBodyParams = ajv.compile(schema.definitions["UpdatePlayerStats"] || {});
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));
    
        const parameters = event?.pathParameters;
        const playerId = parameters?.playerId ? parseInt(parameters?.playerId) : undefined;
        const seasonYear = event.queryStringParameters?.seasonYear;
        if (!playerId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing playerId in path" }),
            };
        }
        const cookies: CookieMap = parseCookies(event);
        if (!cookies) {
            return {
                statusCode: 401,
                body: "Unauthorized request!",
            };
        }
        const verifiedJwt = await verifyToken(
            cookies.token,
            process.env.USER_POOL_ID,
            process.env.REGION!
        );
        if (!verifiedJwt) {
            return {
                statusCode: 401,
                body: "Unauthorized request!",
            };
        }

        const body = event.body ? JSON.parse(event.body) : undefined;
        if (!body) {
            return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Missing request body" }),
            };
        }
        //   if (!isValidBodyParams(body)) {
        //     return {
        //       statusCode: 500,
        //       headers: {
        //         "content-type": "application/json",
        //       },
        //       body: JSON.stringify({
        //         message: `Incorrect type. Must match PlayerStats schema`,
        //         schema: schema.definitions["UpdatePlayerStats"],
        //       }),
        //     };
        //   }

        const userId = verifiedJwt.sub;

        const getPlayerStatCommand = new GetCommand({
            TableName: process.env.PLAYER_STATS_TABLE,
            Key: { playerId: playerId, seasonYear: seasonYear },
        });

        const playerStat = await ddbDocClient.send(getPlayerStatCommand);

        if (!playerStat.Item || playerStat.Item.userId !== userId) {
            return {
                statusCode: 403,
                body: "You are not authorized to update this playerStat.",
            };
        }

        const updateCommand = new UpdateCommand({
            TableName: process.env.PLAYER_STATS_TABLE,
            Key: { playerId: playerId, seasonYear: seasonYear },
            UpdateExpression: "SET #goalsScored = :goalsScored, #assists = :assists, #appearances = :appearances",
            ExpressionAttributeNames: {
                "#goalsScored": "goalsScored",
                "#assists": "assists",
                "#appearances": "appearances",
            },
            ExpressionAttributeValues: {
                ":goalsScored": body.goalsScored,
                ":assists": body.assists,
                ":appearances": body.appearances,
            },
        });

        await ddbDocClient.send(updateCommand);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "PlayerStat updated successfully." }),
    };
    } catch(error: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({error}),
        };
    }
    
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
      wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
  }

import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));

        const parameters = event?.pathParameters;
        const playerId = parameters?.playerId ? parseInt(parameters?.playerId) : undefined;

        const queryParams = event.queryStringParameters;
        const team = queryParams?.team;

        if (!playerId) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Missing playerId" }),
            };
        }

        let commandInput: QueryCommandInput = {
            TableName: process.env.PLAYER_STATS_TABLE,
            KeyConditionExpression: "playerId = :p",
            ExpressionAttributeValues: {
                ":p": playerId,
            },
        };

        if (team) {
            commandInput.FilterExpression = "team = :team";
            commandInput.ExpressionAttributeValues = {
                ...commandInput.ExpressionAttributeValues,
                ":team": team,
            };
        }

        const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));

        console.log("QueryCommand response:", commandOutput);

        if (!commandOutput.Items || commandOutput.Items.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "No stats found" }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ data: commandOutput.Items }),
        };
    } catch (error: any) {
        console.log("Error:", error);
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error: error.message || error }),
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

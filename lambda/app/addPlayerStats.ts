import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  CookieMap,
  createPolicy,
  JwtToken,
  parseCookies,
  verifyToken,
} from "../utils";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import Ajv from "ajv";
import schema from "../../shared/types.schema.json";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["PlayerStats"] || {});
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async function (event: any) {
  console.log("[EVENT]", JSON.stringify(event));

  const cookies: CookieMap = parseCookies(event);
  if (!cookies) {
    return {
      statusCode: 401,
      body: "Unauthorised request!!",
    };
  }

  const verifiedJwt: JwtToken = await verifyToken(
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

  console.log(JSON.stringify(verifiedJwt));
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
  if (!isValidBodyParams(body)) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: `Incorrect type. Must match PlayerStats schema`,
        schema: schema.definitions["PlayerStats"],
      }),
    };
  }

  body.userId = verifiedJwt.sub;
  const commandOutput = await ddbDocClient.send(
    new PutCommand({
      TableName: process.env.PLAYER_STATS_TABLE,
      Item: body,
    })
  );
  return {
    statusCode: 201,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: "PlayerStat added" }),
  };

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
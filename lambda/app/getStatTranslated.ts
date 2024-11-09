import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { playerId, seasonYear } = event.pathParameters || {};
  const { language } = event.queryStringParameters || {};
  const playerIdNumber = playerId ? parseInt(playerId) : null;
  if (!playerId || !seasonYear || !language) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing playerId, seasonYear, or language parameter" }),
    };
  }

  try {
    const getItemCommand = new GetCommand({
      TableName: process.env.PLAYER_STATS_TABLE,
      Key: { playerId: playerIdNumber, seasonYear },
    });

    const { Item } = await ddbDocClient.send(getItemCommand);
    if (!Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Item not found" }),
      };
    }

    const translatedItemKey = `${playerId}_${seasonYear}`;
    const getTranslatedCommand = new GetCommand({
      TableName: process.env.TRANSLATED_STATS_TABLE,
      Key: { playerIdSeasonYear: translatedItemKey, language: language },
    });

    const { Item: translatedItem } = await ddbDocClient.send(getTranslatedCommand);

    if (translatedItem) {
      return {
        statusCode: 200,
        body: JSON.stringify({ data: translatedItem }),
      };
    }

    const translatedAttributes = await translateTextAttributes(Item, language);

    const putCommand = new PutCommand({
        TableName: process.env.TRANSLATED_STATS_TABLE,
        Item: {
          playerIdSeasonYear: translatedItemKey,
          language,
          translatedAttributes,
        },
      });

    await ddbDocClient.send(putCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ data: translatedAttributes }),
    };
  } catch (error) {
    console.error("Error translating item:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

async function translateTextAttributes(item: any, language: string) {
  const translatedItem: any = { ...item };
  const textAttributes = ["position", "description"];

  for (const attr of textAttributes) {
    if (item[attr]) {
      const translatedText = await translateText(item[attr], language);
      translatedItem[attr] = translatedText;
    }
  }

  return translatedItem;
}

async function translateText(text: string, language: string) {
  const translateCommand = new TranslateTextCommand({
    Text: text,
    SourceLanguageCode: "en",
    TargetLanguageCode: language,
  });

  const { TranslatedText } = await translateClient.send(translateCommand);
  return TranslatedText;
}

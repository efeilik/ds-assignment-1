import { marshall } from "@aws-sdk/util-dynamodb";
import { PlayerStats, Player } from "./types";

type Entity = PlayerStats | Player;

export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
  });
};

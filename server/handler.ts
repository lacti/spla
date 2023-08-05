import { APIGatewayEvent } from "aws-lambda";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import redisConnect from "@yingyeothon/naive-redis/lib/connection";
import redisSadd from "@yingyeothon/naive-redis/lib/sadd";
import redisSmembers from "@yingyeothon/naive-redis/lib/smembers";
import redisSrem from "@yingyeothon/naive-redis/lib/srem";

const connection = redisConnect({
  host: process.env.REDIS_HOST!,
  port: +(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD!,
});
const connectionsKey = "spla:connections";

export const handleConnect = async (event: APIGatewayEvent) => {
  const connectionId = event.requestContext.connectionId!;
  try {
    await redisSadd(connection, connectionsKey, connectionId);
  } catch (error) {
    console.error({ error });
  }
  return { statusCode: 200 };
};

export const handleDisconnect = async (event: APIGatewayEvent) => {
  const connectionId = event.requestContext.connectionId!;
  await redisSrem(connection, connectionsKey, connectionId);
  return { statusCode: 200 };
};

export const handleMessage = async (event: APIGatewayEvent) => {
  const body = event.body;
  if (!body) {
    return { statusCode: 200 };
  }
  const managementApi = new ApiGatewayManagementApi({
    endpoint: process.env.IS_OFFLINE
      ? "http://localhost:3001"
      : `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  });
  const connectionIds = await redisSmembers(connection, connectionsKey);

  try {
    const json = JSON.parse(body);
    if (json._type === "hello") {
      const leaderId = [...connectionIds].sort((a, b) => a.localeCompare(b))[0];
      if (leaderId) {
        await Promise.all(
          connectionIds.map((connectionId) =>
            managementApi.postToConnection({
              ConnectionId: connectionId,
              Data: JSON.stringify({
                _type: "join",
                leader: connectionId === leaderId,
              }),
            })
          )
        );
      }
    }
  } catch (error) {
    console.error({ error }, "error to handle join");
  }

  await Promise.all(
    connectionIds.map((connectionId) =>
      managementApi.postToConnection({
        ConnectionId: connectionId,
        Data: body,
      })
    )
  );
  return { statusCode: 200 };
};

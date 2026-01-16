import redis from "redis";
import dotenv from "dotenv";
dotenv.config();

export const redisClient = redis.createClient({
  url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.connect().then(() => console.log("Redis connected"));

import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

import loadCommands from "./handlers/commandHandler.js";
import loadEvents from "./handlers/eventHandler.js";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

loadCommands(client);
loadEvents(client);

client.login(process.env.TOKEN);

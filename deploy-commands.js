import { REST, Routes } from "discord.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const commands = [];
const commandFiles = fs.readdirSync("./src/commands");

for (const file of commandFiles) {
  const command = (await import(`./src/commands/${file}`)).default;
  commands.push(command.data);
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
  body: commands,
});

console.log("Commands deployed!");

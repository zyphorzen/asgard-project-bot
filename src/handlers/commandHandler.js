import fs from "fs";
import path from "path";

export default (client) => {
  client.commands = new Map();

  const commandFiles = fs.readdirSync("./src/commands");

  for (const file of commandFiles) {
    const filePath = path.resolve(`./src/commands/${file}`);
    import(filePath).then((command) => {
      client.commands.set(command.default.data.name, command.default);
    });
  }
};

import fs from "fs";
import path from "path";

export default (client) => {
  const eventFiles = fs.readdirSync("./src/events");

  for (const file of eventFiles) {
    const filePath = path.resolve(`./src/events/${file}`);

    import(filePath).then((event) => {
      if (event.default.once) {
        client.once(event.default.name, (...args) =>
          event.default.execute(...args, client),
        );
      } else {
        client.on(event.default.name, (...args) =>
          event.default.execute(...args, client),
        );
      }
    });
  }
};

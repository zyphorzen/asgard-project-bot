export default {
  name: "clientReady",
  once: true,
  execute(client) {
    console.log(`Login sebagai ${client.user.tag}`);
  },
};

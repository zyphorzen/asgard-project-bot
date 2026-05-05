export default {
  data: {
    name: "ping",
    description: "Cek bot",
  },
  async execute(interaction) {
    await interaction.reply("PONG 🏓");
  },
};

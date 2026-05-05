import Tesseract from "tesseract.js";
import alliances from "../config/alliances.js";
import LANG_MAP from "../config/langMap.js";
import { EmbedBuilder } from "discord.js";

const cooldown = new Map();

async function sendDM(user, content) {
  try {
    await user.send(content);
    return true;
  } catch {
    return false;
  }
}

function normalizeToAscii(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/ø/gi, "o")
    .replace(/ß/gi, "ss")
    .toLowerCase();
}

function extractLargeNumbers(rawText) {
  const formatted = [...rawText.matchAll(/[\d]{1,3}(?:[.,][\d]{3})+/g)]
    .map((m) => parseInt(m[0].replace(/[.,]/g, ""), 10))
    .filter((n) => n > 10000);

  const plain = [...rawText.matchAll(/\b\d{6,}\b/g)]
    .map((m) => parseInt(m[0], 10))
    .filter((n) => n > 10000);

  return [...new Set([...formatted, ...plain])].sort((a, b) => b - a);
}

function validateRoKProfile(rawText) {
  const lower = rawText.toLowerCase();
  const lowerAscii = normalizeToAscii(rawText);

  const checkLabels = (labels) =>
    labels.some(
      (l) =>
        lower.includes(l.toLowerCase()) ||
        lowerAscii.includes(normalizeToAscii(l)),
    );

  const hasGovernorLabel = checkLabels(LANG_MAP.governor);
  const hasPowerLabel = checkLabels(LANG_MAP.power);
  const hasAllianceLabel = checkLabels(LANG_MAP.alliance);
  const allKeywords = alliances.flatMap((a) => a.keywords);
  const hasAllianceKeyword = allKeywords.some((k) => lower.includes(k));
  const largeNums = extractLargeNumbers(rawText);
  const hasPowerNumber = largeNums.some((n) => n > 50000);
  const hasIdPattern =
    /id[:\s#(]*\d{5,}/.test(lower) ||
    /\(\s*id\s*:\s*\d{5,}\s*\)/.test(lower) ||
    /\b\d{8,9}\b/.test(rawText);
  const hasAllianceName = alliances.some((a) =>
    lower.includes(a.name.toLowerCase()),
  );

  const signals = [
    hasGovernorLabel || hasAllianceLabel || hasPowerLabel,
    hasAllianceKeyword,
    hasPowerNumber,
    hasIdPattern,
    hasAllianceName,
  ];

  const score = signals.filter(Boolean).length;

  return {
    valid: score >= 2,
    score,
    maxScore: signals.length,
    details: {
      langLabel: hasGovernorLabel || hasAllianceLabel || hasPowerLabel,
      allianceKeyword: hasAllianceKeyword,
      powerNumber: hasPowerNumber,
      idPattern: hasIdPattern,
      allianceName: hasAllianceName,
    },
  };
}

function extractPower(rawText) {
  const lines = rawText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineAscii = normalizeToAscii(lines[i]);
    if (LANG_MAP.power.some((l) => lineAscii.includes(normalizeToAscii(l)))) {
      const combined = lines[i] + " " + (lines[i + 1] ?? "");
      const match = combined.match(/[\d.,]{3,}/g);
      if (match) {
        const num = parseInt(match[0].replace(/[.,]/g, ""), 10);
        if (!isNaN(num) && num > 1000) return num;
      }
    }
  }

  const nums = extractLargeNumbers(rawText);
  return nums[0] ?? null;
}

function formatNumber(n) {
  if (!n) return "?";
  return n.toLocaleString("id-ID");
}

function detectAlliance(rawText) {
  const lower = rawText.toLowerCase();
  for (const alliance of alliances) {
    if (alliance.keywords.some((k) => lower.includes(k))) {
      return alliance;
    }
  }
  return null;
}

export default {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (!message.channel.name.includes("〡✅〡verification")) return;
    if (message.attachments.size === 0) return;

    if (message.attachments.size > 1) {
      const ok = await sendDM(
        message.author,
        "Please send only **1 image** at a time 😅",
      );
      if (!ok)
        await message.reply({
          content: "Please send only 1 image.",
          allowedMentions: { repliedUser: false },
        });
      return;
    }

    const attachment = message.attachments.first();

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (
      attachment.contentType &&
      !validTypes.includes(attachment.contentType)
    ) {
      const ok = await sendDM(
        message.author,
        "That doesn't look like an image 🤔 Please send a screenshot directly (PNG/JPG).",
      );
      if (!ok)
        await message.reply({
          content: "Please send an image file (PNG/JPG).",
          allowedMentions: { repliedUser: false },
        });
      return;
    }

    const userId = message.author.id;
    const now = Date.now();
    const cooldownTime = 30000;

    if (cooldown.has(userId)) {
      const expiration = cooldown.get(userId) + cooldownTime;
      if (now < expiration) {
        const timeLeft = ((expiration - now) / 1000).toFixed(1);
        const ok = await sendDM(
          message.author,
          `Please wait **${timeLeft} seconds** before uploading again ⏳`,
        );
        if (!ok)
          await message.reply({
            content: `Please wait ${timeLeft}s before trying again.`,
            allowedMentions: { repliedUser: false },
          });
        return;
      }
    }

    cooldown.set(userId, now);

    const pingDM = await sendDM(
      message.author,
      "Checking your screenshot... 🔍 This won't take long.",
    );
    if (!pingDM) await message.react("🔍").catch(() => {});

    try {
      const result = await Tesseract.recognize(
        attachment.url,
        "eng+ind+vie+chi_sim+chi_tra+kor+jpn+ara+tha+rus",
        { logger: () => {} },
      );

      const rawText = result.data.text;
      console.log("[OCR Raw]\n", rawText);

      const validation = validateRoKProfile(rawText);

      if (!validation.valid) {
        const ok = await sendDM(
          message.author,
          `❌ **Invalid image.**\n\nThe image you sent doesn't appear to be a valid RoK Governor Profile, or the quality is too low to read.\n\n**Tips to pass verification:**\n• Take a screenshot directly in-game\n• Make sure the full **Governor Profile** is visible\n• Do not crop, edit, or add filters\n• Your Alliance tag must be clearly visible\n\nIf you believe this is a mistake, please contact an admin 🙏`,
        );
        if (!ok)
          await message.reply({
            content: "❌ Invalid image.",
            allowedMentions: { repliedUser: false },
          });

        const logCh = message.guild.channels.cache.find(
          (c) => c.name === "bot-log",
        );
        if (logCh) {
          logCh.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("⚠️ INVALID IMAGE")
                .setDescription(
                  `User: ${message.author.tag} (${message.author.id})`,
                )
                .addFields(
                  {
                    name: "Score",
                    value: `${validation.score}/${validation.maxScore}`,
                    inline: true,
                  },
                  {
                    name: "Lang Label",
                    value: String(validation.details.langLabel),
                    inline: true,
                  },
                  {
                    name: "Alliance Keyword",
                    value: String(validation.details.allianceKeyword),
                    inline: true,
                  },
                  {
                    name: "Power Number",
                    value: String(validation.details.powerNumber),
                    inline: true,
                  },
                  {
                    name: "ID Pattern",
                    value: String(validation.details.idPattern),
                    inline: true,
                  },
                  {
                    name: "Alliance Name",
                    value: String(validation.details.allianceName),
                    inline: true,
                  },
                )
                .setTimestamp()
                .setFooter({ text: "ASGARD VERIFY SYSTEM" }),
            ],
          });
        }
        return;
      }

      const powerValue = extractPower(rawText);
      const matchedAlliance = detectAlliance(rawText);

      const member = message.member;

      const allianceRoleNames = alliances.map((a) => a.roleName);
      const rolesToRemove = member.roles.cache.filter((r) =>
        allianceRoleNames.includes(r.name),
      );
      if (rolesToRemove.size > 0) await member.roles.remove(rolesToRemove);

      const logChannel = message.guild.channels.cache.find(
        (c) => c.name === "bot-log",
      );
      const embed = new EmbedBuilder()
        .setTimestamp()
        .setFooter({ text: "ASGARD VERIFY SYSTEM" });

      if (matchedAlliance) {
        const role = message.guild.roles.cache.find(
          (r) => r.name === matchedAlliance.roleName,
        );

        if (!role) {
          await sendDM(
            message.author,
            "Something went wrong — the role couldn't be found on this server. Please contact an admin 🙏",
          );
          return;
        }
        if (role.position >= message.guild.members.me.roles.highest.position) {
          await sendDM(
            message.author,
            "The role is too high for me to assign. Please contact an admin 🙏",
          );
          return;
        }

        const memberRole = message.guild.roles.cache.find(
          (r) => r.name === "Member",
        );
        if (memberRole) {
          if (
            memberRole.position <
            message.guild.members.me.roles.highest.position
          ) {
            await member.roles.add(memberRole);
          } else {
            console.warn("[Verify] Role 'Member' is too high to assign.");
          }
        } else {
          console.warn("[Verify] Role 'Member' not found in server.");
        }

        await member.roles.add(role);

        const ok = await sendDM(
          message.author,
          `✅ **Verification successful!**\n\nYou've been confirmed as a member of **${matchedAlliance.name}**.\n\n🎭 **Roles assigned:**\n• **Member**\n• **${matchedAlliance.roleName}**\n\nWelcome to the server! Feel free to ask an admin if you have any questions 🎉`,
        );
        if (!ok) {
          await message.reply({
            content: `✅ Verified as **${matchedAlliance.name}**! Roles assigned: **Member** + **${matchedAlliance.roleName}**. Enable DMs for full details.`,
            allowedMentions: { repliedUser: false },
          });
        }

        embed
          .setColor(0x57f287)
          .setTitle("✅ VERIFICATION SUCCESS")
          .setDescription(`User: ${member.user.tag} (${member.user.id})`)
          .addFields(
            { name: "Alliance", value: matchedAlliance.name, inline: true },
            {
              name: "Roles Assigned",
              value: `Member + ${role.name}`,
              inline: true,
            },
            {
              name: "Power",
              value: powerValue ? formatNumber(powerValue) : "?",
              inline: true,
            },
            {
              name: "Scan Score",
              value: `${validation.score}/${validation.maxScore}`,
              inline: true,
            },
          );
      } else {
        const guestRole = message.guild.roles.cache.find(
          (r) => r.name === "Guest",
        );
        if (guestRole) await member.roles.add(guestRole);

        const ok = await sendDM(
          message.author,
          `❌ **Verification failed.**\n\nThe alliance detected in your screenshot doesn't match any registered alliance on this server.\n\n🎭 **Role assigned:** Guest\n\n**Possible reasons:**\n• You're not a member of HoA / HoG / HoC\n• The alliance tag is cut off or not visible\n• Image is blurry or low quality\n\nTry sending a clearer screenshot, or contact an admin if you think this is wrong.`,
        );
        if (!ok) {
          await message.reply({
            content:
              "❌ Alliance not recognized → **Guest**. Enable DMs for full details.",
            allowedMentions: { repliedUser: false },
          });
        }

        embed
          .setColor(0xed4245)
          .setTitle("❌ VERIFICATION FAILED")
          .setDescription(`User: ${member.user.tag} (${member.user.id})`)
          .addFields(
            { name: "Role Assigned", value: "Guest", inline: true },
            {
              name: "Power",
              value: powerValue ? formatNumber(powerValue) : "?",
              inline: true,
            },
            {
              name: "Scan Score",
              value: `${validation.score}/${validation.maxScore}`,
              inline: true,
            },
          );
      }

      if (logChannel) logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("[Verify Error]", err);
      const ok = await sendDM(
        message.author,
        "Something went wrong while reading your image 😓 Please try again in a moment. If the issue persists, contact an admin.",
      );
      if (!ok)
        await message.reply({
          content: "Error reading image, please try again.",
          allowedMentions: { repliedUser: false },
        });
    }
  },
};

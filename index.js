const { exec } = require('child_process');

const installDependencies = () => {
    const packages = ["dotenv", "discord.js", "axios"];
    const command = `npm install ${packages.join(" ")}`;

    console.log("Installing packages:", packages.join(", "));

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error installing packages: ${error.message}`);
            return;
        }

        if (stderr) {
            console.warn(`stderr: ${stderr}`);
        }

        console.log("Packages installed successfully:\n", stdout);
    });
};

try {
    require.resolve('dotenv');
    require.resolve('discord.js');
    require.resolve('axios');
    console.log("All required packages are already installed.");
} catch (e) {
    console.log("Some packages are missing. Installing now...");
    installDependencies();
}

require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');
const { 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle
  } = require('discord.js');
  
  const Client = require('discord.js').Client;
const axios = require('axios');


const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    tmdbApiKey: process.env.TMDB_API_KEY,
    tmdbBaseUrl: 'https://api.themoviedb.org/3',
    status: 'Watching over the server',
    redditBaseUrl: 'https://www.reddit.com/r/memes/top.json?limit=1',
};

const commands = [
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for a movie or TV series')
        .addStringOption((option) =>
            option.setName('title').setDescription('The title to search for').setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription('Type of content to search for')
                .addChoices(
                    { name: 'Movie', value: 'movie' },
                    { name: 'TV Show', value: 'tv' }
                )
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a meme from Reddit'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all available commands'),
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to ban').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to kick').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for kicking').setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View user profile')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to view').setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption((option) =>
            option.setName('user').setDescription('The user to unban').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to mute').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a user')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to unmute').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('restrict')
        .setDescription('Restrict a user by adding a restricted role')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to restrict').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('unrestrict')
        .setDescription('Unrestrict a user by removing the restricted role')
        .addUserOption((option) =>
            option.setName('user').setDescription('The user to unrestrict').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete a specific number of messages')
        .addIntegerOption((option) =>
            option.setName('amount').setDescription('Number of messages to delete').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('embedcreate')
        .setDescription('Create and send an embed to a specific channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the embed to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The description of the embed')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('embededit')
        .setDescription('Edit an existing embed')
        .addStringOption(option =>
            option.setName('messagelink')
                .setDescription('The link to the message containing the embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The new title')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The new description')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('massunban')
        .setDescription('Unban all banned users')
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('Confirm mass unban')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display detailed server information'),
].map(command => command.toJSON());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMembers
    ],
});

const createResultEmbed = (result, currentPage, totalResults, type) => {
    const embed = new EmbedBuilder()
        .setTitle(result.title || result.name)
        .setDescription(result.overview || 'No description available.')
        .setFooter({
            text: `Result ${currentPage + 1} of ${totalResults} • Rating: ⭐ ${result.vote_average}/10`,
        })
        .setColor('#40E0D0')
        .setTimestamp();

    if (result.poster_path) {
        embed.setImage(`https://image.tmdb.org/t/p/w500${result.poster_path}`);
    }

    if (type === 'movie') {
        embed.addFields([
            { name: 'Release Date', value: result.release_date || 'N/A', inline: true },
            { name: 'Original Title', value: result.original_title || 'N/A', inline: true },
        ]);
    } else {
        embed.addFields([
            { name: 'First Air Date', value: result.first_air_date || 'N/A', inline: true },
            { name: 'Original Name', value: result.original_name || 'N/A', inline: true },
        ]);
    }

    return embed;
};

const getButtonRow = (currentIndex, totalResults) => {
    const row = new ActionRowBuilder();

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentIndex === 0),

        new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentIndex === totalResults - 1)
    );

    return row;
};

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'search') {
        try {
            await interaction.deferReply();

            const query = interaction.options.getString('title');
            const type = interaction.options.getString('type') || 'movie';

            const response = await axios.get(`${config.tmdbBaseUrl}/search/${type}`, {
                params: {
                    api_key: config.tmdbApiKey,
                    query: query,
                    language: 'en-US',
                    page: 1,
                },
            });

            const results = response.data.results;

            if (results.length === 0) {
                await interaction.editReply('No results found for that title.');
                return;
            }

            let currentIndex = 0;

            const initialEmbed = createResultEmbed(results[currentIndex], currentIndex, results.length, type);
            const initialRow = getButtonRow(currentIndex, results.length);

            const reply = await interaction.editReply({
                embeds: [initialEmbed],
                components: [initialRow],
            });

            const collector = reply.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300000,
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'prev') currentIndex--;
                if (i.customId === 'next') currentIndex++;

                const newEmbed = createResultEmbed(results[currentIndex], currentIndex, results.length, type);
                const newRow = getButtonRow(currentIndex, results.length);

                await i.update({
                    embeds: [newEmbed],
                    components: [newRow],
                });
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({
                        components: [],
                    });
                } catch (error) {
                    console.error('Failed to remove buttons after timeout:', error);
                }
            });
        } catch (error) {
            console.error('Search command error:', error);
            await interaction.editReply('Failed to fetch search results. Please try again later.');
        }
    } else if (commandName === 'kick') {
        if (!interaction.member.permissions.has('KICK_MEMBERS')) {
            return interaction.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id);

        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
        }

        await member.kick(reason);
        await interaction.reply(`${user.tag} has been kicked. Reason: ${reason}`);
    } else if (commandName === 'profile') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);

        const profileEmbed = new EmbedBuilder()
            .setTitle(`${user.tag}'s Profile`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor('#40E0D0')
            .addFields([
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                { name: '🎭 Roles', value: member.roles.cache.map(role => role.toString()).join(', ') || 'No roles' },
                { name: '🎮 Activity', value: member.presence?.activities[0]?.name || 'No activity' },
                { name: '🏷️ Nickname', value: member.nickname || 'No nickname' }
            ])
            .setTimestamp();

        await interaction.reply({ embeds: [profileEmbed] });
    } else if (commandName === 'meme') {
        try {
            const response = await axios.get(config.redditBaseUrl);
            const meme = response.data.data.children[0].data;

            const memeEmbed = new EmbedBuilder()
                .setTitle(meme.title)
                .setImage(meme.url)
                .setFooter({ text: 'From Reddit /r/memes' })
                .setColor('#40E0D0');

            await interaction.reply({ embeds: [memeEmbed] });
        } catch (error) {
            console.error('Meme command error:', error);
            await interaction.reply('Failed to fetch meme. Please try again later.');
        }
    } else if (commandName === 'help') {
        const helpMessage = new EmbedBuilder()
            .setTitle('Available Commands')
            .setDescription('Here is a list of commands you can use:')
            .addFields([
                { name: '/search', value: 'Search for a movie or TV series' },
                { name: '/meme', value: 'Get a meme from Reddit' },
                { name: '/help', value: 'Show this message' },
                { name: '/kick', value: 'Kick a user' },
                { name: '/profile', value: 'View user profile' },
                { name: '/ban', value: 'Ban a user' },
                { name: '/unban', value: 'Unban a user' },
                { name: '/mute', value: 'Mute a user' },
                { name: '/unmute', value: 'Unmute a user' },
                { name: '/restrict', value: 'Restrict a user' },
                { name: '/unrestrict', value: 'Unrestrict a user' },
                { name: '/purge', value: 'Purge messages' },
                { name: '/embedcreate', value: 'Create an embed message' },
                { name: '/embededit', value: 'Edit an existing embed' },
                { name: '/massunban', value: 'Unban all users' },
                { name: '/serverinfo', value: 'Display server information' },
            ])
            .setColor('#40E0D0');

        await interaction.reply({ embeds: [helpMessage] });
    } else if (commandName === 'ban') {
        const user = interaction.options.getUser('user');
        if (interaction.member.permissions.has('BAN_MEMBERS')) {
            await interaction.guild.members.ban(user);
            await interaction.reply(`${user.tag} has been banned.`);
        } else {
            await interaction.reply('You do not have permission to ban members.');
        }
    } else if (commandName === 'unban') {
        const userId = interaction.options.getString('user');
        if (interaction.member.permissions.has('BAN_MEMBERS')) {
            await interaction.guild.members.unban(userId);
            await interaction.reply(`User with ID ${userId} has been unbanned.`);
        } else {
            await interaction.reply('You do not have permission to unban members.');
        }
    } else if (commandName === 'mute') {
        const user = interaction.options.getUser('user');
        const mutedRole = await interaction.guild.roles.cache.find((role) => role.name === 'Muted');
        if (!mutedRole) {
            return interaction.reply('Muted role not found.');
        }
        await interaction.guild.members.cache.get(user.id).roles.add(mutedRole);
        await interaction.reply(`${user.tag} has been muted.`);
    } else if (commandName === 'unmute') {
        const user = interaction.options.getUser('user');
        const mutedRole = await interaction.guild.roles.cache.find((role) => role.name === 'Muted');
        if (!mutedRole) {
            return interaction.reply('Muted role not found.');
        }
        await interaction.guild.members.cache.get(user.id).roles.remove(mutedRole);
        await interaction.reply(`${user.tag} has been unmuted.`);
    } else if (commandName === 'restrict') {
        const user = interaction.options.getUser('user');
        const restrictedRole = await interaction.guild.roles.cache.find((role) => role.name === 'Restricted');
        if (!restrictedRole) {
            return interaction.reply('Restricted role not found.');
        }
        await interaction.guild.members.cache.get(user.id).roles.add(restrictedRole);
        await interaction.reply(`${user.tag} has been restricted.`);
    } else if (commandName === 'unrestrict') {
        const user = interaction.options.getUser('user');
        const restrictedRole = await interaction.guild.roles.cache.find((role) => role.name === 'Restricted');
        if (!restrictedRole) {
            return interaction.reply('Restricted role not found.');
        }
        await interaction.guild.members.cache.get(user.id).roles.remove(restrictedRole);
        await interaction.reply(`${user.tag} has been unrestricted.`);
    } else if (commandName === 'purge') {
        if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
            return interaction.reply('You do not have permission to purge messages.');
        }
        const amount = interaction.options.getInteger('amount');
        if (amount > 100) {
            return interaction.reply('You can only delete up to 100 messages at once.');
        }
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply(`${amount} messages have been deleted.`);
    } else if (commandName === 'embedcreate') {
        if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
            return interaction.reply({ content: 'You do not have permission to create embeds.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor('#40E0D0')
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Embed created successfully!', ephemeral: true });
    } else if (commandName === 'embededit') {
        if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
            return interaction.reply({ content: 'You do not have permission to edit embeds.', ephemeral: true });
        }

        const messageLink = interaction.options.getString('messagelink');
        const newTitle = interaction.options.getString('title');
        const newDescription = interaction.options.getString('description');

        try {
            const [, , , channelId, messageId] = messageLink.split('/');
            const channel = await interaction.guild.channels.fetch(channelId);
            const message = await channel.messages.fetch(messageId);

            if (!message.embeds[0]) {
                return interaction.reply({ content: 'No embed found in the specified message.', ephemeral: true });
            }

            const originalEmbed = message.embeds[0];
            const updatedEmbed = new EmbedBuilder()
                .setTitle(newTitle || originalEmbed.title)
                .setDescription(newDescription || originalEmbed.description)
                .setColor('#40E0D0')
                .setTimestamp();

            await message.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: 'Embed updated successfully!', ephemeral: true });
        } catch (error) {
            console.error('Error editing embed:', error);
            await interaction.reply({ content: 'Failed to edit embed. Please check the message link.', ephemeral: true });
        }
    } else if (commandName === 'massunban') {
        if (!interaction.member.permissions.has('BAN_MEMBERS')) {
            return interaction.reply({ content: 'You do not have permission to unban members.', ephemeral: true });
        }

        const confirm = interaction.options.getBoolean('confirm');
        if (!confirm) {
            return interaction.reply({ content: 'Operation cancelled.', ephemeral: true });
        }

        try {
            const bans = await interaction.guild.bans.fetch();
            if (bans.size === 0) {
                return interaction.reply({ content: 'There are no banned users to unban.', ephemeral: true });
            }

            await interaction.reply({ content: `Starting mass unban of ${bans.size} users...`, ephemeral: true });

            for (const ban of bans.values()) {
                await interaction.guild.members.unban(ban.user.id);
            }

            await interaction.followUp({ content: `Successfully unbanned ${bans.size} users!`, ephemeral: true });
        } catch (error) {
            console.error('Mass unban error:', error);
            await interaction.followUp({ content: 'An error occurred during the mass unban process.', ephemeral: true });
        }
    } else if (commandName === 'serverinfo') {
        const guild = interaction.guild;
        await guild.members.fetch();

        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(member => member.user.bot).size;
        const humanCount = totalMembers - botCount;
        
        const invites = await guild.invites.fetch();
        const primaryInvite = invites.first() ? invites.first().url : 'No invite links available';

        const serverInfoEmbed = new EmbedBuilder()
            .setTitle(`${guild.name} - Server Information`)
            .setColor('#40E0D0')
            .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
            .addFields([
                { name: '👥 Total Members', value: `${totalMembers}`, inline: true },
                { name: '👤 Humans', value: `${humanCount}`, inline: true },
                { name: '🤖 Bots', value: `${botCount}`, inline: true },
                { name: '📅 Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '🌐 Server ID', value: guild.id, inline: true },
                { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '📜 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '🔗 Primary Invite', value: primaryInvite, inline: true }
            ])
            .setDescription(guild.description || 'No server description')
            .setTimestamp();

        await interaction.reply({ embeds: [serverInfoEmbed] });
    }
});

client.once('ready', async () => {
    console.log(`[LOG] Bot is online as ${client.user.tag}`);
    console.log("[LOG] Credits to Starlover for development");
    try {
        client.user.setActivity(config.status, { type: 'WATCHING' });

        const rest = new REST({ version: '10' }).setToken(config.token);
        await rest.put(Routes.applicationCommands(config.clientId), { body: commands });

        console.log(`[LOG] Registered commands successfully`);
    } catch (error) {
        console.error('[ERROR] Failed to register commands:', error);
    }
});

client.login(config.token).catch((error) => {
    console.error('[ERROR] Failed to log in:', error);
});

const messageClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

messageClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!')) {
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'ping') {
            const reply = await message.reply('Calculating ping...');
            const pingTime = reply.createdTimestamp - message.createdTimestamp;
            await reply.edit(`Pong! Bot Latency: ${pingTime}ms | API Latency: ${messageClient.ws.ping}ms`);
        }
    }
});

messageClient.once('ready', () => {
    console.log(`[LOG] Message handler is online as ${messageClient.user.tag}`);
});

messageClient.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('[ERROR] Failed to log in message handler:', error);
});

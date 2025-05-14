import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Colors, APIEmbedField } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

interface TruthSocialPost {
  id: string;
  content: string;
  createdAt: string;
  url: string;
}

interface RedditPost {
  id: string;
  title: string;
  url: string;
  created: number;
  author?: string;
  content?: string;
  subreddit?: string;
}

// Utility function to truncate text if it's too long
function truncateText(text: string, maxLength: number = 2000): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// Extract an image URL from content if available
function extractImageUrl(content: string): string | null {
  const imgRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?)/i;
  const match = content.match(imgRegex);
  return match ? match[1] : null;
}

// Format date for display
function formatDateForDisplay(dateString: string): string {
  // Parse the date string to make sure it's handled correctly
  const date = new Date(dateString);
  
  // Get month, day, year for the formatted date
  const formattedDate = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
  });
  
  // Add hardcoded time "7:50 PM EST"
  return `${formattedDate}, 7:50 PM EST`;
}

class DiscordClient {
  private client: Client;
  private channelId: string;
  private isReady = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ]
    });

    this.channelId = process.env.DISCORD_CHANNEL_ID || '';
    
    this.client.on('ready', () => {
      console.log(`Logged in as ${this.client.user?.tag}!`);
      this.isReady = true;
      this.sendStartupMessage();
    });

    this.client.login(process.env.DISCORD_TOKEN).catch(error => {
      console.error('Error logging in to Discord:', error);
    });
  }

  private async getChannel(): Promise<TextChannel | null> {
    if (!this.isReady || !this.channelId) {
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        console.error('Invalid channel or not a text channel');
        return null;
      }
      return channel;
    } catch (error) {
      console.error('Error fetching channel:', error);
      return null;
    }
  }

  async sendStartupMessage(): Promise<void> {
    const channel = await this.getChannel();
    if (!channel) return;

    try {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔔 Trump Tracker Bot Online')
            .setDescription('Bot is now tracking Donald Trump\'s posts from Truth Social')
            .setColor(Colors.Blue)
            .setTimestamp()
            .setFooter({ 
              text: 'Trump Tracker Bot',
              iconURL: 'https://i.imgur.com/XptPTJY.png'
            })
        ]
      });
    } catch (error) {
      console.error('Error sending startup message:', error);
    }
  }

  async sendTruthSocialUpdate(post: TruthSocialPost): Promise<void> {
    const channel = await this.getChannel();
    if (!channel) return;

    // Check if the post contains any images
    const imageUrl = extractImageUrl(post.content);
    
    // Parse the created time
    const createdTime = new Date(post.createdAt);
    
    // Log the date information for debugging
    console.log(`Post date from API: ${post.createdAt}`);
    console.log(`Parsed date: ${createdTime.toString()}`);
    
    // Format the date nicely
    const formattedDate = formatDateForDisplay(post.createdAt);

    // Create fields for the embed
    const fields: APIEmbedField[] = [
      {
        name: '🕒 Posted',
        value: formattedDate,
        inline: true
      },
      {
        name: '🔗 Source',
        value: '[Truth Social](https://truthsocial.com/@realDonaldTrump)',
        inline: true
      }
    ];

    try {
      const embed = new EmbedBuilder()
        .setTitle('📢 New Truth Social Post from Donald Trump')
        .setDescription(truncateText(post.content, 4000))
        .setURL(post.url)
        .setColor('#FF5700')
        .addFields(fields)
        .setFooter({ 
          text: 'Truth Social',
          iconURL: 'https://i.imgur.com/XptPTJY.png'
        });

      // If image is found, add it to the embed
      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      // Set author without icon
      embed.setAuthor({
        name: 'Donald J. Trump',
        url: 'https://truthsocial.com/@realDonaldTrump'
      });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending Truth Social update:', error);
    }
  }

  async sendRedditUpdate(post: RedditPost): Promise<void> {
    const channel = await this.getChannel();
    if (!channel) return;

    // Try to extract an image from the content
    const imageUrl = extractImageUrl(post.content || '');
    
    // Format the content to be more readable
    let content = post.content || '';
    content = content.replace(/<img.*?>/g, ''); // Remove img tags
    content = content.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)".*?>(.*?)<\/a>/g, '[$2]($1)'); // Convert <a> links to markdown
    content = content.replace(/<\/?[^>]+(>|$)/g, ''); // Remove remaining HTML tags
    content = truncateText(content.trim(), this.countLinks(content) > 2 ? 200 : 1000);
    
    // Format date nicely
    const formattedDate = new Date(post.created * 1000).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create fields for the embed
    const fields: APIEmbedField[] = [];
    
    // Add author if available
    if (post.author) {
      fields.push({
        name: '👤 Posted by',
        value: `u/${post.author}`,
        inline: true
      });
    }
    
    fields.push(
      {
        name: '🕒 Posted',
        value: formattedDate,
        inline: true
      },
      {
        name: '📂 Subreddit',
        value: `r/${post.subreddit || 'TrumpTracker'}`,
        inline: true
      }
    );
    
    // Add content field if available and not empty
    if (content && content.trim() !== '') {
      fields.push({
        name: '📝 Content',
        value: content,
        inline: false
      });
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle(truncateText(post.title, 256))
        .setURL(post.url)
        .setColor(Colors.Red)
        .addFields(fields)
        .setTimestamp(new Date(post.created * 1000))
        .setFooter({ 
          text: `Reddit • Post ID: ${post.id}`,
          iconURL: 'https://i.imgur.com/XptPTJY.png'
        });

      // Set thumbnail or image based on content
      if (imageUrl) {
        if (content.length > 200) {
          // Use as thumbnail for longer posts
          embed.setThumbnail(imageUrl);
        } else {
          // Use as main image for shorter posts
          embed.setImage(imageUrl);
        }
      }

      // Set author with Trump Tracker branding
      embed.setAuthor({
        name: 'Trump Tracker',
        iconURL: 'https://styles.redditmedia.com/t5_3bzq5y/styles/communityIcon_zbjrw2zr18e61.png', 
        url: 'https://www.reddit.com/r/TrumpTracker/'
      });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending Reddit update:', error);
    }
  }

  // Helper method to count links in content
  private countLinks(content: string): number {
    const linkRegex = /\[.*?\]\(.*?\)/g;
    const matches = content.match(linkRegex);
    return matches ? matches.length : 0;
  }
}

export default new DiscordClient(); 
import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Colors, APIEmbedField, AttachmentBuilder } from 'discord.js';
import dotenv from 'dotenv';
import axios from 'axios';
import { randomUUID } from 'crypto';

dotenv.config();

interface TruthSocialPost {
  id: string;
  content: string;
  createdAt: string;
  url: string;
  media_attachments?: {
    type: string;
    url: string;
    preview_url: string;
    meta?: {
      original?: {
        duration?: number;
        width?: number;
        height?: number;
      };
    };
  }[];
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

// Extract an image or video URL from content if available
function extractMediaUrl(content: string): { url: string | null, type: 'image' | 'video' | null } {
  const imgRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?)/i;
  const videoRegex = /(https?:\/\/\S+\.(?:mp4|mov|webm|avi)(?:\?\S*)?)/i;
  
  const imgMatch = content.match(imgRegex);
  if (imgMatch) {
    return { url: imgMatch[1], type: 'image' };
  }

  const videoMatch = content.match(videoRegex);
  if (videoMatch) {
    return { url: videoMatch[1], type: 'video' };
  }

  return { url: null, type: null };
}

// Format date for display
function formatDateForDisplay(dateString: string): string {
  // Parse the date string to make sure it's handled correctly
  const date = new Date(dateString);
  
  // Format the date and time using US locale and EST timezone
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  });
}

// Helper function to format video duration
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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


  async sendTruthSocialUpdate(post: TruthSocialPost): Promise<void> {
    const channel = await this.getChannel();
    if (!channel) return;

    // Parse the created time
    const createdTime = new Date(post.createdAt);
    
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

    // Handle media attachments
    const mediaAttachment = post.media_attachments?.[0];

    try {
      const embed = new EmbedBuilder()
        .setURL(post.url)
        .setColor('#FF5700')
        .setFooter({ 
          text: 'Truth Social',
          iconURL: 'https://i.imgur.com/XptPTJY.png'
        });

      // Set author with icon
      embed.setAuthor({
        name: 'Donald J. Trump',
        url: 'https://truthsocial.com/@realDonaldTrump'
      });

      // Handle media attachments in the embed
      if (mediaAttachment) {
        if (mediaAttachment.type === 'image') {
          // For images, use the standard layout
          embed.setTitle('📢 New Truth Social Post from Donald Trump');
          embed.setImage(mediaAttachment.url);
          embed.addFields(fields);
          
          // If there's text content, set it as description
          if (post.content && post.content.trim().length > 0) {
            embed.setDescription(truncateText(post.content, 4000));
          }
          
          await channel.send({ embeds: [embed] });
        } else if (mediaAttachment.type === 'video') {
          // For videos, use a simpler layout matching the example
          embed.setTitle('📢 New Truth Social Post from Donald Trump');
          
          // Create fields exactly matching the expected format
          const videoFields: APIEmbedField[] = [
            {
              name: '📹 Click to view video',
              value: `[${mediaAttachment.url}](${mediaAttachment.url})`,
              inline: false
            },
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
          
          // Add all fields to the embed
          embed.addFields(videoFields);
          
          // Only add description if there's meaningful content
          if (post.content && post.content.trim().length > 0) {
            embed.setDescription(truncateText(post.content, 4000));
          }

          // No need to download and attach thumbnail for this format
          // Send the message as is
          await channel.send({ embeds: [embed] });
          return;
        }
      } else {
        // No media attachment, just a text post
        embed.setTitle('📢 New Truth Social Post from Donald Trump');
        embed.addFields(fields);
        
        // If there's text content, set it as description
        if (post.content && post.content.trim().length > 0) {
          embed.setDescription(truncateText(post.content, 4000));
        }
        
        // Log the final embed structure
        console.log('Final embed structure:', JSON.stringify(embed.toJSON(), null, 2));

        await channel.send({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Error sending Truth Social update:', error);
    }
  }

  async sendRedditUpdate(post: RedditPost): Promise<void> {
    const channel = await this.getChannel();
    if (!channel) return;

    // Try to extract an image from the content
    const imageUrl = extractMediaUrl(post.content || '').url;
    
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
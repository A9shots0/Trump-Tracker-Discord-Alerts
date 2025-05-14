import axios from 'axios';
import dotenv from 'dotenv';
import dbService from './dbService';
import discordClient from './discordClient';

dotenv.config();

// Interfaces for Truth Social API responses
interface TruthSocialAccount {
  id: string;
  username: string;
  display_name: string;
  verified: boolean;
  url: string;
}

interface TruthSocialApiPost {
  id: string;
  text: string;
  created_at: string;
  uri: string;
  url: string;
  content: string;
  account: TruthSocialAccount;
  media_attachments: any[];
  card: any;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
}

interface TruthSocialApiResponse {
  success: boolean;
  posts: TruthSocialApiPost[];
  next_max_id?: string;
}

interface TruthSocialPost {
  id: string;
  content: string;
  createdAt: string;
  url: string;
}

class TruthSocialService {
  private apiKey: string;
  private baseUrl: string = 'https://api.scrapecreators.com/v1/truthsocial';
  private errorCount: number = 0;
  private lastErrorTime: number = 0;
  private readonly maxErrorsBeforeWarning: number = 3;
  private readonly errorSuppressTime: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.apiKey = process.env.SCRAPECREATORS_API_KEY || '';
    if (!this.apiKey) {
      console.error('SCRAPECREATORS_API_KEY is not set in environment variables');
    }
  }

  async fetchLatestPosts(limit: number = 5, forceProcess: boolean = false): Promise<void> {
    if (!this.apiKey) {
      // Only log this once to avoid spamming
      if (this.errorCount === 0) {
        console.error('Cannot fetch Truth Social posts: API key not set');
        this.errorCount++;
      }
      return;
    }

    try {
      // Using the correct API endpoint based on the provided documentation
      const response = await axios.get<TruthSocialApiResponse>(`${this.baseUrl}/user/posts`, {
        params: {
          handle: 'realDonaldTrump'
        },
        headers: {
          'x-api-key': this.apiKey
        }
      });

      // Reset error count on success
      this.errorCount = 0;

      if (response.data && response.data.success && response.data.posts && response.data.posts.length > 0) {
        const posts = response.data.posts.map((post: TruthSocialApiPost) => ({
          id: post.id,
          content: post.text || post.content.replace(/<[^>]*>/g, ''), // Strip HTML tags
          createdAt: post.created_at,
          url: post.url
        }));

        // Process newest posts first (they should already be in chronological order, newest first)
        await this.processNewPosts(posts, forceProcess);
      }
    } catch (error: any) {
      // Implement error tracking to reduce log spam
      const currentTime = Date.now();
      this.errorCount++;

      // Only log errors if:
      // 1. This is the first error
      // 2. We've hit max errors and it's been a while since we last reported
      if (this.errorCount === 1 || 
          (this.errorCount % this.maxErrorsBeforeWarning === 0 && 
           currentTime - this.lastErrorTime > this.errorSuppressTime)) {
        
        this.lastErrorTime = currentTime;
        console.error(
          `Truth Social API error (attempt ${this.errorCount}): ${error.message}. ` +
          `Further similar errors will be suppressed for ${this.errorSuppressTime/60000} minutes.`
        );

        // If there's a status code of 404, provide a helpful message
        if (error.response && error.response.status === 404) {
          console.info(
            "The Truth Social API may have changed. Please check the API documentation for updated endpoints."
          );
        }
      }
    }
  }

  private async processNewPosts(posts: TruthSocialPost[], forceProcess: boolean = false): Promise<void> {
    if (posts.length === 0) return;

    // Get the last seen post ID from the database
    const { truth_social_post_id: lastSeenPostId } = await dbService.getLastSeenPosts();

    // If we have no last seen post ID or force processing is enabled, process the most recent post
    if (!lastSeenPostId || forceProcess) {
      const postToProcess = posts[0];
      console.log(`Processing ${forceProcess ? 'forced' : 'initial'} Truth Social post: ${postToProcess.id}`);
      await dbService.updateLastSeenTruthSocialPost(postToProcess.id);
      await discordClient.sendTruthSocialUpdate(postToProcess);
      return;
    }

    // Find new posts (those with an ID greater than the last seen post ID)
    const newPosts = posts.filter(post => post.id > lastSeenPostId);

    if (newPosts.length > 0) {
      console.log(`Found ${newPosts.length} new Truth Social posts to process`);
      
      // Update the database with the most recent post ID
      await dbService.updateLastSeenTruthSocialPost(newPosts[0].id);

      // Send Discord notifications for each new post, from oldest to newest
      for (const post of newPosts.reverse()) {
        await discordClient.sendTruthSocialUpdate(post);
      }
    }
  }
}

export default new TruthSocialService(); 
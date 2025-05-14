import nano from 'nano';
import dotenv from 'dotenv';

dotenv.config();

interface LastSeenPosts {
  _id: string;
  _rev?: string;
  truth_social_post_id?: string;
}

class DbService {
  private nano: nano.ServerScope;
  private db!: nano.DocumentScope<LastSeenPosts>;
  private dbName = 'trump_tracker';
  private docId = 'last_seen_posts';
  private connectionErrors = 0;
  private maxConsecutiveErrors = 5;
  private initialized = false;
  private initializationTimeout = 30000; // 30 seconds timeout
  private retryDelay = 5000; // 5 seconds between retries

  constructor() {
    const url = process.env.COUCHDB_URL || 'http://db:5984';
    const username = process.env.COUCHDB_USERNAME || 'admin';
    const password = process.env.COUCHDB_PASSWORD || 'password';

    console.log(`Connecting to CouchDB at ${url}`);

    // Create connection with authentication
    this.nano = nano({
      url,
      requestDefaults: {
        auth: {
          username,
          password
        }
      }
    });

    // Initialize DB with timeout
    this.initializeWithTimeout();
  }

  private async initializeWithTimeout(): Promise<void> {
    const startTime = Date.now();

    while (!this.initialized && Date.now() - startTime < this.initializationTimeout) {
      try {
        await this.initialize();
        if (this.initialized) {
          console.log('Successfully connected to database');
          return;
        }
      } catch (error) {
        // Only log first error and when max errors reached
        if (this.connectionErrors === 1 || this.connectionErrors === this.maxConsecutiveErrors) {
          console.error(`Database connection attempt ${this.connectionErrors} failed:`, error);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }

    if (!this.initialized) {
      console.error(`Failed to initialize database after ${this.initializationTimeout/1000} seconds`);
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Check if database exists, if not create it
      const dbList = await this.nano.db.list();
      if (!dbList.includes(this.dbName)) {
        await this.nano.db.create(this.dbName);
        console.log(`Created database: ${this.dbName}`);
      }

      // Set db reference
      this.db = this.nano.use<LastSeenPosts>(this.dbName);

      // Check if our document exists, if not create it
      try {
        await this.db.get(this.docId);
        this.initialized = true;
        this.connectionErrors = 0;
      } catch (err) {
        // Document doesn't exist, create it
        await this.db.insert({
          _id: this.docId,
          truth_social_post_id: ''
        });
        console.log(`Created document: ${this.docId}`);
        this.initialized = true;
        this.connectionErrors = 0;
      }
    } catch (error) {
      this.connectionErrors++;
      throw error; // Re-throw for the timeout handler
    }
  }

  async getLastSeenPosts(): Promise<LastSeenPosts> {
    // If not initialized yet, return an empty document
    if (!this.initialized) {
      return { _id: this.docId };
    }
    
    try {
      const doc = await this.db.get(this.docId);
      this.connectionErrors = 0;
      return doc;
    } catch (error) {
      console.error('Error getting last seen posts:', error);
      return { _id: this.docId };
    }
  }

  async updateLastSeenTruthSocialPost(postId: string): Promise<void> {
    if (!this.initialized) {
      console.log('Database not initialized, skipping Truth Social post update');
      return;
    }
    
    try {
      const doc = await this.getLastSeenPosts();
      await this.db.insert({
        ...doc,
        truth_social_post_id: postId
      });
    } catch (error) {
      console.error('Error updating last seen Truth Social post:', error);
    }
  }
}

export default new DbService(); 
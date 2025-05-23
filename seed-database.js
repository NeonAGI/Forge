import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
console.log('Connecting to database:', connectionString.replace(/:[^:@]*@/, ':***@'));

const client = postgres(connectionString);
const db = drizzle(client);

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Hash the demo password
    const passwordHash = await bcrypt.hash('password123', 12);

    // Insert demo user
    await db.execute(`
      INSERT INTO "users" ("username", "email", "password_hash", "display_name") VALUES 
      ('demo', 'demo@forge.local', '${passwordHash}', 'Demo User')
      ON CONFLICT (username) DO NOTHING
    `);

    // Get the demo user ID
    const user = await db.execute(`
      SELECT id FROM "users" WHERE username = 'demo' LIMIT 1
    `);

    if (user.length === 0) {
      console.error('Failed to create or find demo user');
      return;
    }

    const userId = user[0].id;
    console.log('Demo user ID:', userId);

    // Insert default settings for demo user
    const existingSettings = await db.execute(`
      SELECT id FROM "user_settings" WHERE user_id = ${userId} LIMIT 1
    `);
    
    if (existingSettings.length === 0) {
      await db.execute(`
        INSERT INTO "user_settings" ("user_id", "location") VALUES 
        (${userId}, 'San Francisco, CA')
      `);
      console.log('Created default settings for demo user');
    } else {
      console.log('Settings already exist for demo user');
    }

    console.log('✅ Database seeded successfully!');
    console.log('Demo account credentials:');
    console.log('  Username: demo');
    console.log('  Password: password123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.end();
  }
}

seedDatabase();